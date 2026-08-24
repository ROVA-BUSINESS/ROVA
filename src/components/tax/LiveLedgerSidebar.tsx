
import { AlertTriangle } from 'lucide-react';

interface LiveLedgerSidebarProps {
  computed: {
    revenue: number;
    directCost: number;
    grossProfit: number;
    adminExpensesTotal: number;
    addbacksTotal: number;
    deductionsTotal: number;
    totalCapitalAllowance: number;
  };
  mneCfcFlagged: boolean;
}

export function LiveLedgerSidebar({ computed, mneCfcFlagged }: LiveLedgerSidebarProps) {
  return (
    <div style={{
      position: 'sticky',
      top: 24,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--bg-border)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Live Ledger</h3>
      
      {mneCfcFlagged && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: 12, background: 'var(--error-dim)', border: '1px solid var(--error-border)',
          borderRadius: 'var(--radius-md)', color: 'var(--error)'
        }}>
          <AlertTriangle size={16} style={{ marginTop: 2 }} />
          <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
            CFC / MNE flagged — flow would stop and route to a tax professional here.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LedgerRow label="Revenue" value={computed.revenue} />
        <LedgerRow label="Direct Cost" value={computed.directCost} isNegative />
        <div style={{ height: 1, background: 'var(--bg-border)', margin: '4px 0' }} />
        <LedgerRow label="Gross Profit" value={computed.grossProfit} bold />
        <LedgerRow label="Admin Expenses" value={computed.adminExpensesTotal} isNegative />
        <LedgerRow label="Add-backs" value={computed.addbacksTotal} />
        <LedgerRow label="Deductions" value={computed.deductionsTotal} isNegative />
        <LedgerRow label="Capital Allowance" value={computed.totalCapitalAllowance} isNegative />
      </div>
    </div>
  );
}

function LedgerRow({ label, value, isNegative, bold }: { label: string, value: number, isNegative?: boolean, bold?: boolean }) {
  const formatted = `₦${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ 
        fontSize: 13, 
        fontWeight: bold ? 700 : 500, 
        color: bold ? 'var(--text-primary)' : (isNegative && value > 0 ? 'var(--error)' : 'var(--text-primary)') 
      }}>
        {isNegative && value > 0 ? `-${formatted}` : formatted}
      </span>
    </div>
  );
}
