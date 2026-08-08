// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const MONO_SECRET_KEY = Deno.env.get("MONO_SECRET_KEY");
    if (!MONO_SECRET_KEY) {
      throw new Error("Missing MONO_SECRET_KEY in Edge Function secrets");
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId;

    // Fetch connected Mono banks
    let query = supabaseClient.from("connected_banks").select("*");
    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: connectedBanks, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    console.log(`Syncing ${connectedBanks?.length ?? 0} Mono connected bank accounts...`);

    const results = [];

    for (const bank of connectedBanks || []) {
      try {
        const monoAccountId = bank.mono_account_id;
        const userId = bank.user_id;

        // 1. Fetch updated balance from Mono API v2
        let currentBalance = bank.balance || 0;
        let fetchedBalance: number | null = null;

        const detailsRes = await fetch(`https://api.withmono.com/v2/accounts/${monoAccountId}`, {
          headers: {
            "Content-Type": "application/json",
            "mono-sec-key": MONO_SECRET_KEY,
          },
        });

        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          const acct = detailsData?.data?.account || detailsData?.account || detailsData?.data || detailsData;
          const rawBal = acct?.balance ?? detailsData?.data?.account?.balance ?? detailsData?.data?.balance ?? detailsData?.account?.balance ?? detailsData?.balance;
          if (rawBal !== undefined && rawBal !== null) {
            const num = typeof rawBal === "number" ? rawBal : parseFloat(String(rawBal));
            if (!isNaN(num)) fetchedBalance = num / 100;
          }
        }

        // Secondary balance check if details response returned no balance or 0
        if (fetchedBalance === null || fetchedBalance === 0) {
          try {
            const balRes = await fetch(`https://api.withmono.com/v2/accounts/${monoAccountId}/balance`, {
              headers: {
                "Content-Type": "application/json",
                "mono-sec-key": MONO_SECRET_KEY,
              },
            });
            if (balRes.ok) {
              const balData = await balRes.json();
              const liveRaw = balData?.data?.balance ?? balData?.balance ?? balData?.data?.available_balance;
              if (liveRaw !== undefined && liveRaw !== null) {
                const num = typeof liveRaw === "number" ? liveRaw : parseFloat(String(liveRaw));
                if (!isNaN(num)) fetchedBalance = num / 100;
              }
            }
          } catch (balErr) {
            console.warn("Mono live balance endpoint error:", balErr);
          }
        }

        if (fetchedBalance !== null) {
          currentBalance = fetchedBalance;
          // Update connected_banks
          await supabaseClient
            .from("connected_banks")
            .update({ balance: currentBalance, updated_at: new Date().toISOString() })
            .eq("id", bank.id);
        }

        // Get account ID in database
        let { data: targetAccount } = await supabaseClient
          .from("accounts")
          .select("id")
          .eq("user_id", userId)
          .eq("mono_account_id", monoAccountId)
          .maybeSingle();

        if (!targetAccount && bank.bank_name) {
          const { data: fallbackAcc } = await supabaseClient
            .from("accounts")
            .select("id")
            .eq("user_id", userId)
            .eq("institution", bank.bank_name)
            .maybeSingle();
          targetAccount = fallbackAcc;
        }

        if (targetAccount?.id && fetchedBalance !== null) {
          await supabaseClient
            .from("accounts")
            .update({
              balance: currentBalance,
              mono_account_id: monoAccountId,
              sync_source: "mono",
              sync_status: "active",
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", targetAccount.id);
        }

        const accountIdInDb = targetAccount?.id;

        // 2. Fetch latest transactions from Mono API v2
        const txRes = await fetch(`https://api.withmono.com/v2/accounts/${monoAccountId}/transactions?limit=100`, {
          headers: {
            "Content-Type": "application/json",
            "mono-sec-key": MONO_SECRET_KEY,
          },
        });

        let savedCount = 0;

        if (txRes.ok) {
          const txData = await txRes.json();
          const rawTxs = txData.data || txData.transactions || (Array.isArray(txData) ? txData : []);

          for (const rawTx of rawTxs) {
            const ref = rawTx._id || rawTx.reference || rawTx.id || `MONO-${Date.now()}`;
            const amountInNaira = (rawTx.amount || 0) / 100;
            const txType = rawTx.type === "credit" ? "income" : "expense";
            const description = rawTx.narration || rawTx.description || `Mono Bank Transaction (${bank.bank_name})`;
            const txDate = rawTx.date ? new Date(rawTx.date).toISOString() : new Date().toISOString();

            // Deduplicate
            const { data: existing } = await supabaseClient
              .from("transactions")
              .select("id")
              .eq("user_id", userId)
              .eq("reference", ref)
              .maybeSingle();

            if (existing) continue;

            const { data: newTx, error: insertErr } = await supabaseClient
              .from("transactions")
              .insert({
                user_id: userId,
                account_id: accountIdInDb || null,
                amount: amountInNaira,
                type: txType,
                description: description,
                date: txDate,
                reference: ref,
                sync_source: "mono",
                is_verified: true,
              })
              .select()
              .single();

            if (!insertErr && newTx?.id) {
              savedCount++;

              // Auto-classify using ROVA AI engine
              try {
                await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-classify`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  },
                  body: JSON.stringify({
                    transaction: {
                      id: newTx.id,
                      description: description,
                      amount: amountInNaira,
                      type: txType,
                      date: txDate,
                    },
                    userId: userId,
                    mode: "full",
                  }),
                });
              } catch (classifyErr) {
                console.error("ai-classify call failed:", classifyErr);
              }
            }
          }
        }

        results.push({
          monoAccountId,
          bankName: bank.bank_name,
          balance: currentBalance,
          newTransactionsSaved: savedCount,
          status: "success",
        });
      } catch (bankErr: any) {
        console.error(`Failed to sync Mono bank ${bank.mono_account_id}:`, bankErr);
        results.push({
          monoAccountId: bank.mono_account_id,
          status: "failed",
          error: bankErr.message,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("mono-sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
