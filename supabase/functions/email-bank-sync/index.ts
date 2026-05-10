import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // 1. Fetch all active email sync accounts
    const { data: syncSettings, error: fetchError } = await supabaseClient
      .from("bank_email_sync_settings")
      .select("*, accounts(*)")
      .eq("accounts.sync_status", "active");

    if (fetchError) throw fetchError;

    const results = [];

    for (const setting of syncSettings) {
      try {
        // 2. Search for bank emails using the OAuth tokens
        // For Gmail/Outlook API integration, we would use:
        // const emails = await fetchEmails(setting.provider, setting.refresh_token, setting.bank_sender_address);
        
        // --- SIMULATED PARSER ENGINE ---
        // In a real implementation, we fetch message bodies and run these regexes:
        
        const mockBody = `
          Type: Credit
          Amount: NGN 12,500.00
          Account: ${setting.account_number}
          Date: 10-May-2026 14:30
          Balance: NGN 145,200.00
          Ref: FT/ROVA/SYNC/01
        `;

        const parsed = parseEmailBody(mockBody, setting.bank_name);

        if (parsed) {
          // 3. Record transaction if not already exists (using reference as idempotency key)
          const { error: txError } = await supabaseClient
            .from("transactions")
            .insert({
              user_id: setting.user_id,
              account_id: setting.account_id,
              amount: parsed.amount,
              type: parsed.type,
              description: `Email Sync: ${parsed.description}`,
              date: parsed.date,
              reference: parsed.reference,
              source: 'email',
              is_verified: true
            });

          // 4. Update account balance
          if (!txError) {
            await supabaseClient
              .from("accounts")
              .update({ 
                balance: parsed.balanceAfter,
                last_synced_at: new Date().toISOString()
              })
              .eq("id", setting.account_id);
          }
        }
        
        results.push({ accountId: setting.account_id, status: "success" });
      } catch (err) {
        console.error(`Sync failed for account ${setting.account_id}:`, err);
        results.push({ accountId: setting.account_id, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

function parseEmailBody(body: string, bank: string) {
  // Enhanced Regex Templates for Nigerian Banks
  const patterns = {
    amount: /Amount:\s*(?:NGN|₦)?\s*([\d,]+\.\d{2})/i,
    balance: /Balance:\s*(?:NGN|₦)?\s*([\d,]+\.\d{2})/i,
    type: /(Credit|Debit)/i,
    ref: /Ref:\s*([^\n\r]+)/i,
    date: /Date:\s*([^\n\r]+)/i
  };

  const amountMatch = body.match(patterns.amount);
  const balanceMatch = body.match(patterns.balance);
  const typeMatch = body.match(patterns.type);
  const refMatch = body.match(patterns.ref);

  if (!amountMatch || !typeMatch) return null;

  return {
    amount: parseFloat(amountMatch[1].replace(/,/g, "")),
    balanceAfter: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, "")) : 0,
    type: typeMatch[1].toLowerCase() as 'income' | 'expense',
    reference: refMatch ? refMatch[1].trim() : `EMAIL-${Date.now()}`,
    description: `Transaction via ${bank}`,
    date: new Date().toISOString() // In real app, parse the dateMatch
  };
}
