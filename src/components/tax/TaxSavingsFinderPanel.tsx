import { useState } from 'react';
import { ShieldAlert, Sparkles, CheckCircle2, HelpCircle, AlertTriangle, FileCheck2 } from 'lucide-react';
import type { TaxSavingsReport, OpportunityStatus } from '../../lib/taxSavingsFinder';

const STATUS_BADGE: Record<OpportunityStatus, { label: string; color: string; bg: string }> = {
  eligible: { label: 'Eligible', color: 'var(--success)', bg: 'var(--success-dim)' },
  probably_eligible: { label: 'Probably Eligible', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  needs_confirmation: { label: 'Needs Confirmation', color: 'var(--warning)', bg: 'rgba(245,158,11,0.12)' },
};

interface TaxSavingsFinderPanelProps {
  report: TaxSavingsReport;
  onApplyConfirmed?: (confirmedIds: string[], evidenceNotes: Record<string, string>) => void;
}

export function TaxSavingsFinderPanel({ report, onApplyConfirmed }: TaxSavingsFinderPanelProps) {
  const [decisions, setDecisions] = useState<Record<string, 'confirmed' | 'excluded'>>({});
  const [evidenceNotes, setEvidenceNotes] = useState<Record<string, string>>({});
  const [accountantReviewed, setAccountantReviewed] = useState(false);

  const confirmedCount = Object.values(decisions).filter((v) => v === 'confirmed').length;
  const confirmedSavings = report.opportunities
    .filter((o) => decisions[o.id] === 'confirmed')
    .reduce((s, o) => s + o.estimatedSaving, 0);

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header & Disclaimer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            <Sparkles size={17} color="var(--accent-light)" />
            Rova Tax Savings Finder — Exemptions &amp; Deductions (NTA 2025)
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {report.disclaimer}
          </p>
        </div>
        <div style={{ textAlign: 'right', padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--bg-border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Potential Tax Savings Found</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>
            ₦{report.totalEstimatedTaxSavings.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {report.opportunities.length === 0 && report.disallowedAlerts.length === 0 && (
        <div style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          No additional exemptions or special deductions were triggered from your current records. All standard operating expenses are already included in your P&amp;L.
        </div>
      )}

      {/* Opportunities List */}
      {report.opportunities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {report.opportunities.map((opp) => {
            const badge = STATUS_BADGE[opp.status];
            const decision = decisions[opp.id];
            return (
              <div
                key={opp.id}
                style={{
                  padding: 14,
                  background: 'var(--bg-base)',
                  border: `1px solid ${decision === 'confirmed' ? 'var(--success)' : decision === 'excluded' ? 'var(--bg-border)' : 'var(--bg-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  opacity: decision === 'excluded' ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{opp.title}</strong>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: badge.color, background: badge.bg }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
                    Est. Saving: ₦{opp.estimatedSaving.toLocaleString()}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <strong>Trigger in your data:</strong> {opp.triggerInData}
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <strong>Assumptions:</strong> {opp.assumptions.join(' ')}
                </div>

                {opp.contestedNote && (
                  <div style={{ fontSize: 11, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={13} /> {opp.contestedNote}
                  </div>
                )}

                <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--accent-light)' }}>
                    <HelpCircle size={13} /> {opp.questionToAsk}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <strong>Evidence to store:</strong> {opp.evidenceRequired}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                    <input
                      type="text"
                      placeholder={`Note/Ref for ${opp.evidenceRequired}...`}
                      value={evidenceNotes[opp.id] || ''}
                      onChange={(e) => setEvidenceNotes((prev) => ({ ...prev, [opp.id]: e.target.value }))}
                      style={{ flex: 1, minWidth: 180, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 12 }}
                    />
                    <button
                      type="button"
                      onClick={() => setDecisions((prev) => ({ ...prev, [opp.id]: 'confirmed' }))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--success)',
                        background: decision === 'confirmed' ? 'var(--success)' : 'transparent',
                        color: decision === 'confirmed' ? '#fff' : 'var(--success)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <CheckCircle2 size={12} /> Confirm Eligible
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecisions((prev) => ({ ...prev, [opp.id]: 'excluded' }))}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--bg-border)',
                        background: decision === 'excluded' ? 'var(--bg-border)' : 'transparent',
                        color: 'var(--text-muted)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section 6: Do Not Claim Guardrails */}
      {report.disallowedAlerts.length > 0 && (
        <div style={{ padding: 14, background: 'var(--error-dim)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: 'var(--error)' }}>
            <ShieldAlert size={16} /> Do Not Claim These (Disallowed Under NTA 2025)
          </div>
          {report.disallowedAlerts.map((alert) => (
            <div key={alert.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>{alert.title} (₦{alert.amount.toLocaleString()}):</strong> {alert.reason}
            </div>
          ))}
        </div>
      )}

      {/* Accountant Review Step */}
      {onApplyConfirmed && report.opportunities.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 8, borderTop: '1px solid var(--bg-border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={accountantReviewed} onChange={(e) => setAccountantReviewed(e.target.checked)} />
            Review with your accountant: I will verify confirmed exemptions/deductions with a qualified accountant before final filing.
          </label>
          <button
            type="button"
            disabled={!accountantReviewed || confirmedCount === 0}
            onClick={() =>
              onApplyConfirmed(
                Object.entries(decisions)
                  .filter(([, v]) => v === 'confirmed')
                  .map(([k]) => k),
                evidenceNotes
              )
            }
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: accountantReviewed && confirmedCount > 0 ? 'var(--accent-primary)' : 'var(--bg-border)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: accountantReviewed && confirmedCount > 0 ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileCheck2 size={14} /> Apply {confirmedCount} Confirmed Item(s) (Est. ₦{confirmedSavings.toLocaleString()})
          </button>
        </div>
      )}
    </div>
  );
}
