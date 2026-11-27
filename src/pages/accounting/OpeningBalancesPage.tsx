import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale, Save, CheckCircle2, AlertTriangle, Plus, Trash2, Users, Truck,
  Building2, Package, Sparkles, Lock, Edit3, BookOpen, FileSpreadsheet,
  BookMarked, ChevronDown, ChevronRight, X, Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  autoBalanceOpeningLines,
  buildDefaultOpeningLines,
  computeLineDebitCredit,
  getBalanceSheetCoaAccounts,
  loadOpeningBalanceRecord,
  postOpeningBalanceAdjustment,
  postOpeningBalances,
  saveOpeningBalancesDraft,
  validateOpeningBalances,
  type CustomerOpeningBalance,
  type OpeningBalanceLine,
  type OpeningBalanceRecord,
  type OpeningBalanceSection,
  type OpeningFixedAssetItem,
  type OpeningInventoryItem,
  type SupplierOpeningBalance,
} from '../../lib/openingBalanceService';

export default function OpeningBalancesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<OpeningBalanceRecord | null>(null);
  const [openingDate, setOpeningDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
  });
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<OpeningBalanceLine[]>(() => buildDefaultOpeningLines());
  const [customerBalances, setCustomerBalances] = useState<CustomerOpeningBalance[]>([]);
  const [supplierBalances, setSupplierBalances] = useState<SupplierOpeningBalance[]>([]);
  const [fixedAssets, setFixedAssets] = useState<OpeningFixedAssetItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<OpeningInventoryItem[]>([]);

  const [showOptionalSubledgers, setShowOptionalSubledgers] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Post-posting adjustment mode
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [postingAdjustment, setPostingAdjustment] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  }

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      try {
        const existing = await loadOpeningBalanceRecord(user.id);
        if (existing) {
          setRecord(existing);
          setOpeningDate(existing.opening_date);
          setNotes(existing.notes || '');
          setLines(existing.lines.length > 0 ? existing.lines : buildDefaultOpeningLines());
          setCustomerBalances(existing.customer_balances || []);
          setSupplierBalances(existing.supplier_balances || []);
          setFixedAssets(existing.fixed_asset_items || []);
          setInventoryItems(existing.inventory_items_data || []);
        }
      } catch (err) {
        console.error('[OpeningBalancesPage] load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const isPosted = record?.status === 'posted';
  const isReadOnly = isPosted && !isAdjusting;

  const validation = useMemo(
    () => validateOpeningBalances(openingDate, lines, customerBalances, supplierBalances),
    [openingDate, lines, customerBalances, supplierBalances]
  );

  const assetLines = useMemo(() => lines.filter((l) => l.account_type === 'asset'), [lines]);
  const liabilityLines = useMemo(() => lines.filter((l) => l.account_type === 'liability'), [lines]);
  const equityLines = useMemo(() => lines.filter((l) => l.account_type === 'equity'), [lines]);

  const customerTotal = useMemo(
    () => customerBalances.reduce((s, c) => s + (Number(c.amount) || 0), 0),
    [customerBalances]
  );
  const supplierTotal = useMemo(
    () => supplierBalances.reduce((s, sup) => s + (Number(sup.amount) || 0), 0),
    [supplierBalances]
  );

  function updateLineAmount(lineId: string, rawVal: string) {
    const parsed = rawVal === '' || rawVal === '-' ? 0 : Number(rawVal);
    const num = Number.isFinite(parsed) ? parsed : 0;
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const { debit, credit } = computeLineDebitCredit(l.normal_balance, num);
        return { ...l, amount: num, debit, credit };
      })
    );
  }

  function addAccountLine(section: OpeningBalanceSection, accountCode: string) {
    if (!accountCode) return;
    if (lines.some((l) => l.account_code === accountCode)) {
      showToast('That account is already in your opening balances list.', 'error');
      return;
    }
    const acc = getBalanceSheetCoaAccounts(section).find((a) => a.code === accountCode);
    if (!acc) return;
    setLines((prev) => [
      ...prev,
      {
        id: `ob_${acc.code}_${Date.now()}`,
        account_code: acc.code,
        account_name: acc.name,
        account_type: section,
        normal_balance: acc.normalBalance,
        amount: 0,
        debit: 0,
        credit: 0,
        notes: '',
      },
    ]);
  }

  function removeLine(lineId: string) {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  function handleAutoBalance() {
    setLines((prev) => autoBalanceOpeningLines(prev));
    showToast('Balanced difference allocated to Retained Earnings (3020), preserving your other equity entries.');
  }

  function syncCustomersToAR() {
    setLines((prev) => {
      const hasAR = prev.some((l) => l.account_code === '1110');
      const next = hasAR
        ? prev.map((l) => {
            if (l.account_code !== '1110') return l;
            const { debit, credit } = computeLineDebitCredit('debit', customerTotal);
            return { ...l, amount: customerTotal, debit, credit };
          })
        : [
            ...prev,
            {
              id: 'ob_1110',
              account_code: '1110',
              account_name: 'Trade Accounts Receivable',
              account_type: 'asset' as const,
              normal_balance: 'debit' as const,
              amount: customerTotal,
              debit: customerTotal,
              credit: 0,
            },
          ];
      return next;
    });
    showToast(`Synced ₦${customerTotal.toLocaleString()} to Trade Accounts Receivable (1110).`);
  }

  function syncSuppliersToAP() {
    setLines((prev) => {
      const hasAP = prev.some((l) => l.account_code === '2010');
      const next = hasAP
        ? prev.map((l) => {
            if (l.account_code !== '2010') return l;
            const { debit, credit } = computeLineDebitCredit('credit', supplierTotal);
            return { ...l, amount: supplierTotal, debit, credit };
          })
        : [
            ...prev,
            {
              id: 'ob_2010',
              account_code: '2010',
              account_name: 'Trade Accounts Payable',
              account_type: 'liability' as const,
              normal_balance: 'credit' as const,
              amount: supplierTotal,
              debit: 0,
              credit: supplierTotal,
            },
          ];
      return next;
    });
    showToast(`Synced ₦${supplierTotal.toLocaleString()} to Trade Accounts Payable (2010).`);
  }

  async function handleSaveDraft() {
    if (!user?.id) return;
    setSavingDraft(true);
    try {
      const saved = await saveOpeningBalancesDraft({
        userId: user.id,
        existingId: record?.status === 'draft' ? record.id : null,
        openingDate,
        notes,
        lines,
        customerBalances,
        supplierBalances,
        fixedAssetItems: fixedAssets,
        inventoryItems,
      });
      setRecord(saved);
      showToast('Opening balances saved as draft. You can finish and post anytime.');
    } catch (err: any) {
      showToast(err?.message || 'Could not save draft.', 'error');
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleConfirmPost() {
    if (!user?.id) return;
    setPosting(true);
    try {
      const posted = await postOpeningBalances({
        userId: user.id,
        existingId: record?.status === 'draft' ? record.id : null,
        openingDate,
        notes,
        lines,
        customerBalances,
        supplierBalances,
        fixedAssetItems: fixedAssets,
        inventoryItems,
      });
      setRecord(posted);
      setCustomerBalances(posted.customer_balances || []);
      setSupplierBalances(posted.supplier_balances || []);
      setFixedAssets(posted.fixed_asset_items || []);
      setInventoryItems(posted.inventory_items_data || []);
      setShowConfirmModal(false);
      showToast('Opening balances posted! Your General Ledger, Trial Balance, and Balance Sheet are now updated.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to post opening balances.', 'error');
    } finally {
      setPosting(false);
    }
  }

  async function handlePostAdjustment() {
    if (!user?.id || !record) return;
    if (!adjustmentReason.trim()) {
      showToast('Please enter a brief reason for this opening balance adjustment.', 'error');
      return;
    }
    setPostingAdjustment(true);
    try {
      const updated = await postOpeningBalanceAdjustment({
        userId: user.id,
        record,
        updatedLines: lines,
        reason: adjustmentReason.trim(),
      });
      setRecord(updated);
      setIsAdjusting(false);
      setAdjustmentReason('');
      showToast('Adjustment journal entry posted! Your original opening balance history has been preserved.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to post adjustment entry.', 'error');
    } finally {
      setPostingAdjustment(false);
    }
  }

  function renderSectionTable(title: string, subtitle: string, section: OpeningBalanceSection, sectionLines: OpeningBalanceLine[]) {
    const availableToAdd = getBalanceSheetCoaAccounts(section).filter(
      (acc) => !lines.some((l) => l.account_code === acc.code)
    );
    const sectionTotal = sectionLines.reduce(
      (s, l) => s + (section === 'asset' ? (l.debit || 0) - (l.credit || 0) : (l.credit || 0) - (l.debit || 0)),
      0
    );

    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{title}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
              Section Net: {formatCurrency(sectionTotal)}
            </span>
            {!isReadOnly && availableToAdd.length > 0 && (
              <select
                value=""
                onChange={(e) => addAccountLine(section, e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <option value="">+ Add {section === 'asset' ? 'Asset' : section === 'liability' ? 'Liability' : 'Equity'} Account...</option>
                {availableToAdd.map((acc) => (
                  <option key={acc.code} value={acc.code}>
                    {acc.code} — {acc.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bg-border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '8px' }}>Account (Chart of Accounts)</th>
                <th style={{ padding: '8px', width: 170 }}>Opening Balance (₦)</th>
                <th style={{ padding: '8px', width: 120, textAlign: 'right' }}>Debit</th>
                <th style={{ padding: '8px', width: 120, textAlign: 'right' }}>Credit</th>
                {!isReadOnly && <th style={{ padding: '8px', width: 42 }} />}
              </tr>
            </thead>
            <tbody>
              {sectionLines.map((line) => (
                <tr key={line.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ fontWeight: 600 }}>
                      <span style={{ color: 'var(--accent-light)', marginRight: 6, fontFamily: 'monospace' }}>{line.account_code}</span>
                      {line.account_name}
                    </div>
                    {line.account_code === '3020' && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Enter a negative amount (e.g. -250000) if migrating accumulated losses.
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <input
                      type="number"
                      step="any"
                      disabled={isReadOnly}
                      value={line.amount === 0 ? '' : line.amount}
                      placeholder="0.00"
                      onChange={(e) => updateLineAmount(line.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: isReadOnly ? 'transparent' : 'var(--bg-elevated)',
                        border: isReadOnly ? 'none' : '1px solid var(--bg-border)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: line.debit > 0 ? '#22c55e' : 'var(--text-muted)', fontWeight: line.debit > 0 ? 700 : 400 }}>
                    {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: line.credit > 0 ? '#60a5fa' : 'var(--text-muted)', fontWeight: line.credit > 0 ? 700 : 400 }}>
                    {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                  </td>
                  {!isReadOnly && (
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <button
                        type="button"
                        title="Remove account row"
                        onClick={() => removeLine(line.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1120, animation: 'fadeIn 0.3s ease' }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: 'var(--bg-surface)',
            border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#22c55e'}`,
            color: 'var(--text-primary)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
            fontSize: 13,
            fontWeight: 600,
            maxWidth: 420,
          }}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="mobile-col mobile-gap-4" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>Opening Balances</h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 999,
                background: isPosted ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                color: isPosted ? '#22c55e' : '#f59e0b',
              }}
            >
              {isPosted ? (isAdjusting ? 'Recording Adjustment' : 'Posted to Ledger') : 'Draft Setup'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 680 }}>
            Migrating from spreadsheets, notebooks, or another accounting app? Enter your existing Assets, Liabilities, and Equity as at your chosen start date.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isPosted ? (
            <>
              <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={savingDraft}>
                <Save size={14} /> {savingDraft ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowConfirmModal(true)}>
                <CheckCircle2 size={14} /> Review &amp; Post
              </Button>
            </>
          ) : !isAdjusting ? (
            <Button variant="secondary" size="sm" onClick={() => setIsAdjusting(true)}>
              <Edit3 size={14} /> Record Adjustment Entry
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsAdjusting(false);
                  if (record) setLines(record.lines);
                }}
              >
                Cancel Adjustment
              </Button>
              <Button variant="primary" size="sm" onClick={handlePostAdjustment} disabled={postingAdjustment || !validation.isBalanced}>
                <CheckCircle2 size={14} /> {postingAdjustment ? 'Posting...' : 'Post Adjustment Journal'}
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 110 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Posted Banner with Quick Links to Statements */}
          {isPosted && !isAdjusting && (
            <Card style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Lock size={20} color="#22c55e" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>
                      Opening Balances Posted as at {record?.opening_date}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Balanced double-entry journal posted ({formatCurrency(record?.total_debits || 0)} Debits = {formatCurrency(record?.total_credits || 0)} Credits).
                      {(record?.adjustment_journal_ids?.length || 0) > 0 && ` · ${record?.adjustment_journal_ids.length} adjustment entry(s) recorded.`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/app/trial-balance')}>
                    <FileSpreadsheet size={13} /> Trial Balance
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/app/balance-sheet')}>
                    <Scale size={13} /> Balance Sheet
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/app/ledger')}>
                    <BookOpen size={13} /> General Ledger
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/app/journal-entries')}>
                    <BookMarked size={13} /> Journal Entries
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Adjustment Reason Box when in adjustment mode */}
          {isAdjusting && (
            <Card style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>
                Recording an Opening Balance Adjustment Entry
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                To follow proper accounting standards, your original opening journal entry will stay untouched. RovaFlow will post a new balanced adjustment journal entry recording only the changes you make below.
              </p>
              <input
                type="text"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Reason for adjustment (e.g. Updated opening inventory count from accountant)"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              />
            </Card>
          )}

          {/* Opening Date & Live Balance Bar */}
          <Card>
            <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: 16, alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Opening Balance Date
                </label>
                <input
                  type="date"
                  disabled={isPosted}
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: isPosted ? 'var(--bg-base)' : 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Total Debits</div>
                <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: '#22c55e' }}>
                  {formatCurrency(validation.totalDebits)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Total Credits</div>
                <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: '#60a5fa' }}>
                  {formatCurrency(validation.totalCredits)}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: validation.isBalanced ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${validation.isBalanced ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: validation.isBalanced ? '#22c55e' : '#ef4444', textTransform: 'uppercase' }}>
                      {validation.isBalanced ? 'Balanced ✓' : 'Out of Balance'}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {validation.isBalanced
                        ? 'Debits = Credits'
                        : `Difference: ${formatCurrency(Math.abs(validation.difference))}`}
                    </div>
                  </div>
                  {!isReadOnly && !validation.isBalanced && (validation.totalDebits > 0 || validation.totalCredits > 0) && (
                    <Button variant="primary" size="sm" onClick={handleAutoBalance}>
                      <Sparkles size={13} /> Auto-Balance
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {validation.warnings.length > 0 && (
              <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 12, color: '#f59e0b' }}>
                {validation.warnings.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {w}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Plain-English Guide */}
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <Info size={16} color="var(--accent-light)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <strong>Simple rule:</strong> Enter your cash, bank balances, stock, and equipment under <strong>Assets</strong>, enter unpaid supplier bills and loans under <strong>Liabilities</strong>, and enter any known owner's capital or prior profits under <strong>Equity</strong>. If there is a remaining difference, click <strong>Auto-Balance</strong> to place it in Retained Earnings without overwriting your Owner's Capital.
            </div>
          </div>

          {/* 1. ASSETS */}
          {renderSectionTable(
            '1. Assets (What Your Business Owns)',
            'Cash on hand, bank balances, money customers owe you, stock/inventory, and equipment.',
            'asset',
            assetLines
          )}

          {/* 2. LIABILITIES */}
          {renderSectionTable(
            '2. Liabilities (What Your Business Owes)',
            'Unpaid supplier bills, bank loans, outstanding expenses, and taxes payable.',
            'liability',
            liabilityLines
          )}

          {/* 3. EQUITY */}
          {renderSectionTable(
            '3. Equity (Owner Capital & Past Profits / Losses)',
            'Your existing Owner Capital and Retained Earnings are preserved. Use Auto-Balance only for the remaining difference.',
            'equity',
            equityLines
          )}

          {/* 4. CUSTOMER & SUPPLIER SUB-LEDGERS */}
          <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Customers (AR) */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={16} color="#0ea5e9" />
                    <h3 style={{ fontSize: 14.5, fontWeight: 700 }}>Customer Opening Balances (AR)</h3>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    e.g. Customer A owes you ₦150,000. Posted directly into Accounts Receivable.
                  </p>
                </div>
                {!isPosted && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setCustomerBalances((prev) => [
                        ...prev,
                        { id: `cb_${Date.now()}`, customer_name: '', amount: 0, due_date: openingDate },
                      ])
                    }
                  >
                    <Plus size={13} /> Add
                  </Button>
                )}
              </div>

              {customerBalances.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '14px 0', textAlign: 'center' }}>
                  No individual customer opening balances added.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {customerBalances.map((cb) => (
                    <div key={cb.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr auto', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        disabled={isPosted}
                        placeholder="Customer Name"
                        value={cb.customer_name}
                        onChange={(e) =>
                          setCustomerBalances((prev) =>
                            prev.map((x) => (x.id === cb.id ? { ...x, customer_name: e.target.value } : x))
                          )
                        }
                        style={{ padding: '7px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 12.5 }}
                      />
                      <input
                        type="number"
                        disabled={isPosted}
                        placeholder="Amount (₦)"
                        value={cb.amount || ''}
                        onChange={(e) =>
                          setCustomerBalances((prev) =>
                            prev.map((x) => (x.id === cb.id ? { ...x, amount: Number(e.target.value) || 0 } : x))
                          )
                        }
                        style={{ padding: '7px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 12.5 }}
                      />
                      {!isPosted && (
                        <button
                          type="button"
                          onClick={() => setCustomerBalances((prev) => prev.filter((x) => x.id !== cb.id))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--bg-border)', paddingTop: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>Total AR: {formatCurrency(customerTotal)}</span>
                    {!isPosted && (
                      <Button variant="secondary" size="sm" onClick={syncCustomersToAR}>
                        Sync to AR (1110)
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Suppliers (AP) */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Truck size={16} color="#f59e0b" />
                    <h3 style={{ fontSize: 14.5, fontWeight: 700 }}>Supplier Opening Balances (AP)</h3>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    e.g. You owe Supplier B ₦80,000. Posted directly into Accounts Payable.
                  </p>
                </div>
                {!isPosted && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setSupplierBalances((prev) => [
                        ...prev,
                        { id: `sb_${Date.now()}`, supplier_name: '', amount: 0, due_date: openingDate },
                      ])
                    }
                  >
                    <Plus size={13} /> Add
                  </Button>
                )}
              </div>

              {supplierBalances.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '14px 0', textAlign: 'center' }}>
                  No individual supplier opening balances added.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {supplierBalances.map((sb) => (
                    <div key={sb.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr auto', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        disabled={isPosted}
                        placeholder="Supplier Name"
                        value={sb.supplier_name}
                        onChange={(e) =>
                          setSupplierBalances((prev) =>
                            prev.map((x) => (x.id === sb.id ? { ...x, supplier_name: e.target.value } : x))
                          )
                        }
                        style={{ padding: '7px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 12.5 }}
                      />
                      <input
                        type="number"
                        disabled={isPosted}
                        placeholder="Amount (₦)"
                        value={sb.amount || ''}
                        onChange={(e) =>
                          setSupplierBalances((prev) =>
                            prev.map((x) => (x.id === sb.id ? { ...x, amount: Number(e.target.value) || 0 } : x))
                          )
                        }
                        style={{ padding: '7px 9px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 12.5 }}
                      />
                      {!isPosted && (
                        <button
                          type="button"
                          onClick={() => setSupplierBalances((prev) => prev.filter((x) => x.id !== sb.id))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--bg-border)', paddingTop: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>Total AP: {formatCurrency(supplierTotal)}</span>
                    {!isPosted && (
                      <Button variant="secondary" size="sm" onClick={syncSuppliersToAP}>
                        Sync to AP (2010)
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* 5. OPTIONAL FIXED ASSETS & INVENTORY OPENING ITEMS */}
          <Card>
            <button
              type="button"
              onClick={() => setShowOptionalSubledgers((v) => !v)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                  Optional: Register Opening Fixed Assets &amp; Inventory Items ({fixedAssets.length + inventoryItems.length})
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Automatically add existing equipment to your Fixed Asset Register and opening stock to Inventory
                </div>
              </div>
              {showOptionalSubledgers ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>

            {showOptionalSubledgers && (
              <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--bg-border)' }}>
                {/* Opening Fixed Assets */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                      <Building2 size={15} color="#8b5cf6" /> Opening Fixed Assets
                    </div>
                    {!isPosted && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setFixedAssets((prev) => [
                            ...prev,
                            {
                              id: `fa_${Date.now()}`,
                              asset_name: '',
                              asset_class: 'Computer & IT Infrastructure',
                              purchase_date: openingDate,
                              cost: 0,
                              accumulated_depreciation: 0,
                              useful_life_years: 3,
                            },
                          ])
                        }
                      >
                        <Plus size={13} /> Add Asset
                      </Button>
                    )}
                  </div>
                  {fixedAssets.map((fa) => (
                    <div key={fa.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 6, marginBottom: 8 }}>
                      <input
                        type="text"
                        disabled={isPosted}
                        placeholder="Asset Name (e.g. Delivery Van)"
                        value={fa.asset_name}
                        onChange={(e) => setFixedAssets((prev) => prev.map((x) => (x.id === fa.id ? { ...x, asset_name: e.target.value } : x)))}
                        style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 12 }}
                      />
                      <input
                        type="number"
                        disabled={isPosted}
                        placeholder="Cost (₦)"
                        value={fa.cost || ''}
                        onChange={(e) => setFixedAssets((prev) => prev.map((x) => (x.id === fa.id ? { ...x, cost: Number(e.target.value) || 0 } : x)))}
                        style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 12 }}
                      />
                      {!isPosted && (
                        <button type="button" onClick={() => setFixedAssets((prev) => prev.filter((x) => x.id !== fa.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Opening Inventory */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                      <Package size={15} color="#10b981" /> Opening Inventory Items
                    </div>
                    {!isPosted && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setInventoryItems((prev) => [
                            ...prev,
                            { id: `inv_${Date.now()}`, item_name: '', quantity: 1, unit_cost: 0 },
                          ])
                        }
                      >
                        <Plus size={13} /> Add Item
                      </Button>
                    )}
                  </div>
                  {inventoryItems.map((inv) => (
                    <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.7fr 0.9fr auto', gap: 6, marginBottom: 8 }}>
                      <input
                        type="text"
                        disabled={isPosted}
                        placeholder="Item Name"
                        value={inv.item_name}
                        onChange={(e) => setInventoryItems((prev) => prev.map((x) => (x.id === inv.id ? { ...x, item_name: e.target.value } : x)))}
                        style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 12 }}
                      />
                      <input
                        type="number"
                        disabled={isPosted}
                        placeholder="Qty"
                        value={inv.quantity || ''}
                        onChange={(e) => setInventoryItems((prev) => prev.map((x) => (x.id === inv.id ? { ...x, quantity: Number(e.target.value) || 0 } : x)))}
                        style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 12 }}
                      />
                      <input
                        type="number"
                        disabled={isPosted}
                        placeholder="Unit Cost (₦)"
                        value={inv.unit_cost || ''}
                        onChange={(e) => setInventoryItems((prev) => prev.map((x) => (x.id === inv.id ? { ...x, unit_cost: Number(e.target.value) || 0 } : x)))}
                        style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 12 }}
                      />
                      {!isPosted && (
                        <button type="button" onClick={() => setInventoryItems((prev) => prev.filter((x) => x.id !== inv.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* CONFIRMATION & JOURNAL PREVIEW MODAL */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800 }}>Confirm &amp; Post Opening Balances</h2>
              <button onClick={() => setShowConfirmModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {validation.errors.length > 0 ? (
              <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13, marginBottom: 6 }}>Cannot Post Yet — Fix These Issues:</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {validation.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
                  Posting will create a balanced double-entry journal entry dated <strong>{openingDate}</strong> and immediately update your General Ledger, Trial Balance, and Balance Sheet without affecting current-period Profit &amp; Loss.
                </p>

                <div style={{ overflowX: 'auto', marginBottom: 16, border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Account</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Debit</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines
                        .filter((l) => l.debit > 0 || l.credit > 0)
                        .map((l) => (
                          <tr key={l.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                            <td style={{ padding: '7px 10px' }}>{l.account_code} — {l.account_name}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#22c55e' }}>{l.debit > 0 ? formatCurrency(l.debit) : '—'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#60a5fa' }}>{l.credit > 0 ? formatCurrency(l.credit) : '—'}</td>
                          </tr>
                        ))}
                      <tr style={{ background: 'var(--bg-elevated)', fontWeight: 800 }}>
                        <td style={{ padding: '9px 10px' }}>TOTALS</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: '#22c55e' }}>{formatCurrency(validation.totalDebits)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: '#60a5fa' }}>{formatCurrency(validation.totalCredits)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>Close</Button>
              <Button variant="primary" onClick={handleConfirmPost} disabled={!validation.isValid || posting}>
                {posting ? 'Posting...' : 'Confirm & Post Opening Balances'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
