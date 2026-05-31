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

      // 2. Save the refresh token (only save if we actually got a refresh_token;
      //    Google only returns it on the first authorization or when prompt=consent).
      //    Never fall back to access_token — it's short-lived and will cause
      //    invalid_grant errors on the next cron sync.
      if (!tokenData.refresh_token) {
        throw new Error(
          "Google did not return a refresh_token. " +
          "Please revoke ROVA's Gmail access at myaccount.google.com/permissions and reconnect."
        );
      }

      const { error: updateError } = await supabaseClient
        .from("bank_email_sync_settings")
        .update({ refresh_token: tokenData.refresh_token })
        .eq("account_id", accountId);

      if (updateError) throw updateError;

      // 3. Trigger an immediate initial sync for this account
      const syncResult = await syncAccount(supabaseClient, accountId, tokenData.access_token);

      return new Response(JSON.stringify({ success: true, syncResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // -------------------------------------------------------------
    // ACTION: DEBUG EMAIL (Returns raw email body for inspection)
    // No accessToken needed — uses stored refresh token automatically
    // -------------------------------------------------------------
    if (body.action === 'debug_email') {
      const { accountId } = body;

      const { data: setting } = await supabaseClient
        .from("bank_email_sync_settings")
        .select("*")
        .eq("account_id", accountId)
        .single();

      if (!setting) throw new Error("Settings not found for account: " + accountId);
      if (!setting.refresh_token) throw new Error("No refresh token stored — please re-link Gmail");

      // Get a fresh access token using the stored refresh token
      const clientId = Deno.env.get("GMAIL_CLIENT_ID");
      const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: setting.refresh_token,
          grant_type: "refresh_token"
        })
      });
      const tokenData = await tokenResponse.json();
      if (tokenData.error) throw new Error(`Token refresh failed: ${tokenData.error_description || tokenData.error}`);

      const accessToken = tokenData.access_token;
      // Apply the same connected_at cutoff in debug mode too
      const connectedAt = new Date(setting.created_at);
      const afterDate = `${connectedAt.getUTCFullYear()}/${String(connectedAt.getUTCMonth() + 1).padStart(2, '0')}/${String(connectedAt.getUTCDate()).padStart(2, '0')}`;
      const senders = setting.bank_sender_address.split(/,| OR /i).map((s: string) => s.trim()).filter(Boolean);
      // If entry is a full email address use as-is; if it's domain-only prefix with @ for Gmail search
      const fromQuery = senders.map((s: string) => s.includes('@') ? `from:${s}` : `from:@${s}`).join(' OR ');
      const query = encodeURIComponent(`(${fromQuery}) after:${afterDate}`);
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=3`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const listData = await listResponse.json();

      if (listData.error) {
        return new Response(JSON.stringify({ error: `Gmail API: ${listData.error.message}`, senderQueried: setting.bank_sender_address }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!listData.messages || listData.messages.length === 0) {
        return new Response(JSON.stringify({ error: "No emails found from this sender", senderQueried: setting.bank_sender_address }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${listData.messages[0].id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msgData = await msgResponse.json();
      const { plainText, htmlText } = extractEmailBody(msgData.payload);
      const cleanedText = htmlText ? stripHtml(htmlText) : plainText;

      return new Response(JSON.stringify({
        senderQueried: setting.bank_sender_address,
        emailCount: listData.messages.length,
        subject: msgData.payload.headers?.find((h: any) => h.name === 'Subject')?.value,
        rawPlainText: plainText.substring(0, 3000),
        rawHtmlStripped: cleanedText.substring(0, 3000),
        parseResult: parseEmailBody(cleanedText, setting.bank_name, listData.messages[0].id, msgData.internalDate),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------
    // DEFAULT ACTION: SYNC ALL ACCOUNTS
    // -------------------------------------------------------------
    const { data: syncSettings, error: fetchError } = await supabaseClient
      .from("bank_email_sync_settings")
      .select("*")
      .not("refresh_token", "is", null);

    if (fetchError) throw fetchError;

    const results = [];
    const clientId = Deno.env.get("GMAIL_CLIENT_ID");
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in edge function environment");
    }

    for (const setting of syncSettings || []) {
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

        if (tokenData.error) {
          throw new Error(`Token refresh failed: ${tokenData.error_description || tokenData.error}`);
        }

        const syncResult = await syncAccount(supabaseClient, setting.account_id, tokenData.access_token);
        results.push({ accountId: setting.account_id, status: "success", ...syncResult });
      } catch (err: any) {
        console.error(`Sync failed for account ${setting.account_id}:`, err);
        results.push({ accountId: setting.account_id, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

// ------------------------------------------------------------------
// Recursively extract plain text and HTML from a MIME payload
// ------------------------------------------------------------------
function extractEmailBody(payload: any): { plainText: string; htmlText: string } {
  let plainText = "";
  let htmlText = "";

  function decodeBase64(data: string): string {
    try {
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      const binString = atob(base64);
      return new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0)!));
    } catch {
      return "";
    }
  }

  function traverse(part: any) {
    if (!part) return;

    if (part.mimeType === "text/plain" && part.body?.data) {
      plainText += decodeBase64(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data) {
      htmlText += decodeBase64(part.body.data);
    } else if (part.body?.data && !part.mimeType?.startsWith("multipart")) {
      // Fallback for unknown single-part
      plainText += decodeBase64(part.body.data);
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        traverse(subPart);
      }
    }
  }

  traverse(payload);
  return { plainText, htmlText };
}

// ------------------------------------------------------------------
// Strip HTML tags and decode HTML entities for plain text parsing
// ------------------------------------------------------------------
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(td|th|tr|div|p|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8358;/gi, '₦')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ------------------------------------------------------------------
// Sync a single account: fetch emails → parse → update DB
// ------------------------------------------------------------------
async function syncAccount(supabaseClient: any, accountId: string, accessToken: string) {
  // 1. Fetch settings and account info
  const { data: setting } = await supabaseClient
    .from("bank_email_sync_settings")
    .select("*, accounts(last_synced_at)")
    .eq("account_id", accountId)
    .single();

  if (!setting) throw new Error("Settings not found");

  // 2. Build Gmail query — only fetch emails AFTER the bank was connected.
  //    We use `created_at` (set at the moment the user linked the bank) as the
  //    hard cutoff so historic emails are NEVER imported.
  const connectedAt = new Date(setting.created_at);
  // Gmail `after:` operator accepts YYYY/MM/DD (UTC date is fine as a floor)
  const afterDate = `${connectedAt.getUTCFullYear()}/${String(connectedAt.getUTCMonth() + 1).padStart(2, '0')}/${String(connectedAt.getUTCDate()).padStart(2, '0')}`;

  const senders = setting.bank_sender_address.split(/,| OR /i).map((s: string) => s.trim()).filter(Boolean);
  // If entry is a full email address use as-is; if it's domain-only prefix with @ for Gmail search
  const fromQuery = senders.map((s: string) => s.includes('@') ? `from:${s}` : `from:@${s}`).join(' OR ');
  // Enforce the connection-date cutoff on every sync — initial AND recurring cron
  const query = encodeURIComponent(`(${fromQuery}) after:${afterDate}`);
  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=25`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const listData = await listResponse.json();

  // Surface any Gmail API errors (e.g. expired token, bad scope)
  if (listData.error) {
    throw new Error(`Gmail API error: ${listData.error.code} ${listData.error.message}`);
  }

  console.log(`Gmail query: ${fromQuery} → found ${listData.messages?.length ?? 0} messages`);

  if (!listData.messages || listData.messages.length === 0) {
    return { emailsFound: 0, transactionsSaved: 0, gmailQuery: fromQuery };
  }

  let latestBalance: number | null = null;
  let transactionsSaved = 0;

  // Process emails from newest to oldest — stop after first successful parse
  for (const msg of listData.messages) {
    const msgResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msgData = await msgResponse.json();

    const { plainText, htmlText } = extractEmailBody(msgData.payload);

    // Prefer HTML stripped version since most bank emails are HTML
    const textToparse = htmlText ? stripHtml(htmlText) : plainText;

    console.log(`Parsing email ${msg.id}, text length: ${textToparse.length}`);

    const parsed = parseEmailBody(textToparse, setting.bank_name, msg.id, msgData.internalDate);

    if (parsed) {
      console.log(`Parsed successfully:`, JSON.stringify(parsed));

      // Track the most recent balance
      if (latestBalance === null && parsed.balanceAfter > 0) {
        latestBalance = parsed.balanceAfter;
      }

      // 3. Deduplicate by reference — always try to insert, skip if already exists.
      //    We no longer filter by linkDate here because:
      //    (a) the initial sync already ran at link time via exchange_token,
      //    (b) cron re-syncs need to catch any emails that failed to parse the first time,
      //    (c) the duplicate reference check below is the correct guard.
      const { data: existingTx } = await supabaseClient
        .from("transactions")
        .select("id")
        .eq("account_id", setting.account_id)
        .eq("reference", parsed.reference)
        .maybeSingle();

      if (existingTx) {
        console.log(`Transaction ${parsed.reference} already exists, skipping.`);
        transactionsSaved++; // Count as successfully processed
        continue;
      }

      const { data: txData, error: txError } = await supabaseClient
        .from("transactions")
        .insert({
          user_id: setting.user_id,
          account_id: setting.account_id,
          amount: parsed.amount,
          type: parsed.type,
          description: parsed.description,
          date: parsed.date,
          created_at: parsed.date,
          reference: parsed.reference,
          source: 'email',
          is_verified: true
        })
        .select()
        .single();

      if (!txError || txError.code === '23505') {
        transactionsSaved++;

        // ── Call ai-classify to classify and detect intents ──────────────
        if (txData?.id) {
          try {
            await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-classify`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  transaction: {
                    id: txData.id,
                    description: parsed.description,
                    amount: parsed.amount,
                    type: parsed.type,
                    date: parsed.date,
                  },
                  userId: setting.user_id,
                  mode: "full",
                }),
              }
            );
          } catch (classifyErr) {
            console.error("ai-classify call failed (non-fatal):", classifyErr);
          }
        }
      }
    } else {
      console.log(`Could not parse email ${msg.id}`);
    }
  }

  // 4. Update account balance with the most recent balance we found
  if (latestBalance !== null) {
    await supabaseClient
      .from("accounts")
      .update({
        balance: latestBalance,
        last_synced_at: new Date().toISOString(),
        sync_status: 'active'
      })
      .eq("id", setting.account_id);
  } else {
    // Still update last_synced_at even if no balance was parsed
    await supabaseClient
      .from("accounts")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", setting.account_id);
  }

  return { emailsFound: listData.messages.length, transactionsSaved, latestBalance };
}

// ------------------------------------------------------------------
// Parse email text for Nigerian bank transaction data
// ------------------------------------------------------------------
function parseEmailBody(body: string, bank: string, msgId: string, internalDate?: string) {
  // Normalize: remove excess whitespace but keep newlines
  const text = body.replace(/[ \t]+/g, ' ').trim();

  // ---- AMOUNT ----
  // First Bank format: "Amount  30,000.00 CR" (CR = credit, DR = debit as suffix)
  // FCMB format:       "Amount: 1,000.00 (NGN)"
  // GTBank/Zenith:     "NGN 5,000.00"
  const amountPatterns = [
    // First Bank: "Amount  30,000.00 CR" or "Amount 30,000.00 DR"
    /(?:amount|transaction amount|txn amount)[:\s]*([,\d]+(?:\.\d{1,2})?)\s*(CR|DR)\b/i,
    // Standard: "Amount: NGN 1,000.00"
    /(?:amount|transaction amount|txn amount)[:\s]*(?:NGN|₦|ngn)?\s*([\d,]+(?:\.\d{1,2})?)(?:\s*\(NGN\)|\s*NGN)?/i,
    // Prefix NGN/₦ e.g. "₦5,000.00"
    /(?:NGN|₦)\s*([\d,]+(?:\.\d{1,2})?)/i,
    // Suffix NGN/₦ e.g. "5,000.00 NGN"
    /([\d,]+(?:\.\d{2}))\s*(?:NGN|₦|\(NGN\))/i,
  ];

  // ---- BALANCE ----
  // First Bank: "Cleared Balance  NGN57,744.27 CR"
  // FCMB:       "Available Balance: 9,349.81 (NGN)"
  const availableBalancePatterns = [
    /(?:available balance)[:\s]*(?:NGN|₦|ngn)?\s*([\d,]+(?:\.\d{1,2})?)(?:\s*\(NGN\)|\s*NGN|\s*CR|\s*DR)?/i,
  ];

  const otherBalancePatterns = [
    // First Bank: "Cleared Balance  NGN57,744.27 CR"
    /(?:cleared balance|ledger balance)[:\s]*(?:NGN|₦|ngn)?\s*([\d,]+(?:\.\d{1,2})?)(?:\s*CR|\s*DR)?/i,
    /(?:new balance|current balance|account balance|balance after|bal)[:\s]*(?:NGN|₦|ngn)?\s*([\d,]+(?:\.\d{1,2})?)(?:\s*\(NGN\)|\s*NGN)?/i,
    /(?:NGN|₦)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:available|balance)/i,
  ];

  // ---- TYPE ----
  // First Bank: amount ends with "CR" (credit) or "DR" (debit)
  // FCMB:       "Credit/Debit: Debit"
  // Others:     "your account has been credited"
  const typePatterns = [
    // First Bank CR/DR suffix on the amount line
    /(?:amount|transaction amount|txn amount)[:\s]*[\d,]+(?:\.\d{1,2})?\s*(CR|DR)\b/i,
    // Labeled credit/debit field
    /(?:transaction type|txn type|type|credit\/debit)[:\s]*(credit|debit)/i,
    /\b(credited|debited)\b/i,
    /\b(credit|debit)\s+(?:alert|notification|transaction)/i,
    /your account (?:has been )?(credited|debited)/i,
    // Standalone CR/DR near balance line (fallback)
    /\bNGN[\d,]+(?:\.\d{1,2})?\s*(CR|DR)\b/i,
  ];

  // ---- REFERENCE ----
  // First Bank narration: "CPWInward: 100004260517135717160126116469 /MAYOKUN V"
  //   → extract the long numeric string as reference
  const refPatterns = [
    /(?:reference|ref no|ref|receipt no|trace id|session id)[:\s#]*([A-Z0-9\/\-]{5,30})/i,
    /(?:tran id|transaction id|trans id)[:\s]*([A-Z0-9\/\-]{5,30})/i,
    // First Bank / inward transfer narration: long digit string
    /(?:CPWInward|NIPInward|NIPOutward|Transfer)[:\s]*(\d{10,30})/i,
  ];

  // ---- DESCRIPTION / NARRATION ----
  // Universal: whichever field the bank uses — "Narration" or "Description" —
  // it gets mapped to the description column in ROVA. Try both, same order for all banks.
  const descPatterns = [
    // Same-line: "Narration: ..." or "Description: ..."
    /(?:narration|description)\s*:?\s*([\w][^\n\r]{3,120})/i,
    // Next-line: label on one line, value on the next
    /(?:narration|description)\s*:?\s*\r?\n\s*([^\n\r]{3,120})/i,
    // Wider fallback: remarks / details / info
    /(?:remarks|details|info)\s*:?\s*([\w][^\n\r]{3,120})/i,
    // Generic transfer fallback
    /(?:payment for|transfer to|transfer from|from)[:\s]*([^\n\r]{3,60})/i,
  ];


  // ---- DATE ----
  const datePatterns = [
    /(?:date[\/\s]?time|date|time|transaction date)[:\s]*([^\n\r]{5,30})/i,
    // e.g. "15-Jan-2025 10:30 AM" — fixed: was \\w{3} (literal backslash-w) instead of \w{3}
    /(\d{1,2}[\/\-]\w{3}[\/\-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?)/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?)/i,
    /(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?)/i,
  ];

  // Find first match across multiple patterns
  function findMatch(patterns: RegExp[]): RegExpMatchArray | null {
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m;
    }
    return null;
  }

  const amountMatch = findMatch(amountPatterns);
  let balanceMatch = findMatch(availableBalancePatterns);
  if (!balanceMatch) {
    balanceMatch = findMatch(otherBalancePatterns);
  }
  const typeMatch = findMatch(typePatterns);
  const refMatch = findMatch(refPatterns);
  const descMatch = findMatch(descPatterns);

  // Amount is required; type is required
  if (!amountMatch) {
    console.log("Parse failed: no amount found");
    return null;
  }
  if (!typeMatch) {
    console.log("Parse failed: no transaction type found");
    return null;
  }

  // Parse amount — group 1 is always the numeric string
  const amountStr = amountMatch[1].replace(/,/g, '');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;

  // Parse balance
  let balanceAfter = 0;
  if (balanceMatch) {
    balanceAfter = parseFloat(balanceMatch[1].replace(/,/g, ''));
    if (isNaN(balanceAfter)) balanceAfter = 0;
  }

  // Parse transaction type
  // typeMatch[1] can be "credit", "debit", "credited", "debited", "CR", or "DR"
  const typeRaw = typeMatch[1].toLowerCase();
  const isCredit = typeRaw === 'cr' || typeRaw.includes('credit');
  const txType = isCredit ? 'income' : 'expense';

  // Parse date using the exact time Gmail received the email (most reliable)
  const txDate = internalDate ? new Date(parseInt(internalDate)).toISOString() : new Date().toISOString();

  // Build description from the matched field (Narration for First Bank, Description for others).
  // The descPatterns above already target the correct labeled field per bank.
  let description = descMatch ? descMatch[1].trim() : null;

  // Last-resort fallback if nothing was captured
  if (!description || description.length < 3) {
    description = `${isCredit ? 'Credit' : 'Debit'} via ${bank}`;
  }

  return {
    amount,
    balanceAfter,
    type: txType,
    reference: refMatch ? refMatch[1].trim() : `EMAIL-${msgId}`,
    description: description,
    date: txDate
  };
}

