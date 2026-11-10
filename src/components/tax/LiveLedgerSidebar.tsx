import { AlertTriangle } from 'lucide-react';

interface LiveLedgerSidebarProps {
  computed: {
    revenue: number;
    directCost: number;
    grossProfit: number;
    otherIncomeTotal?: number;
    adminExpensesTotal: number;
    addbacksTotal: number;
    deductionsTotal: number;
    totalCapitalAllowance: number;
    capitalAllowanceClaimed?: number;
    assessableProfit?: number;
    taxableProfit?: number;
    qualifiesSmallCompanyExemption?: boolean;
    citCharged?: number;
    developmentLevy?: number;
    whtCreditsUtilized?: number;
    netTaxPayable?: number;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Live Ledger</h3>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent-light)' }}>
          NTA 2025
        </span>
      </div>
      
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <LedgerRow label="Revenue" value={computed.revenue} />
        <LedgerRow label="Direct Cost" value={computed.directCost} isNegative />
        <div style={{ height: 1, background: 'var(--bg-border)', margin: '2px 0' }} />
        <LedgerRow label="Gross Profit" value={computed.grossProfit} bold />
        {computed.otherIncomeTotal ? (
          <LedgerRow label="Other Income" value={computed.otherIncomeTotal} />
        ) : null}
        <LedgerRow label="Admin Expenses" value={computed.adminExpensesTotal} isNegative />
        <LedgerRow label="Add-backs" value={computed.addbacksTotal} />
        <LedgerRow label="Deductions" value={computed.deductionsTotal} isNegative />
        <LedgerRow
          label="Capital Allowance (Claimed)"
          value={computed.capitalAllowanceClaimed ?? computed.totalCapitalAllowance}
          isNegative
        />
        <div style={{ height: 1, background: 'var(--bg-border)', margin: '2px 0' }} />
        <LedgerRow label="Taxable Profit" value={computed.taxableProfit ?? 0} bold />
        <LedgerRow
          label={computed.qualifiesSmallCompanyExemption ? 'CIT (0% Small Co.)' : 'CIT (27.5%)'}
          value={computed.citCharged ?? 0}
        />
        <LedgerRow
          label={computed.qualifiesSmallCompanyExemption ? 'Dev Levy (Exempt)' : 'Dev Levy (4.0%)'}
          value={computed.developmentLevy ?? 0}
        />
        {(computed.whtCreditsUtilized ?? 0) > 0 && (
          <LedgerRow label="Less: WHT Credits" value={computed.whtCreditsUtilized ?? 0} isNegative />
        )}
        <div style={{ height: 1, background: 'var(--bg-border)', margin: '2px 0' }} />
        <LedgerRow label="Net Tax Payable" value={computed.netTaxPayable ?? 0} bold />
      </div>
    </div>
  );
}

function LedgerRow({ label, value, isNegative, bold }: { label: string, value: number, isNegative?: boolean, bold?: boolean }) {
  const formatted = `₦${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ 
        fontSize: 12, 
        fontWeight: bold ? 700 : 500, 
        color: bold ? 'var(--text-primary)' : (isNegative && value > 0 ? 'var(--error)' : 'var(--text-primary)') 
      }}>
        {isNegative && value > 0 ? `-${formatted}` : formatted}
      </span>
    </div>
  );
}
