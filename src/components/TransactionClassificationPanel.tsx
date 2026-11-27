import { Building2, Sparkles, Info } from 'lucide-react';
import {
  ASSET_CLASS_COA,
  evaluateCapitalisationSuggestion,
  type AssetPurchaseDraft,
  type OperationalFixedAsset,
  type TransactionClassificationType,
} from '../lib/smeAccountingService';

const ASSET_CLASSES = Object.keys(ASSET_CLASS_COA) as OperationalFixedAsset['asset_class'][];

interface Props {
  txType: 'income' | 'expense';
  classification: TransactionClassificationType;
  onClassificationChange: (next: TransactionClassificationType) => void;
  description: string;
  amount: number;
  threshold: number;
  assetDraft: AssetPurchaseDraft;
  onAssetDraftChange: (next: AssetPurchaseDraft) => void;
}

export default function TransactionClassificationPanel({
  txType,
  classification,
  onClassificationChange,
  description,
  amount,
  threshold,
  assetDraft,
  onAssetDraftChange,
}: Props) {
  const options: { value: TransactionClassificationType; label: string; hint: string }[] =
    txType === 'expense'
      ? [
          { value: 'ordinary', label: 'Ordinary Expense', hint: 'Hits Income Statement (P&L)' },
          { value: 'asset_purchase', label: 'Asset Purchase', hint: 'Capitalised on Balance Sheet' },
          { value: 'owner_drawings', label: "Owner's Drawings", hint: 'Reduces Equity (Not P&L)' },
          { value: 'transfer', label: 'Transfer / Loan', hint: 'Balance Sheet only' },
        ]
      : [
          { value: 'ordinary', label: 'Sales / Operating Income', hint: 'Hits Income Statement (P&L)' },
          { value: 'capital_contribution', label: 'Owner Capital Contribution', hint: 'Increases Equity (Not P&L)' },
          { value: 'loan', label: 'Loan Received', hint: 'Liability on Balance Sheet' },
          { value: 'transfer', label: 'Internal Transfer', hint: 'Balance Sheet only' },
        ];

  const suggestion =
    txType === 'expense' && classification === 'ordinary'
      ? evaluateCapitalisationSuggestion({ description, amount, threshold })
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Transaction Classification
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {options.map((opt) => {
            const active = classification === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onClassificationChange(opt.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: active ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  border: `1px solid ${active ? 'var(--accent-border)' : 'var(--bg-border)'}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--accent-light)' : 'var(--text-primary)' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Capitalisation Threshold & Materiality Suggestion */}
      {suggestion && suggestion.shouldSuggestCapitalise && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(124, 58, 237, 0.10)',
            border: '1px solid var(--accent-border)',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, color: 'var(--text-primary)', lineHeight: 1.45 }}>
            <Sparkles size={14} color="var(--accent-light)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{suggestion.reason}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                const defaults = ASSET_CLASS_COA[suggestion.suggestedClass];
                onAssetDraftChange({
                  ...assetDraft,
                  asset_name: assetDraft.asset_name || description.trim(),
                  asset_class: suggestion.suggestedClass,
                  useful_life_months: defaults.defaultLifeMonths,
                  annual_rate_pct: defaults.defaultRatePct,
                });
                onClassificationChange('asset_purchase');
              }}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Classify as Asset Purchase
            </button>
          </div>
        </div>
      )}

      {/* Owner's Drawings / Capital Equity Notice */}
      {(classification === 'owner_drawings' || classification === 'capital_contribution') && (
        <div
          style={{
            padding: '9px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            fontSize: 11.5,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Info size={13} color="var(--accent-light)" style={{ flexShrink: 0 }} />
          <span>
            {classification === 'owner_drawings'
              ? "Owner's Drawings will reduce Equity on the Statement of Changes in Equity and will NOT appear as a business operating expense."
              : 'Owner Capital Contributions will increase Equity directly and will NOT inflate operating revenue.'}
          </span>
        </div>
      )}

      {/* Inline Fixed Asset Details when Asset Purchase is selected */}
      {txType === 'expense' && classification === 'asset_purchase' && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--accent-light)' }}>
            <Building2 size={14} />
            <span>Fixed Asset Register Details (Capitalised — Not Expensed on P&amp;L)</span>
          </div>

          <input
            type="text"
            placeholder="Asset name (e.g. MacBook Pro 16, Delivery Van)"
            value={assetDraft.asset_name}
            onChange={(e) => onAssetDraftChange({ ...assetDraft, asset_name: e.target.value })}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
              color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
            }}
          />

          <select
            value={assetDraft.asset_class}
            onChange={(e) => {
              const cls = e.target.value as OperationalFixedAsset['asset_class'];
              const def = ASSET_CLASS_COA[cls];
              onAssetDraftChange({
                ...assetDraft,
                asset_class: cls,
                useful_life_months: def.defaultLifeMonths,
                annual_rate_pct: def.defaultRatePct,
              });
            }}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
              color: 'var(--text-primary)', fontSize: 12.5, outline: 'none',
            }}
          >
            {ASSET_CLASSES.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Depreciation Method</label>
              <select
                value={assetDraft.depreciation_method}
                onChange={(e) => onAssetDraftChange({ ...assetDraft, depreciation_method: e.target.value as any })}
                style={{
                  width: '100%', padding: '7px 8px', borderRadius: 8,
                  background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
                  color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                }}
              >
                <option value="straight_line">Straight-Line</option>
                <option value="reducing_balance">Reducing Balance</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                {assetDraft.depreciation_method === 'straight_line' ? 'Useful Life (months)' : 'Annual Rate (%)'}
              </label>
              {assetDraft.depreciation_method === 'straight_line' ? (
                <input
                  type="number"
                  min="1"
                  value={assetDraft.useful_life_months}
                  onChange={(e) => onAssetDraftChange({ ...assetDraft, useful_life_months: Math.max(1, Number(e.target.value) || 12) })}
                  style={{
                    width: '100%', padding: '7px 8px', borderRadius: 8,
                    background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
                    color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              ) : (
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.5"
                  value={assetDraft.annual_rate_pct}
                  onChange={(e) => onAssetDraftChange({ ...assetDraft, annual_rate_pct: Math.max(1, Number(e.target.value) || 20) })}
                  style={{
                    width: '100%', padding: '7px 8px', borderRadius: 8,
                    background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
                    color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Residual / Salvage Value (₦)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={assetDraft.salvage_value}
              onChange={(e) => onAssetDraftChange({ ...assetDraft, salvage_value: Math.max(0, Number(e.target.value) || 0) })}
              style={{
                width: '100%', padding: '7px 8px', borderRadius: 8,
                background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
                color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
