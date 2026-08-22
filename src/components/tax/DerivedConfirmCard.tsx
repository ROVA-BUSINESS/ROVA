import React, { useState } from 'react';
import { Check, Edit2, RotateCcw } from 'lucide-react';
import type { DerivedField } from '../../types/nrsQuestionFlow';
import { formatCurrency } from '../../lib/format';

interface DerivedConfirmCardProps {
  derived: DerivedField;
  derivedValue: number;
  overrideValue?: number;
  onOverrideChange: (newValue: number | undefined) => void;
}

const FRIENDLY_NAMES: Record<string, { title: string; desc: string }> = {
  addback_depreciation: {
    title: 'Depreciation Add-Back',
    desc: 'Accounting depreciation is disallowed for CIT and replaced with Capital Allowances.',
  },
  addback_loss_on_disposal: {
    title: 'Loss on Disposal of Assets Add-Back',
    desc: 'Accounting losses on asset sales are non-deductible for CIT.',
  },
  addback_penalty_or_fine: {
    title: 'Penalties & Fines Add-Back',
    desc: 'Fines and regulatory penalties paid to government bodies are non-deductible.',
  },
  deduction_frank_investment_income: {
    title: 'Franked Investment Income (Dividends)',
    desc: 'Dividend income already subject to WHT is exempt from further CIT.',
  },
  deduction_profit_from_disposal: {
    title: 'Gain on Disposal of Investment/Asset Deduction',
    desc: 'Capital gains are taxed under CGT Act rather than CIT.',
  },
  deduction_unrealised_gains: {
    title: 'Unrealised FX Gains Deduction',
    desc: 'Unrealised foreign exchange gains are non-taxable until settled.',
  },
};

export const DerivedConfirmCard: React.FC<DerivedConfirmCardProps> = ({
  derived,
  derivedValue,
  overrideValue,
  onOverrideChange,
}) => {
  const [isEditing, setIsEditing] = useState(overrideValue !== undefined);
  const [editInput, setEditInput] = useState(
    overrideValue !== undefined ? String(overrideValue) : String(derivedValue)
  );

  const friendly = FRIENDLY_NAMES[derived.id] || {
    title: derived.id.replace(/_/g, ' ').toUpperCase(),
    desc: `Derived from formula: ${derived.formula}`,
  };

  const isOverridden = overrideValue !== undefined;
  const activeAmount = isOverridden ? overrideValue : derivedValue;

  const handleApplyOverride = () => {
    const parsed = Math.max(0, parseFloat(editInput) || 0);
    onOverrideChange(parsed);
    setIsEditing(false);
  };

  const handleReset = () => {
    onOverrideChange(undefined);
    setEditInput(String(derivedValue));
    setIsEditing(false);
  };

  return (
    <div
      style={{
        padding: 16,
        background: isOverridden ? 'rgba(245,158,11,0.05)' : 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
        border: isOverridden
          ? '1px solid rgba(245,158,11,0.3)'
          : '1px solid var(--bg-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {friendly.title}
            </span>
            {isOverridden ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--warning)',
                  background: 'var(--warning-dim)',
                  padding: '2px 8px',
                  borderRadius: 10,
                  border: '1px solid rgba(245,158,11,0.3)',
                }}
              >
                Manually Overridden
              </span>
            ) : (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--success)',
                  background: 'var(--success-dim)',
                  padding: '2px 8px',
                  borderRadius: 10,
                  border: '1px solid rgba(34,197,94,0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Check size={10} /> Derived
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {friendly.desc}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)' }}>
            {formatCurrency(activeAmount)}
          </div>
          {derived.nrs_field && (
            <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>
              NRS Field: {derived.nrs_field}
            </div>
          )}
        </div>
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px dashed var(--bg-border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Override (₦):</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={editInput}
            onChange={(e) => setEditInput(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'var(--bg-base)',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 600,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleApplyOverride}
            style={{
              padding: '6px 12px',
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-base)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {isOverridden && (
            <button
              type="button"
              onClick={handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} /> Reset to derived ({formatCurrency(derivedValue)})
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              color: 'var(--accent-light)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Edit2 size={12} /> {isOverridden ? 'Edit Override' : 'Override Amount'}
          </button>
        </div>
      )}
    </div>
  );
};
