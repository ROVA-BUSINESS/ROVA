import { useEffect, useState, type FormEvent } from 'react';
import {
  Repeat, Plus, Play, Pause, Trash2, Bell, Check, Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../lib/format';
import {
  type RecurringScheduleRecord,
  type InvoiceReminderRuleRecord,
  type ReminderLogRecord,
  runRecurringScheduleOnce,
} from '../../lib/smeAccountingService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

export default function RecurringSchedulesPage() {
  const { user, isStaff, staffData } = useAuth();
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;

  const [tab, setTab] = useState<'recurring' | 'reminders'>('recurring');
  const [schedules, setSchedules] = useState<RecurringScheduleRecord[]>([]);
  const [reminderLogs, setReminderLogs] = useState<ReminderLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Recurring modal state
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [form, setForm] = useState({
    entity_type: 'invoice' as 'invoice' | 'bill',
    title: '',
    customer_name: '',
    customer_email: '',
    vendor_name: '',
    frequency: 'monthly' as RecurringScheduleRecord['frequency'],
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    amount: '',
    vat_rate: '0',
    auto_send: false,
    notes: '',
  });

  // Overdue reminder rules state
  const [rule, setRule] = useState<InvoiceReminderRuleRecord>({
    user_id: effectiveUserId || '',
    enabled: false,
    days_before_due: [3],
    remind_on_due_date: true,
    days_after_due: [3, 7, 14],
    channel_email: true,
    channel_whatsapp: false,
    channel_in_app: true,
    custom_message: 'Friendly reminder regarding your invoice. Please use the payment link below to settle at your convenience.',
  });
  const [daysBeforeText, setDaysBeforeText] = useState('3');
  const [daysAfterText, setDaysAfterText] = useState('3, 7, 14');
  const [savingRule, setSavingRule] = useState(false);
  const [ruleSaved, setRuleSaved] = useState(false);

  useEffect(() => {
    if (effectiveUserId) loadData();
  }, [effectiveUserId]);

  async function loadData() {
    setLoading(true);
    const [schedRes, ruleRes, logsRes] = await Promise.all([
      supabase.from('recurring_schedules').select('*').eq('user_id', effectiveUserId).order('next_run_date', { ascending: true }),
      supabase.from('invoice_reminder_rules').select('*').eq('user_id', effectiveUserId).maybeSingle(),
      supabase.from('reminder_logs').select('*').eq('user_id', effectiveUserId).order('sent_at', { ascending: false }).limit(30),
    ]);

    setSchedules((schedRes.data as RecurringScheduleRecord[]) || []);
    setReminderLogs((logsRes.data as ReminderLogRecord[]) || []);

    if (ruleRes.data) {
      const r = ruleRes.data as InvoiceReminderRuleRecord;
      setRule(r);
      setDaysBeforeText((r.days_before_due || []).join(', '));
      setDaysAfterText((r.days_after_due || []).join(', '));
    }
    setLoading(false);
  }

  async function handleSaveSchedule(e: FormEvent) {
    e.preventDefault();
    if (!effectiveUserId || !form.title.trim()) return;
    const sub = Number(form.amount) || 0;
    if (sub <= 0) return;

    setSaving(true);
    try {
      const vatPct = Number(form.vat_rate) || 0;
      const total = Math.round((sub + sub * (vatPct / 100)) * 100) / 100;

      const { error } = await supabase.from('recurring_schedules').insert({
        user_id: effectiveUserId,
        entity_type: form.entity_type,
        title: form.title.trim(),
        customer_name: form.entity_type === 'invoice' ? (form.customer_name.trim() || form.title.trim()) : '',
        customer_email: form.entity_type === 'invoice' ? form.customer_email.trim() : '',
        vendor_name: form.entity_type === 'bill' ? (form.vendor_name.trim() || form.title.trim()) : '',
        frequency: form.frequency,
        start_date: form.start_date,
        next_run_date: form.start_date,
        end_date: form.end_date || null,
        auto_send: form.auto_send,
        default_status: form.entity_type === 'invoice' ? (form.auto_send ? 'sent' : 'draft') : 'unpaid',
        subtotal: sub,
        vat_rate: vatPct,
        total,
        items_json: [{ description: form.title.trim(), quantity: 1, unit_price: sub }],
        notes: form.notes.trim(),
        is_active: true,
      });

      if (error) throw error;
      setShowModal(false);
      setForm({
        entity_type: 'invoice', title: '', customer_name: '', customer_email: '', vendor_name: '',
        frequency: 'monthly', start_date: new Date().toISOString().slice(0, 10), end_date: '',
        amount: '', vat_rate: '0', auto_send: false, notes: '',
      });
      loadData();
    } catch (err: any) {
      alert('Failed to create schedule: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow(s: RecurringScheduleRecord) {
    setRunningId(s.id);
    try {
      await runRecurringScheduleOnce(s, user?.id || s.user_id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to generate recurring record.');
    } finally {
      setRunningId(null);
    }
  }

  async function toggleActive(s: RecurringScheduleRecord) {
    await supabase.from('recurring_schedules').update({ is_active: !s.is_active }).eq('id', s.id);
    setSchedules((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
  }

  async function deleteSchedule(id: string) {
    if (!window.confirm('Delete this recurring schedule?')) return;
    await supabase.from('recurring_schedules').delete().eq('id', id);
    setSchedules((prev) => prev.filter((x) => x.id !== id));
  }

  async function handleSaveReminderRules(e: FormEvent) {
    e.preventDefault();
    if (!effectiveUserId) return;
    setSavingRule(true);
    try {
      const parseNums = (txt: string) =>
        txt.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);

      const payload = {
        user_id: effectiveUserId,
        enabled: rule.enabled,
        days_before_due: parseNums(daysBeforeText),
        remind_on_due_date: rule.remind_on_due_date,
        days_after_due: parseNums(daysAfterText),
        channel_email: rule.channel_email,
        channel_whatsapp: rule.channel_whatsapp,
        channel_in_app: rule.channel_in_app,
        custom_message: rule.custom_message,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('invoice_reminder_rules')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;

      setRuleSaved(true);
      setTimeout(() => setRuleSaved(false), 2500);
    } catch (err: any) {
      alert('Failed to save reminder rules: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingRule(false);
    }
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1160, margin: '0 auto', animation: 'fadeIn 0.25s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Automation: Recurring &amp; Overdue Reminders</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Auto-generate recurring invoices &amp; vendor bills on schedule, and automatically chase overdue invoices.
          </p>
        </div>
        {tab === 'recurring' && (
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>
            New Recurring Schedule
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', marginBottom: 22, gap: 2 }}>
        <button
          type="button"
          onClick={() => setTab('recurring')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === 'recurring' ? 'var(--accent-primary)' : 'transparent',
            color: tab === 'recurring' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <Repeat size={14} /> Recurring Invoices &amp; Bills
        </button>
        <button
          type="button"
          onClick={() => setTab('reminders')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === 'reminders' ? 'var(--accent-primary)' : 'transparent',
            color: tab === 'reminders' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <Bell size={14} /> Overdue Invoice Reminders
        </button>
      </div>

      {tab === 'recurring' ? (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20 }}>{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 8, marginBottom: 8 }} />)}</div>
          ) : schedules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <Repeat size={34} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>No recurring schedules yet</div>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
                Automate monthly retainers, rent bills, subscriptions, and recurring client invoices.
              </p>
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>Create First Schedule</Button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 740, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                    <th style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Schedule</th>
                    <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type &amp; Frequency</th>
                    <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Next Run</th>
                    <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s, idx) => (
                    <tr key={s.id} style={{ borderTop: idx > 0 ? '1px solid var(--bg-border)' : 'none' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{s.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {s.entity_type === 'invoice' ? `Customer: ${s.customer_name}` : `Vendor: ${s.vendor_name}`} · {s.runs_count || 0} runs
                        </div>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <Badge variant={s.entity_type === 'invoice' ? 'info' : 'warning'}>
                          {s.entity_type === 'invoice' ? 'Invoice' : 'Bill'} · {s.frequency}
                        </Badge>
                      </td>
                      <td style={{ padding: '14px 12px', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                        {formatDate(s.next_run_date)}
                        {s.end_date && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ends {formatDate(s.end_date)}</div>}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                        {formatCurrency(s.total)}
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <Badge variant={s.is_active ? 'success' : 'default'}>{s.is_active ? 'Active' : 'Paused'}</Badge>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <Button variant="secondary" size="sm" loading={runningId === s.id} onClick={() => handleRunNow(s)}>
                            Run Now
                          </Button>
                          <button
                            onClick={() => toggleActive(s)}
                            title={s.is_active ? 'Pause' : 'Resume'}
                            style={{ padding: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            {s.is_active ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button
                            onClick={() => deleteSchedule(s.id)}
                            title="Delete"
                            style={{ padding: 6, background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card>
            <form onSubmit={handleSaveReminderRules} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 3px' }}>Automated Overdue Invoice Reminders</h2>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
                    Automatically remind customers before, on, and after invoice due dates with their direct payment link included.
                  </p>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={rule.enabled} onChange={(e) => setRule({ ...rule, enabled: e.target.checked })} />
                  <span>{rule.enabled ? 'Reminders Active' : 'Paused'}</span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <Input
                  label="Days BEFORE due date (comma-separated)"
                  value={daysBeforeText}
                  onChange={(e) => setDaysBeforeText(e.target.value)}
                  placeholder="e.g. 3, 1"
                />
                <Input
                  label="Days AFTER due date / overdue (comma-separated)"
                  value={daysAfterText}
                  onChange={(e) => setDaysAfterText(e.target.value)}
                  placeholder="e.g. 3, 7, 14"
                />
              </div>

              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                  <input type="checkbox" checked={rule.remind_on_due_date} onChange={(e) => setRule({ ...rule, remind_on_due_date: e.target.checked })} />
                  <span>Send on Due Date</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                  <input type="checkbox" checked={rule.channel_email} onChange={(e) => setRule({ ...rule, channel_email: e.target.checked })} />
                  <span>Email</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                  <input type="checkbox" checked={rule.channel_whatsapp} onChange={(e) => setRule({ ...rule, channel_whatsapp: e.target.checked })} />
                  <span>WhatsApp</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                  <input type="checkbox" checked={rule.channel_in_app} onChange={(e) => setRule({ ...rule, channel_in_app: e.target.checked })} />
                  <span>In-App / Push Fallback</span>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Reminder Message Template
                </label>
                <textarea
                  rows={3}
                  value={rule.custom_message}
                  onChange={(e) => setRule({ ...rule, custom_message: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" type="submit" loading={savingRule} icon={ruleSaved ? <Check size={14} /> : undefined}>
                  {ruleSaved ? 'Rules Saved!' : 'Save Reminder Rules'}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Clock size={16} color="var(--text-muted)" />
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Recent Reminder Delivery Log</h3>
            </div>
            {reminderLogs.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '16px 0' }}>
                No overdue reminders dispatched yet. Duplicate reminders are automatically prevented per invoice &amp; rule milestone.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reminderLogs.map((log) => (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontSize: 12.5 }}>
                    <div>
                      <strong>{log.rule_key}</strong> · {log.channel} → {log.recipient || 'In-App'}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(log.sent_at)}</div>
                    </div>
                    <Badge variant={log.status === 'sent' ? 'success' : log.status === 'failed' ? 'error' : 'default'}>
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* New Recurring Schedule Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Recurring Schedule">
        <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['invoice', 'bill'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, entity_type: t })}
                style={{
                  flex: 1, padding: '9px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  background: form.entity_type === t ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: form.entity_type === t ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--bg-border)',
                }}
              >
                {t === 'invoice' ? 'Recurring Invoice' : 'Recurring Vendor Bill'}
              </button>
            ))}
          </div>

          <Input label="Schedule Title / Description" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Monthly Retainer or Office Rent" required />

          {form.entity_type === 'invoice' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Customer Name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
              <Input label="Customer Email" type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
            </div>
          ) : (
            <Input label="Vendor / Supplier Name" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} required />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as any })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 13 }}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 Weeks</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <Input label="Amount (₦)" type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Start / First Run Date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
            <Input label="End Date (optional)" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>

          {form.entity_type === 'invoice' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.auto_send} onChange={(e) => setForm({ ...form, auto_send: e.target.checked })} />
              <span>Automatically mark generated invoices as Sent</span>
            </label>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>Save Schedule</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
