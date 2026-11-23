// Supabase Edge Function: run-monthly-depreciation
// Scheduled monthly to post balanced depreciation journal entries (Dr 6130 / Cr 15x9)
// for all active fixed assets across businesses.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLASS_TO_ACCUM: Record<string, string> = {
  'Leasehold Land & Buildings': '1519 Accumulated Depreciation - Buildings',
  'Plant & Heavy Machinery': '1529 Accumulated Depreciation - Plant & Machinery',
  'Commercial Motor Vehicles': '1539 Accumulated Depreciation - Motor Vehicles',
  'Office Furniture & Equipment': '1549 Accumulated Depreciation - Office Furniture',
  'Computer & IT Infrastructure': '1559 Accumulated Depreciation - Computer & IT',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const periodMonth = `${y}-${String(m).padStart(2, '0')}`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const deprDate = `${periodMonth}-${String(lastDay).padStart(2, '0')}`;

    const { data: assets, error } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('status', 'Active')
      .lte('date_acquired', deprDate);
    if (error) throw error;

    let postedCount = 0;

    for (const asset of assets || []) {
      // Skip if already run for this month
      const { data: existing } = await supabase
        .from('fixed_asset_depreciation_runs')
        .select('id')
        .eq('fixed_asset_id', asset.id)
        .eq('period_month', periodMonth)
        .maybeSingle();
      if (existing) continue;

      const cost = Number(asset.historical_cost) || 0;
      const salvage = Number(asset.salvage_value) || 0;
      const accum = Number(asset.accumulated_depreciation ?? asset.prior_accum_depr ?? 0);
      const remaining = Math.max(0, cost - salvage - accum);
      if (remaining <= 0.01) continue;

      let monthly = 0;
      if (asset.depreciation_method === 'reducing_balance') {
        monthly = ((Math.max(0, cost - accum) * (Number(asset.annual_rate_pct) || 20)) / 100) / 12;
      } else {
        monthly = Math.max(0, cost - salvage) / Math.max(1, Number(asset.useful_life_months) || 60);
      }
      monthly = Math.round(Math.min(monthly, remaining) * 100) / 100;
      if (monthly <= 0) continue;

      const name = asset.asset_name || asset.description;
      const accumAccount = CLASS_TO_ACCUM[asset.asset_class] || '1549 Accumulated Depreciation - Office Furniture';

      const { data: je, error: jeErr } = await supabase
        .from('journal_entries')
        .insert({
          user_id: asset.user_id,
          entry_number: `DEPR-${periodMonth}-${String(Date.now()).slice(-4)}`,
          date: deprDate,
          description: `Monthly Depreciation (${periodMonth}) — ${name}`,
          reference: `DEPR-${periodMonth}`,
          source: 'auto',
          is_posted: true,
        })
        .select('id')
        .single();
      if (jeErr || !je) continue; // Respects accounting_lock_date trigger automatically

      await supabase.from('journal_entry_lines').insert([
        {
          journal_entry_id: je.id,
          account_name: '6130 Depreciation Expense (P&L)',
          description: `Monthly depreciation — ${name}`,
          debit: monthly,
          credit: 0,
        },
        {
          journal_entry_id: je.id,
          account_name: accumAccount,
          description: `Accumulated depreciation — ${name}`,
          debit: 0,
          credit: monthly,
        },
      ]);

      const nextAccum = Math.round((accum + monthly) * 100) / 100;
      const nextNbv = Math.max(0, Math.round((cost - nextAccum) * 100) / 100);

      await supabase.from('fixed_asset_depreciation_runs').insert({
        user_id: asset.user_id,
        fixed_asset_id: asset.id,
        period_month: periodMonth,
        depreciation_date: deprDate,
        depreciation_amount: monthly,
        accumulated_after: nextAccum,
        net_book_value_after: nextNbv,
        journal_entry_id: je.id,
      });

      await supabase
        .from('fixed_assets')
        .update({
          accumulated_depreciation: nextAccum,
          prior_accum_depr: nextAccum,
          last_depreciation_date: deprDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', asset.id);

      postedCount++;
    }

    return new Response(JSON.stringify({ ok: true, periodMonth, postedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
