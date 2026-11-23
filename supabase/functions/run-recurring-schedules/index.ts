// Supabase Edge Function: run-recurring-schedules
// Scheduled via pg_cron / GitHub Actions to auto-generate recurring invoices & vendor bills.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function computeNextRunDate(dateStr: string, frequency: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === 'biweekly') d.setUTCDate(d.getUTCDate() + 14);
  else if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else if (frequency === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3);
  else if (frequency === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().slice(0, 10);

    const { data: dueSchedules, error } = await supabase
      .from('recurring_schedules')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_date', today);

    if (error) throw error;

    let generated = 0;
    const errors: string[] = [];

    for (const sched of dueSchedules || []) {
      try {
        const runDate = sched.next_run_date;
        const dueObj = new Date(`${runDate}T00:00:00Z`);
        dueObj.setUTCDate(dueObj.getUTCDate() + 14);
        const dueDate = dueObj.toISOString().slice(0, 10);

        if (sched.entity_type === 'invoice') {
          const invNo = `INV-REC-${String(Date.now()).slice(-5)}`;
          const vatAmt = Math.round(Number(sched.subtotal || 0) * (Number(sched.vat_rate || 0) / 100) * 100) / 100;
          const { data: inv, error: invErr } = await supabase
            .from('invoices')
            .insert({
              user_id: sched.user_id,
              invoice_number: invNo,
              customer_id: sched.customer_id || null,
              client_name: sched.customer_name || sched.title,
              client_email: sched.customer_email || '',
              issue_date: runDate,
              due_date: dueDate,
              subtotal: sched.subtotal,
              tax_rate: sched.vat_rate || 0,
              tax_amount: vatAmt,
              total: sched.total,
              status: sched.auto_send ? 'sent' : 'draft',
              notes: sched.notes || `Auto-generated from recurring schedule: ${sched.title}`,
            })
            .select('id')
            .single();
          if (invErr) throw invErr;

          if (inv && Array.isArray(sched.items_json) && sched.items_json.length > 0) {
            await supabase.from('invoice_items').insert(
              sched.items_json.map((it: any) => ({
                invoice_id: inv.id,
                description: it.description,
                quantity: it.quantity,
                unit_price: it.unit_price,
                amount: Math.round(Number(it.quantity) * Number(it.unit_price) * 100) / 100,
              }))
            );
          }

          await supabase.from('activity_logs').insert({
            owner_id: sched.user_id,
            user_id: sched.user_id,
            action: 'created',
            entity_type: 'recurring_invoice',
            entity_id: inv?.id || sched.id,
            entity_label: `Auto-generated recurring invoice ${invNo}`,
          });
        } else {
          const billNo = `BILL-REC-${String(Date.now()).slice(-5)}`;
          const { data: bill, error: billErr } = await supabase
            .from('bills')
            .insert({
              user_id: sched.user_id,
              bill_number: billNo,
              vendor: sched.vendor_name || sched.title,
              description: sched.notes || sched.title,
              bill_date: runDate,
              due_date: dueDate,
              amount: sched.total,
              category_id: sched.category_id || null,
              status: 'unpaid',
            })
            .select('id')
            .single();
          if (billErr) throw billErr;

          await supabase.from('activity_logs').insert({
            owner_id: sched.user_id,
            user_id: sched.user_id,
            action: 'created',
            entity_type: 'recurring_bill',
            entity_id: bill?.id || sched.id,
            entity_label: `Auto-generated recurring bill ${billNo}`,
          });
        }

        const nextRun = computeNextRunDate(runDate, sched.frequency);
        const reachedEnd = Boolean(sched.end_date && nextRun > sched.end_date);

        await supabase
          .from('recurring_schedules')
          .update({
            next_run_date: nextRun,
            last_run_at: new Date().toISOString(),
            runs_count: (sched.runs_count || 0) + 1,
            is_active: reachedEnd ? false : true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sched.id);

        generated++;
      } catch (e: any) {
        errors.push(`Schedule ${sched.id}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: (dueSchedules || []).length, generated, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
