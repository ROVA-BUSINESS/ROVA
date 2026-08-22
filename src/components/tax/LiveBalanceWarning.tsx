import React from 'react';
import { CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/format';

interface LiveBalanceWarningProps {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

export const LiveBalanceWarning: React.FC<LiveBalanceWarningProps> = ({
  totalAssets,
  totalLiabilities,
  totalEquity,
  isBalanced,
}) => {
  const rightHandSide = totalLiabilities + totalEquity;
  const difference = Math.abs(totalAssets - rightHandSide);

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 'var(--radius-md)',
        border: isBalanced
          ? '1px solid rgba(34,197,94,0.3)'
          : '1px solid rgba(239,68,68,0.4)',
        background: isBalanced ? 'var(--success-dim)' : 'var(--error-dim)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isBalanced ? (
            <CheckCircle size={20} color="var(--success)" style={{ flexShrink: 0 }} />
          ) : (
            <AlertCircle size={20} color="var(--error)" style={{ flexShrink: 0 }} />
          )}
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: isBalanced ? 'var(--success)' : 'var(--error)',
              }}
            >
              {isBalanced
                ? 'Statement of Financial Position is Balanced'
                : 'Unbalanced Statement of Financial Position'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {isBalanced
                ? 'Total Assets equal Total Liabilities + Equity'
                : `Discrepancy of ${formatCurrency(difference)} between Assets and Liabilities + Equity`}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Balance Check
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              color: isBalanced ? 'var(--success)' : 'var(--error)',
            }}
          >
            {isBalanced ? 'BALANCED' : `DIFF: ${formatCurrency(difference)}`}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          paddingTop: 10,
          borderTop: '1px dashed var(--bg-border)',
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Assets</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatCurrency(totalAssets)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Liabilities</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatCurrency(totalLiabilities)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Equity</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatCurrency(totalEquity)}
          </div>
        </div>
      </div>
    </div>
  );
};
