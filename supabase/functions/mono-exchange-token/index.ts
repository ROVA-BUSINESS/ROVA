import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Extract the Bearer token from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or malformed Authorization header')
      return new Response(JSON.stringify({ error: 'Unauthorized: missing token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const jwt = authHeader.replace('Bearer ', '').trim()

    // Single service-role client for all DB operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Recommended Supabase Edge Function pattern: pass JWT directly to getUser()
    // This correctly verifies the token without relying on global header injection
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt)

    if (!user || userError) {
      console.error('JWT verification failed:', userError?.message ?? 'no user returned')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Authenticated user:', user.id)

    const { code } = await req.json()

    if (!code) {
      return new Response(JSON.stringify({ error: 'Code is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')

    if (!MONO_SECRET_KEY) {
      console.error('MONO_SECRET_KEY is not set')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 1: Exchange the one-time code for a Mono account ID (v2 API)
    console.log('Exchanging Mono code with v2 API...')
    const authResponse = await fetch('https://api.withmono.com/v2/accounts/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY,
      },
      body: JSON.stringify({ code }),
    })

    const authText = await authResponse.text()
    console.log('Mono auth response status:', authResponse.status, '| body:', authText)

    if (!authResponse.ok) {
      console.error('Mono auth error:', authText)
      return new Response(JSON.stringify({ error: `Failed to exchange token with Mono: ${authText}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authData = JSON.parse(authText)
    console.log('Mono auth parsed response:', JSON.stringify(authData))

    // Mono v2 API may return { id } at root OR wrapped as { data: { id } }
    const monoAccountId = authData.id ?? authData.data?.id ?? authData.data?.account?.id
    console.log('Mono account ID resolved:', monoAccountId)

    if (!monoAccountId) {
      console.error('No account ID in Mono response:', authData)
      return new Response(JSON.stringify({ error: 'Account ID not found in Mono response' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 2: Fetch full account details from Mono
    let accountName = 'Bank Account'
    let bankName = 'Bank'
    let accountNumber = ''
    let balance = 0
    let currency = 'NGN'

    try {
      // Step 2 uses v2 API endpoint: /v2/accounts/{id}
      const detailsResponse = await fetch(`https://api.withmono.com/v2/accounts/${monoAccountId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'mono-sec-key': MONO_SECRET_KEY,
        },
      })

      if (detailsResponse.ok) {
        const details = await detailsResponse.json()
        console.log('Mono account details:', JSON.stringify(details))

        // v2 API returns: { status, message, data: { account: { name, institution: { name }, account_number, balance, currency } } }
        // Fall back to older shapes just in case
        const acct = details?.data?.account || details?.account || details
        accountName   = acct.name                     || accountName
        bankName      = acct.institution?.name        || acct.institution || bankName
        accountNumber = acct.account_number           || acct.accountNumber || accountNumber
        // Mono always returns balance in kobo for NGN — always convert to naira
        const rawBalance = acct.balance ?? 0
        balance = rawBalance / 100
        currency = acct.currency || currency
        console.log(`Parsed account: name=${accountName}, bank=${bankName}, acctNo=${accountNumber}, balance=${balance}`)
      } else {
        const detailsErr = await detailsResponse.text()
        console.warn('Could not fetch Mono account details:', detailsErr)
      }
    } catch (detailsErr) {
      console.warn('Error fetching Mono account details:', detailsErr)
      // Non-fatal — continue with defaults
    }

    // Step 3: Upsert into connected_banks (full record)
    const { error: cbError } = await supabaseClient
      .from('connected_banks')
      .upsert({
        user_id: user.id,
        mono_account_id: monoAccountId,
        bank_name: bankName,
        account_name: accountName,
        account_number: accountNumber,
        currency,
        balance,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'mono_account_id' })

    if (cbError) {
      console.error('connected_banks upsert error:', cbError)
      // Non-fatal — still try to upsert accounts
    }

    // Step 4: Upsert into accounts table (what the app actually reads)
    // Use mono_account_id as unique key to prevent duplicates on reconnect
    const displayName = accountNumber
      ? `${bankName} (•••${accountNumber.slice(-4)})`
      : accountName || bankName

    const { error: accError } = await supabaseClient
      .from('accounts')
      .upsert({
        user_id: user.id,
        name: displayName,
        type: 'bank',
        institution: bankName,
        balance,
        currency,
        color: '#9333ea',
        is_active: true,
        mono_account_id: monoAccountId,
      }, { onConflict: 'mono_account_id' })

    if (accError) {
      // mono_account_id column may not exist yet — fall back to plain insert
      console.warn('accounts upsert with mono_account_id failed, trying plain insert:', accError)

      // Check if this mono account already exists in accounts via connected_banks
      const { data: existingAcc } = await supabaseClient
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('institution', bankName)
        .eq('name', displayName)
        .maybeSingle()

      if (!existingAcc) {
        const { error: insertError } = await supabaseClient
          .from('accounts')
          .insert({
            user_id: user.id,
            name: displayName,
            type: 'bank',
            institution: bankName,
            balance,
            currency,
            color: '#9333ea',
            is_active: true,
          });

        if (insertError) {
          console.error('accounts insert error:', insertError);
        }
      }
    }

    // Step 5: Fetch initial transactions history from Mono API and save to DB
    let transactionsSaved = 0;
    try {
      // Find the account ID in our database
      const { data: targetAccount } = await supabaseClient
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('mono_account_id', monoAccountId)
        .maybeSingle();

      const targetAccId = targetAccount?.id;

      console.log(`Fetching transactions for Mono account ${monoAccountId}...`);
      const txResponse = await fetch(`https://api.withmono.com/v2/accounts/${monoAccountId}/transactions?limit=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'mono-sec-key': MONO_SECRET_KEY,
        },
      });

      if (txResponse.ok) {
        const txData = await txResponse.json();
        const rawTxs = txData.data || txData.transactions || (Array.isArray(txData) ? txData : []);
        console.log(`Mono returned ${rawTxs.length} transactions.`);

        for (const rawTx of rawTxs) {
          const ref = rawTx._id || rawTx.reference || rawTx.id || `MONO-${Date.now()}-${Math.random()}`;
          const amountInNaira = (rawTx.amount || 0) / 100; // Mono returns amount in kobo
          const txType = rawTx.type === 'credit' ? 'income' : 'expense';
          const description = rawTx.narration || rawTx.description || `Mono Transaction (${bankName})`;
          const txDate = rawTx.date ? new Date(rawTx.date).toISOString() : new Date().toISOString();

          // Deduplicate by reference and account_id
          const { data: existingTx } = await supabaseClient
            .from('transactions')
            .select('id')
            .eq('user_id', user.id)
            .eq('reference', ref)
            .maybeSingle();

          if (existingTx) {
            console.log(`Transaction ref ${ref} already exists, skipping.`);
            continue;
          }

          const { data: newTx, error: insertTxErr } = await supabaseClient
            .from('transactions')
            .insert({
              user_id: user.id,
              account_id: targetAccId || null,
              amount: amountInNaira,
              type: txType,
              description: description,
              date: txDate,
              reference: ref,
              sync_source: 'mono',
              is_verified: true,
            })
            .select()
            .single();

          if (!insertTxErr && newTx?.id) {
            transactionsSaved++;

            // Trigger ROVA AI auto-classification
            try {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-classify`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  transaction: {
                    id: newTx.id,
                    description: description,
                    amount: amountInNaira,
                    type: txType,
                    date: txDate,
                  },
                  userId: user.id,
                  mode: 'full',
                }),
              });
            } catch (aiErr) {
              console.error('ai-classify failed for Mono transaction:', aiErr);
            }
          }
        }
      } else {
        const txErrText = await txResponse.text();
        console.warn('Mono transactions fetch failed:', txErrText);
      }
    } catch (monoTxErr) {
      console.error('Error fetching/saving Mono transactions:', monoTxErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        monoAccountId,
        accountName: displayName,
        bankName,
        balance,
        transactionsSaved,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});


