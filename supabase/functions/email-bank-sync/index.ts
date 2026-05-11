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

    const body = await req.json().catch(() => ({}));

    // -------------------------------------------------------------
    // ACTION: EXCHANGE TOKEN (Called from GmailCallbackPage)
    // -------------------------------------------------------------
    if (body.action === 'exchange_token') {
      const { code, accountId, redirectUri } = body;
      
      const clientId = Deno.env.get("GMAIL_CLIENT_ID");
      const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
      
      if (!clientId || !clientSecret) {
        throw new Error("Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in edge function environment");
      }

      // 1. Exchange the code for a refresh token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(tokenData.error_description || "Failed to exchange token with Google");
      }

      // 2. Save the refresh token
      const { error: updateError } = await supabaseClient
        .from("bank_email_sync_settings")
        .update({ refresh_token: tokenData.refresh_token || tokenData.access_token })
        .eq("account_id", accountId);

      if (updateError) throw updateError;

      // 3. Trigger an immediate initial sync for this account
      await syncAccount(supabaseClient, accountId, tokenData.access_token);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // -------------------------------------------------------------
    // DEFAULT ACTION: SYNC ALL ACCOUNTS
    // -------------------------------------------------------------
    const { data: syncSettings, error: fetchError } = await supabaseClient
      .from("bank_email_sync_settings")
      .select("*, accounts(*)")
      .eq("accounts.sync_status", "active")
      .not("refresh_token", "is", null);

    if (fetchError) throw fetchError;

    const results = [];
    const clientId = Deno.env.get("GMAIL_CLIENT_ID");
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
    
    if (!clientId || !clientSecret) {
      throw new Error("Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in edge function environment");
    }

    for (const setting of syncSettings) {
      try {
        // Exchange refresh token for fresh access token
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: setting.refresh_token,
            grant_type: "refresh_token"
          })
        });
        const tokenData = await tokenResponse.json();
        
        await syncAccount(supabaseClient, setting.account_id, tokenData.access_token);
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

async function syncAccount(supabaseClient: any, accountId: string, accessToken: string) {
  // 1. Fetch settings
  const { data: setting } = await supabaseClient
    .from("bank_email_sync_settings")
    .select("*")
    .eq("account_id", accountId)
    .single();

  if (!setting) throw new Error("Settings not found");

  // 2. Query Gmail API
  const query = encodeURIComponent(`from:${setting.bank_sender_address}`);
  const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=5`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  const listData = await listResponse.json();
  if (!listData.messages || listData.messages.length === 0) return;

  // Process the most recent message
  const msgResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${listData.messages[0].id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const msgData = await msgResponse.json();
  
  // Extract body
  let bodyData = "";
  if (msgData.payload.parts) {
    const part = msgData.payload.parts.find((p: any) => p.mimeType === "text/plain") || msgData.payload.parts[0];
    if (part?.body?.data) {
      const base64Url = part.body.data;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const binString = atob(base64);
      bodyData = new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0)!));
    }
  } else if (msgData.payload.body.data) {
    const base64Url = msgData.payload.body.data;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const binString = atob(base64);
    bodyData = new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0)!));
  }

  const parsed = parseEmailBody(bodyData, setting.bank_name);

  if (parsed) {
    // 3. Record transaction
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
    if (!txError || txError.code === '23505') { // Ignore duplicate reference error
      await supabaseClient
        .from("accounts")
        .update({ 
          balance: parsed.balanceAfter,
          last_synced_at: new Date().toISOString(),
          sync_status: 'active'
        })
        .eq("id", setting.account_id);
    }
  }
}

function parseEmailBody(body: string, bank: string) {
  const patterns = {
    amount: /Amount:\s*(?:NGN|₦)?\s*([\d,]+\.\d{2})/i,
    availableBalance: /Available Balance:\s*(?:NGN|₦)?\s*([\d,]+\.\d{2})/i,
    currentBalance: /(?:Current )?Balance:\s*(?:NGN|₦)?\s*([\d,]+\.\d{2})/i,
    type: /(?:Type|Credit\/Debit|Transaction Type|Txn Type):\s*(Credit|Debit)/i,
    ref: /(?:Ref|Reference|Trace ID|Receipt No):\s*([^\n\r]+)/i,
    desc: /(?:Description|Remarks|Narration|Details):\s*([^\n\r]+)/i,
    date: /(?:Date\/time|Date|Time):\s*([^\n\r]+)/i
  };

  const amountMatch = body.match(patterns.amount);
  const availableBalanceMatch = body.match(patterns.availableBalance);
  const currentBalanceMatch = body.match(patterns.currentBalance);
  const balanceMatch = availableBalanceMatch || currentBalanceMatch;
  const typeMatch = body.match(patterns.type);
  const refMatch = body.match(patterns.ref);
  const descMatch = body.match(patterns.desc);
  const dateMatch = body.match(patterns.date);

  if (!amountMatch || !typeMatch) return null;

  let txDate = new Date().toISOString();
  if (dateMatch) {
    const parsedDate = new Date(dateMatch[1].trim());
    if (!isNaN(parsedDate.getTime())) {
      txDate = parsedDate.toISOString();
    }
  }

  return {
    amount: parseFloat(amountMatch[1].replace(/,/g, "")),
    balanceAfter: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, "")) : 0,
    type: typeMatch[1].toLowerCase() === 'credit' ? 'income' : 'expense',
    reference: refMatch ? refMatch[1].trim() : `EMAIL-${Date.now()}`,
    description: descMatch ? descMatch[1].trim() : `Transaction via ${bank}`,
    date: txDate
  };
}
