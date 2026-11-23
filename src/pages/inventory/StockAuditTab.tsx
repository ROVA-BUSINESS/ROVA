import { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert, CheckCircle2, AlertTriangle, Download,
  Search, Calendar, Save, History
} from 'lucide-react';
import { supabase, type InventoryItem } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCurrency, formatDate } from '../../lib/format';
import { downloadCSV } from '../../lib/export';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

interface InventoryTxRow {
  id: string;
  item_id: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'return' | 'write_off';
  quantity: number;
  unit_cost: number;
  total_cost: number;
  notes: string;
  date: string;
  created_at: string;
}

interface StockAuditTabProps {
  items: InventoryItem[];
  onRefresh: () => void;
}

function getMonthBounds(ym: string): { start: string; end: string; label: string } {
  const [yStr, mStr] = ym.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const start = `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const end = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const label = new Date(year, monthIdx, 1).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

export default function StockAuditTab({ items, onRefresh }: StockAuditTabProps) {
  const { user, isStaff, staffData } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [search, setSearch] = useState('');
  const [invTxs, setInvTxs] = useState<InventoryTxRow[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);
  // Map of itemId -> string value typed by user for actual physical end-of-month count
  const [actualCounts, setActualCounts] = useState<Record<string, string>>({});

  // Discrepancy recording modal state
  const [recordingRow, setRecordingRow] = useState<{
    item: InventoryItem;
    expected: number;
    actual: number;
    diff: number;
    lossValue: number;
  } | null>(null);
  const [discrepancyReason, setDiscrepancyReason] = useState('Suspected theft / unrecorded sales');
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [savingDiscrepancy, setSavingDiscrepancy] = useState(false);

  const bounds = useMemo(() => getMonthBounds(selectedMonth), [selectedMonth]);

  useEffect(() => {
    if (effectiveUserId) loadInventoryTransactions();
  }, [effectiveUserId, selectedMonth]);

  async function loadInventoryTransactions() {
    setLoadingTxs(true);
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('user_id', effectiveUserId)
      .gte('date', bounds.start)
      .order('date', { ascending: false });
    setInvTxs((data as InventoryTxRow[]) || []);
    setLoadingTxs(false);
  }

  // Compute beginning-of-month, restocks, recorded sales, expected end-of-month, and discrepancy
  const auditRows = useMemo(() => {
    const activeItems = items.filter((i) => i.status === 'active');

    return activeItems
      .filter((i) => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()) || (i.sku || '').toLowerCase().includes(search.toLowerCase()))
      .map((item) => {
        const itemTxs = invTxs.filter((tx) => tx.item_id === item.id);

        // Movements strictly AFTER selected month end (to roll back current_stock to end of selected month)
        let afterMonthDelta = 0;
        let restocked = 0;
        let recordedSales = 0;
        let writeOffs = 0;
        let adjustments = 0;

        for (const tx of itemTxs) {
          const qty = Number(tx.quantity) || 0;
          const signed =
            tx.type === 'purchase' || tx.type === 'return'
              ? qty
              : tx.type === 'sale' || tx.type === 'write_off'
              ? -qty
              : qty; // adjustment can be +/-

          if (tx.date > bounds.end) {
            afterMonthDelta += signed;
          } else if (tx.date >= bounds.start && tx.date <= bounds.end) {
            if (tx.type === 'purchase' || tx.type === 'return') restocked += qty;
            else if (tx.type === 'sale') recordedSales += qty;
            else if (tx.type === 'write_off') writeOffs += qty;
            else if (tx.type === 'adjustment') adjustments += qty;
          }
        }

        const currentStock = Number(item.current_stock) || 0;
        const expectedClosing = Math.max(0, Math.round((currentStock - afterMonthDelta) * 1000) / 1000);
        const openingStock = Math.max(
          0,
          Math.round((expectedClosing - restocked + recordedSales + writeOffs - adjustments) * 1000) / 1000
        );

        const rawActual = actualCounts[item.id];
        const hasActual = rawActual !== undefined && rawActual.trim() !== '' && !isNaN(Number(rawActual));
        const actualCount = hasActual ? Number(rawActual) : null;
        const discrepancy = actualCount !== null ? Math.round((actualCount - expectedClosing) * 1000) / 1000 : null;
        const unitVal = Number(item.selling_price) || Number(item.cost_price) || 0;
        const discrepancyValue = discrepancy !== null ? Math.abs(discrepancy) * unitVal : 0;

        return {
          item,
          openingStock,
          restocked,
          recordedSales,
          writeOffs,
          expectedClosing,
          actualCount,
          discrepancy,
          discrepancyValue,
        };
      });
  }, [items, invTxs, bounds, search, actualCounts]);

  const summary = useMemo(() => {
    const totalSalesUnits = auditRows.reduce((s, r) => s + r.recordedSales, 0);
    const auditedCount = auditRows.filter((r) => r.actualCount !== null).length;
    const missingUnits = auditRows.reduce((s, r) => s + (r.discrepancy !== null && r.discrepancy < 0 ? Math.abs(r.discrepancy) : 0), 0);
    const missingValue = auditRows.reduce((s, r) => s + (r.discrepancy !== null && r.discrepancy < 0 ? r.discrepancyValue : 0), 0);
    return { totalSalesUnits, auditedCount, missingUnits, missingValue };
  }, [auditRows]);

  const recentDiscrepancies = useMemo(() => {
    return invTxs
      .filter((tx) => tx.type === 'write_off' || (tx.type === 'adjustment' && (tx.notes || '').toLowerCase().includes('audit')))
      .slice(0, 8);
  }, [invTxs]);

  async function handleConfirmDiscrepancy() {
    if (!recordingRow || !effectiveUserId) return;
    setSavingDiscrepancy(true);
    try {
      const { item, diff, lossValue } = recordingRow;
      const isMissing = diff < 0;
      const absQty = Math.abs(diff);
      const todayStr = new Date().toISOString().split('T')[0];
      const auditDate = bounds.end < todayStr ? bounds.end : todayStr;
      const unitVal = Number(item.selling_price) || Number(item.cost_price) || 0;

      // 1. Record write_off (missing stock) or adjustment (surplus) in inventory_transactions
      const { error: txErr } = await supabase.from('inventory_transactions').insert({
        user_id: effectiveUserId,
        item_id: item.id,
        type: isMissing ? 'write_off' : 'adjustment',
        quantity: isMissing ? absQty : diff,
        unit_cost: unitVal,
        total_cost: lossValue,
        date: auditDate,
        notes: `[Stock Audit ${bounds.label}] ${discrepancyReason}${discrepancyNote.trim() ? ` — ${discrepancyNote.trim()}` : ''}`,
      });

      if (txErr) throw txErr;

      // 2. Sync current_stock on inventory_items
      const nextStock = Math.max(0, (Number(item.current_stock) || 0) + diff);
      await supabase
        .from('inventory_items')
        .update({ current_stock: nextStock, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('user_id', effectiveUserId);

      // Clear input for this item and refresh
      setActualCounts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setRecordingRow(null);
      setDiscrepancyNote('');
      await loadInventoryTransactions();
      onRefresh();
    } catch (err: any) {
      console.error('Failed to record discrepancy:', err);
      alert('Failed to record discrepancy: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingDiscrepancy(false);
    }
  }

  function handleExportAuditCSV() {
    const rows = auditRows.map((r) => [
      r.item.name,
      r.item.sku || '—',
      r.openingStock,
      r.restocked,
      r.recordedSales,
      r.expectedClosing,
      r.actualCount !== null ? r.actualCount : 'Not Counted',
      r.discrepancy !== null ? r.discrepancy : '—',
      r.discrepancy !== null && r.discrepancy < 0 ? r.discrepancyValue : 0,
    ]);
    downloadCSV(
      `stock-audit-${selectedMonth}.csv`,
      [
        'Item',
        'SKU',
        'Start of Month',
        'Restocked (+)',
        'Recorded Sales (-)',
        'Expected End of Month',
        'Actual Physical Count',
        'Discrepancy (Units)',
        'Potential Loss (NGN)',
      ],
      rows
    );
  }

  const cardBg = isDark ? '#141417' : '#ffffff';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.07)';
  const textPrimary = isDark ? '#fafafa' : '#111827';
  const textSecondary = isDark ? '#a1a1aa' : '#64748b';
  const textMuted = isDark ? '#71717a' : '#94a3b8';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Controls Banner */}
      <div
        style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: isDark ? 'rgba(239, 68, 68, 0.16)' : '#fef2f2',
              color: isDark ? '#f87171' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: textPrimary, margin: 0 }}>
              Monthly Stock Audit &amp; Anti-Theft Check
            </h2>
            <p style={{ fontSize: 12.5, color: textSecondary, margin: '3px 0 0' }}>
              Compare start-of-month stock, recorded sales, and actual end-of-month shelf count to spot missing inventory immediately.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 10, padding: '6px 10px' }}>
            <Calendar size={14} color={textMuted} />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setActualCounts({});
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: textPrimary,
                fontSize: 13,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>

          <Button variant="secondary" icon={<Download size={14} />} onClick={handleExportAuditCSV}>
            Export Audit CSV
          </Button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div style={{ background: cardBg, border: cardBorder, borderRadius: 16, padding: '16px 18px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Audit Period</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: textPrimary, fontFamily: 'Space Grotesk, sans-serif' }}>{bounds.label}</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{summary.auditedCount} of {auditRows.length} items counted</div>
        </div>

        <div style={{ background: cardBg, border: cardBorder, borderRadius: 16, padding: '16px 18px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Recorded Sales ({bounds.label.split(' ')[0]})</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: textPrimary, fontFamily: 'Space Grotesk, sans-serif' }}>
            {summary.totalSalesUnits.toLocaleString()} units
          </div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>Linked from Sales transactions</div>
        </div>

        <div style={{ background: cardBg, border: cardBorder, borderRadius: 16, padding: '16px 18px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Missing Units Flagged</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: summary.missingUnits > 0 ? '#ef4444' : '#16a34a', fontFamily: 'Space Grotesk, sans-serif' }}>
            {summary.missingUnits > 0 ? `-${summary.missingUnits.toLocaleString()} units` : '0 missing'}
          </div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
            {summary.missingUnits > 0 ? 'Unexplained stock shortage' : 'Enter physical counts below'}
          </div>
        </div>

        <div style={{ background: cardBg, border: cardBorder, borderRadius: 16, padding: '16px 18px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>Est. Discrepancy Value</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: summary.missingValue > 0 ? '#ef4444' : textPrimary, fontFamily: 'Space Grotesk, sans-serif' }}>
            {formatCurrency(summary.missingValue)}
          </div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>At item selling value</div>
        </div>
      </div>

      {/* Audit Reconciliation Table */}
      <div style={{ background: cardBg, border: cardBorder, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: cardBorder, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: textMuted }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item by name or SKU..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: 8,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                color: textPrimary,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: textMuted }}>
            Tip: Enter your actual end-of-month physical shelf count in the <strong>Actual Count</strong> column to spot theft or unrecorded sales.
          </div>
        </div>

        {loadingTxs ? (
          <div style={{ padding: 24 }}>
            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 8 }} />)}
          </div>
        ) : auditRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '44px 20px', color: textMuted, fontSize: 13 }}>
            No active inventory items found. Add items under <strong>Stock &amp; Products</strong> first.
          </div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: cardBorder }}>
                  <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>Item</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', textAlign: 'right' }}>Start of Month</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', textAlign: 'right' }}>Restocked (+)</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', textAlign: 'right' }}>Recorded Sales (-)</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', textAlign: 'right' }}>Expected End</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', textAlign: 'center' }}>Actual Count</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', textAlign: 'right' }}>Discrepancy</th>
                  <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row, idx) => {
                  const isMissing = row.discrepancy !== null && row.discrepancy < 0;
                  const isSurplus = row.discrepancy !== null && row.discrepancy > 0;
                  const isMatch = row.discrepancy === 0;

                  return (
                    <tr key={row.item.id} style={{ borderTop: idx > 0 ? cardBorder : 'none' }}>
                      <td style={{ padding: '13px 14px' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: textPrimary }}>{row.item.name}</div>
                        <div style={{ fontSize: 11, color: textMuted }}>
                          {row.item.sku ? `${row.item.sku} · ` : ''}{formatCurrency(row.item.selling_price)} / {row.item.unit}
                        </div>
                      </td>

                      <td style={{ padding: '13px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: textSecondary, fontFamily: 'Space Grotesk, sans-serif' }}>
                        {row.openingStock} {row.item.unit}
                      </td>

                      <td style={{ padding: '13px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: row.restocked > 0 ? '#16a34a' : textMuted, fontFamily: 'Space Grotesk, sans-serif' }}>
                        {row.restocked > 0 ? `+${row.restocked}` : '0'}
                      </td>

                      <td style={{ padding: '13px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: row.recordedSales > 0 ? 'var(--accent-light)' : textMuted, fontFamily: 'Space Grotesk, sans-serif' }}>
                        {row.recordedSales > 0 ? `-${row.recordedSales}` : '0'}
                      </td>

                      <td style={{ padding: '13px 12px', textAlign: 'right', fontSize: 13.5, fontWeight: 800, color: textPrimary, fontFamily: 'Space Grotesk, sans-serif' }}>
                        {row.expectedClosing} {row.item.unit}
                      </td>

                      <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder={String(row.expectedClosing)}
                          value={actualCounts[row.item.id] ?? ''}
                          onChange={(e) => setActualCounts((prev) => ({ ...prev, [row.item.id]: e.target.value }))}
                          style={{
                            width: 82,
                            padding: '6px 8px',
                            borderRadius: 8,
                            background: 'var(--bg-elevated)',
                            border: isMissing
                              ? '1.5px solid #ef4444'
                              : isMatch
                              ? '1.5px solid #16a34a'
                              : '1px solid var(--bg-border)',
                            color: textPrimary,
                            fontSize: 13,
                            fontWeight: 700,
                            textAlign: 'center',
                            outline: 'none',
                          }}
                        />
                      </td>

                      <td style={{ padding: '13px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {row.discrepancy === null ? (
                          <span style={{ fontSize: 12, color: textMuted }}>—</span>
                        ) : isMatch ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 9px', borderRadius: 12,
                            background: isDark ? 'rgba(34,197,94,0.16)' : '#ecfdf5',
                            color: isDark ? '#4ade80' : '#16a34a',
                            fontSize: 11.5, fontWeight: 700,
                          }}>
                            <CheckCircle2 size={12} /> Matched
                          </span>
                        ) : isMissing ? (
                          <div>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '4px 9px', borderRadius: 12,
                              background: isDark ? 'rgba(239,68,68,0.16)' : '#fef2f2',
                              color: isDark ? '#f87171' : '#dc2626',
                              fontSize: 11.5, fontWeight: 700,
                            }}>
                              <AlertTriangle size={12} /> Missing {Math.abs(row.discrepancy)}
                            </span>
                            <div style={{ fontSize: 10.5, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>
                              -{formatCurrency(row.discrepancyValue)}
                            </div>
                          </div>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 9px', borderRadius: 12,
                            background: isDark ? 'rgba(59,130,246,0.16)' : '#eff6ff',
                            color: isDark ? '#60a5fa' : '#2563eb',
                            fontSize: 11.5, fontWeight: 700,
                          }}>
                            Surplus +{row.discrepancy}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '13px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {isMissing || isSurplus ? (
                          <button
                            type="button"
                            onClick={() =>
                              setRecordingRow({
                                item: row.item,
                                expected: row.expectedClosing,
                                actual: row.actualCount!,
                                diff: row.discrepancy!,
                                lossValue: row.discrepancyValue,
                              })
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '6px 12px',
                              borderRadius: 8,
                              background: isMissing ? '#ef4444' : 'var(--accent-primary)',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Save size={12} /> Record Discrepancy
                          </button>
                        ) : (
                          <span style={{ fontSize: 11.5, color: textMuted }}>
                            {isMatch ? 'No action needed' : 'Enter count'}
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
      </div>

      {/* Recent Discrepancy Audit Log */}
      {recentDiscrepancies.length > 0 && (
        <div style={{ background: cardBg, border: cardBorder, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <History size={16} color={textSecondary} />
            <h3 style={{ fontSize: 14.5, fontWeight: 700, color: textPrimary, margin: 0 }}>
              Recorded Discrepancies &amp; Write-Offs ({bounds.label})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentDiscrepancies.map((tx) => {
              const matchedItem = items.find((i) => i.id === tx.item_id);
              return (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                      {matchedItem?.name || 'Item'} —{' '}
                      <span style={{ color: tx.type === 'write_off' ? '#ef4444' : '#3b82f6' }}>
                        {tx.type === 'write_off' ? `-${tx.quantity} missing` : `+${tx.quantity} surplus`}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: textMuted, marginTop: 2 }}>
                      {formatDate(tx.date)} · {tx.notes || 'Stock audit adjustment'}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: tx.type === 'write_off' ? '#ef4444' : textPrimary }}>
                    {tx.type === 'write_off' ? `-${formatCurrency(tx.total_cost)}` : formatCurrency(tx.total_cost)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Record Discrepancy Confirmation Modal */}
      <Modal
        open={!!recordingRow}
        onClose={() => setRecordingRow(null)}
        title="Record Inventory Discrepancy"
        size="sm"
      >
        {recordingRow && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: recordingRow.diff < 0 ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${recordingRow.diff < 0 ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)'}`,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>
                {recordingRow.item.name}
              </div>
              <div style={{ fontSize: 12.5, color: textSecondary, lineHeight: 1.6 }}>
                Expected End of Month: <strong>{recordingRow.expected}</strong><br />
                Actual Physical Count: <strong>{recordingRow.actual}</strong><br />
                Discrepancy:{' '}
                <strong style={{ color: recordingRow.diff < 0 ? '#ef4444' : '#3b82f6' }}>
                  {recordingRow.diff < 0
                    ? `Missing ${Math.abs(recordingRow.diff)} ${recordingRow.item.unit} (-${formatCurrency(recordingRow.lossValue)})`
                    : `Surplus +${recordingRow.diff} ${recordingRow.item.unit}`}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: textSecondary }}>Reason</label>
              <select
                value={discrepancyReason}
                onChange={(e) => setDiscrepancyReason(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  color: textPrimary,
                  fontSize: 13,
                  outline: 'none',
                }}
              >
                <option value="Suspected theft / unrecorded sales">Suspected theft / unrecorded sales</option>
                <option value="Damaged / expired / spoiled goods">Damaged / expired / spoiled goods</option>
                <option value="Counting error / stock correction">Counting error / stock correction</option>
                <option value="Internal business usage / samples">Internal business usage / samples</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: textSecondary }}>Audit Notes (optional)</label>
              <textarea
                rows={2}
                value={discrepancyNote}
                onChange={(e) => setDiscrepancyNote(e.target.value)}
                placeholder="e.g. Verified during end-of-month shelf count with store manager..."
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  color: textPrimary,
                  fontSize: 13,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <Button variant="secondary" type="button" onClick={() => setRecordingRow(null)}>
                Cancel
              </Button>
              <Button
                variant={recordingRow.diff < 0 ? 'danger' : 'primary'}
                loading={savingDiscrepancy}
                onClick={handleConfirmDiscrepancy}
              >
                Confirm &amp; Update Stock
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
