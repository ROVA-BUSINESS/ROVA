import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Building2, Plus, Play, Trash2, Calendar, CheckCircle2, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../lib/format';
import {
  type OperationalFixedAsset,
  type DepreciationRunRecord,
  ASSET_CLASS_COA,
  computeMonthlyDepreciationAmount,
  runMonthlyDepreciationBatch,
  disposeFixedAssetWithJournal,
  logActivity,
} from '../../lib/smeAccountingService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

const ASSET_CLASSES = Object.keys(ASSET_CLASS_COA) as OperationalFixedAsset['asset_class'][];

export default function FixedAssetsPage() {
  const { user, isStaff, staffData } = useAuth();
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;

  const [assets, setAssets] = useState<OperationalFixedAsset[]>([]);
  const [runs, setRuns] = useState<DepreciationRunRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [deprMonth, setDeprMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [runningDepr, setRunningDepr] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Add Asset Modal
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_name: '',
    asset_code: '',
    asset_class: 'Computer & IT Infrastructure' as OperationalFixedAsset['asset_class'],
    date_acquired: new Date().toISOString().slice(0, 10),
    historical_cost: '',
    salvage_value: '0',
    useful_life_months: '36',
    depreciation_method: 'straight_line' as 'straight_line' | 'reducing_balance',
    annual_rate_pct: '33.33',
  });

  // Dispose Asset Modal
  const [disposeTarget, setDisposeTarget] = useState<OperationalFixedAsset | null>(null);
  const [disposalDate, setDisposalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [disposalProceeds, setDisposalProceeds] = useState('0');
  const [disposalRemarks, setDisposalRemarks] = useState('');
  const [disposing, setDisposing] = useState(false);

  useEffect(() => {
    if (effectiveUserId) loadData();
  }, [effectiveUserId]);

  async function loadData() {
    setLoading(true);
    const [assetsRes, runsRes] = await Promise.all([
      supabase.from('fixed_assets').select('*').eq('user_id', effectiveUserId).order('date_acquired', { ascending: false }),
      supabase.from('fixed_asset_depreciation_runs').select('*').eq('user_id', effectiveUserId).order('period_month', { ascending: false }).limit(25),
    ]);
    setAssets((assetsRes.data as OperationalFixedAsset[]) || []);
    setRuns((runsRes.data as DepreciationRunRecord[]) || []);
    setLoading(false);
  }

  function handleClassChange(cls: OperationalFixedAsset['asset_class']) {
    const defaults = ASSET_CLASS_COA[cls];
    setForm((p) => ({
      ...p,
      asset_class: cls,
      useful_life_months: String(defaults.defaultLifeMonths),
      annual_rate_pct: String(defaults.defaultRatePct),
    }));
  }

  async function handleAddAsset(e: FormEvent) {
    e.preventDefault();
    if (!effectiveUserId || !form.asset_name.trim()) return;
    const cost = Number(form.historical_cost) || 0;
    if (cost <= 0) return;

    setSaving(true);
    try {
      const code = form.asset_code.trim() || `FA-${String(Date.now()).slice(-4)}`;
      const { data, error } = await supabase
        .from('fixed_assets')
        .insert({
          user_id: effectiveUserId,
          asset_code: code,
          asset_name: form.asset_name.trim(),
          description: form.asset_name.trim(),
          asset_class: form.asset_class,
          date_acquired: form.date_acquired,
          historical_cost: cost,
          salvage_value: Number(form.salvage_value) || 0,
          useful_life_months: Number(form.useful_life_months) || 60,
          depreciation_method: form.depreciation_method,
          annual_rate_pct: Number(form.annual_rate_pct) || 20,
          accumulated_depreciation: 0,
          prior_accum_depr: 0,
          opening_twdv: cost,
          status: 'Active',
        })
        .select('id')
        .single();

      if (error) throw error;

      await logActivity(
        effectiveUserId,
        user?.id || effectiveUserId,
        'created',
        'fixed_asset',
        data?.id || '',
        `Added fixed asset ${form.asset_name.trim()} (${formatCurrency(cost)})`
      );

      setShowAdd(false);
      setForm({
        asset_name: '', asset_code: '', asset_class: 'Computer & IT Infrastructure',
        date_acquired: new Date().toISOString().slice(0, 10), historical_cost: '',
        salvage_value: '0', useful_life_months: '36', depreciation_method: 'straight_line', annual_rate_pct: '33.33',
      });
      loadData();
    } catch (err: any) {
      alert('Failed to add fixed asset: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRunDepreciation() {
    if (!effectiveUserId) return;
    setRunningDepr(true);
    setStatusMsg(null);
    try {
      const res = await runMonthlyDepreciationBatch({
        userId: effectiveUserId,
        actorId: user?.id || effectiveUserId,
        periodMonth: deprMonth,
        assets,
      });
      if (res.postedCount === 0) {
        setStatusMsg({ type: 'ok', text: `No eligible assets to depreciate for ${deprMonth} (already posted or fully depreciated).` });
      } else {
        setStatusMsg({
          type: 'ok',
          text: `Posted ${deprMonth} depreciation for ${res.postedCount} asset(s): ${formatCurrency(res.totalDepreciation)} (Dr Depreciation Expense / Cr Accumulated Depreciation).`,
        });
      }
      await loadData();
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err.message || 'Failed to run monthly depreciation.' });
    } finally {
      setRunningDepr(false);
    }
  }

  async function handleConfirmDisposal(e: FormEvent) {
    e.preventDefault();
    if (!disposeTarget || !effectiveUserId) return;
    setDisposing(true);
    setStatusMsg(null);
    try {
      const res = await disposeFixedAssetWithJournal({
        userId: effectiveUserId,
        actorId: user?.id || effectiveUserId,
        asset: disposeTarget,
        disposalDate,
        proceeds: Number(disposalProceeds) || 0,
        remarks: disposalRemarks,
      });
      setStatusMsg({
        type: 'ok',
        text: `Disposed "${disposeTarget.asset_name || disposeTarget.description}". ${res.gainOrLoss >= 0 ? 'Gain' : 'Loss'} on disposal: ${formatCurrency(Math.abs(res.gainOrLoss))} posted to GL.`,
      });
      setDisposeTarget(null);
      setDisposalProceeds('0');
      setDisposalRemarks('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to dispose fixed asset.');
    } finally {
      setDisposing(false);
    }
  }

  const stats = useMemo(() => {
    const active = assets.filter((a) => a.status === 'Active');
    const totalCost = active.reduce((s, a) => s + (Number(a.historical_cost) || 0), 0);
    const totalAccum = active.reduce((s, a) => s + Number(a.accumulated_depreciation ?? a.prior_accum_depr ?? 0), 0);
    const totalNbv = Math.max(0, totalCost - totalAccum);
    return { activeCount: active.length, totalCost, totalAccum, totalNbv };
  }, [assets]);

  const disposePreview = useMemo(() => {
    if (!disposeTarget) return null;
    const cost = Number(disposeTarget.historical_cost) || 0;
    const accum = Number(disposeTarget.accumulated_depreciation ?? disposeTarget.prior_accum_depr ?? 0);
    const nbv = Math.max(0, cost - accum);
    const proceeds = Number(disposalProceeds) || 0;
    return { nbv, gainOrLoss: Math.round((proceeds - nbv) * 100) / 100 };
  }, [disposeTarget, disposalProceeds]);

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 0.25s ease' }}>
      {/* Header */}
      <div className="mobile-col mobile-gap-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Fixed Asset Register &amp; Depreciation</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Track company PPE, post monthly depreciation journals to P&amp;L &amp; Balance Sheet, and record asset disposals.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
            <Calendar size={14} color="var(--text-muted)" />
            <input
              type="month"
              value={deprMonth}
              onChange={(e) => setDeprMonth(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none' }}
            />
          </div>
          <Button variant="secondary" icon={<Play size={14} />} loading={runningDepr} onClick={handleRunDepreciation}>
            Run Monthly Depreciation
          </Button>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>
            Add Fixed Asset
          </Button>
        </div>
      </div>

      {statusMsg && (
        <div style={{
          marginBottom: 18, padding: '12px 16px', borderRadius: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          background: statusMsg.type === 'ok' ? 'var(--success-dim)' : 'var(--error-dim)',
          color: statusMsg.type === 'ok' ? 'var(--success)' : 'var(--error)',
          border: `1px solid ${statusMsg.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {statusMsg.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Original Cost (Active)</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(stats.totalCost)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--warning)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Accumulated Depr.</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--warning)' }}>{formatCurrency(stats.totalAccum)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--success)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Net Book Value (NBV)</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{formatCurrency(stats.totalNbv)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Active Assets</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>{stats.activeCount}</div>
        </Card>
      </div>

      {/* Assets Table */}
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        {loading ? (
          <div style={{ padding: 20 }}>{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 8, marginBottom: 8 }} />)}</div>
        ) : assets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Building2 size={34} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>No fixed assets registered yet</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
              Add laptops, vehicles, generators, or machinery to automate monthly depreciation journals.
            </p>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add First Asset</Button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                  <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Asset</th>
                  <th style={{ padding: '11px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Method</th>
                  <th style={{ padding: '11px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Cost</th>
                  <th style={{ padding: '11px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Accum. Depr.</th>
                  <th style={{ padding: '11px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Net Book Value</th>
                  <th style={{ padding: '11px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Est. Monthly</th>
                  <th style={{ padding: '11px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset, idx) => {
                  const accum = Number(asset.accumulated_depreciation ?? asset.prior_accum_depr ?? 0);
                  const nbv = Math.max(0, Number(asset.historical_cost) - accum);
                  const monthlyEst = computeMonthlyDepreciationAmount(asset);
                  return (
                    <tr key={asset.id} style={{ borderTop: idx > 0 ? '1px solid var(--bg-border)' : 'none' }}>
                      <td style={{ padding: '13px 14px' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{asset.asset_name || asset.description}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {asset.asset_code} · {asset.asset_class} · Bought {formatDate(asset.date_acquired)}
                        </div>
                      </td>
                      <td style={{ padding: '13px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {asset.depreciation_method === 'reducing_balance'
                          ? `Reducing (${asset.annual_rate_pct || 20}%/yr)`
                          : `Straight-Line (${asset.useful_life_months || 60}m)`}
                      </td>
                      <td style={{ padding: '13px 10px', textAlign: 'right', fontSize: 13, fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(asset.historical_cost)}</td>
                      <td style={{ padding: '13px 10px', textAlign: 'right', fontSize: 13, color: 'var(--warning)', fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(accum)}</td>
                      <td style={{ padding: '13px 10px', textAlign: 'right', fontSize: 13.5, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(nbv)}</td>
                      <td style={{ padding: '13px 10px', textAlign: 'right', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'Space Grotesk, sans-serif' }}>
                        {asset.status === 'Active' ? formatCurrency(monthlyEst) : '—'}
                      </td>
                      <td style={{ padding: '13px 10px' }}>
                        <Badge variant={asset.status === 'Active' ? 'success' : 'default'}>{asset.status}</Badge>
                      </td>
                      <td style={{ padding: '13px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {asset.status === 'Active' ? (
                          <Button variant="secondary" size="sm" icon={<Trash2 size={12} />} onClick={() => setDisposeTarget(asset)}>
                            Dispose
                          </Button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {asset.disposal_date ? `Sold ${formatDate(asset.disposal_date)}` : 'Disposed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Depreciation Run Log */}
      {runs.length > 0 && (
        <Card>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Recent Posted Depreciation Runs</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {runs.map((r) => {
              const a = assets.find((x) => x.id === r.fixed_asset_id);
              return (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontSize: 12.5 }}>
                  <div>
                    <strong>{r.period_month}</strong> · {a?.asset_name || a?.description || 'Asset'}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NBV after run: {formatCurrency(r.net_book_value_after)}</div>
                  </div>
                  <strong style={{ color: 'var(--warning)', fontFamily: 'Space Grotesk, sans-serif' }}>-{formatCurrency(r.depreciation_amount)}</strong>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Add Fixed Asset Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Register Fixed Asset">
        <form onSubmit={handleAddAsset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Input label="Asset Name" value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} placeholder="e.g. MacBook Pro 16, Delivery Van" required />
            <Input label="Asset Code" value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} placeholder="Auto" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Asset Category (PPE Class)</label>
            <select
              value={form.asset_class}
              onChange={(e) => handleClassChange(e.target.value as OperationalFixedAsset['asset_class'])}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 13 }}
            >
              {ASSET_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Purchase Date" type="date" value={form.date_acquired} onChange={(e) => setForm({ ...form, date_acquired: e.target.value })} required />
            <Input label="Purchase Cost (₦)" type="number" min="1" step="0.01" value={form.historical_cost} onChange={(e) => setForm({ ...form, historical_cost: e.target.value })} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Depreciation Method</label>
              <select
                value={form.depreciation_method}
                onChange={(e) => setForm({ ...form, depreciation_method: e.target.value as any })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 13 }}
              >
                <option value="straight_line">Straight-Line</option>
                <option value="reducing_balance">Reducing Balance</option>
              </select>
            </div>
            <Input label="Salvage Value (₦)" type="number" min="0" step="0.01" value={form.salvage_value} onChange={(e) => setForm({ ...form, salvage_value: e.target.value })} />
          </div>

          {form.depreciation_method === 'straight_line' ? (
            <Input label="Useful Life (months)" type="number" min="1" value={form.useful_life_months} onChange={(e) => setForm({ ...form, useful_life_months: e.target.value })} required />
          ) : (
            <Input label="Annual Reducing Rate (%)" type="number" min="1" max="100" step="0.5" value={form.annual_rate_pct} onChange={(e) => setForm({ ...form, annual_rate_pct: e.target.value })} required />
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button variant="secondary" type="button" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>Register Asset</Button>
          </div>
        </form>
      </Modal>

      {/* Dispose Fixed Asset Modal */}
      <Modal open={!!disposeTarget} onClose={() => setDisposeTarget(null)} title={`Dispose Asset — ${disposeTarget?.asset_name || disposeTarget?.description || ''}`} size="sm">
        {disposeTarget && disposePreview && (
          <form onSubmit={handleConfirmDisposal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Disposal Date" type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} required />
            <Input label="Disposal Proceeds (₦)" type="number" min="0" step="0.01" value={disposalProceeds} onChange={(e) => setDisposalProceeds(e.target.value)} required />
            <Input label="Remarks (optional)" value={disposalRemarks} onChange={(e) => setDisposalRemarks(e.target.value)} placeholder="Sold, scrapped, traded in..." />

            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontSize: 12.5, lineHeight: 1.6 }}>
              <div>Current Net Book Value: <strong>{formatCurrency(disposePreview.nbv)}</strong></div>
              <div>
                Estimated {disposePreview.gainOrLoss >= 0 ? 'Gain' : 'Loss'} on Disposal:{' '}
                <strong style={{ color: disposePreview.gainOrLoss >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  {formatCurrency(Math.abs(disposePreview.gainOrLoss))}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setDisposeTarget(null)}>Cancel</Button>
              <Button variant="danger" type="submit" loading={disposing}>Confirm Disposal &amp; Post GL</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
