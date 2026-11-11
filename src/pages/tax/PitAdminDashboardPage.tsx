import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, FileSpreadsheet, Globe, ShieldAlert, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type PitFilingRecord } from '../../lib/supabase';
import { PIT_JURISDICTION_LIST } from '../../config/pitJurisdictions';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

export default function PitAdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filings, setFilings] = useState<PitFilingRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('pit_filings')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setFilings(data as PitFilingRecord[]);
      });
  }, [user]);

  const totalMissing = PIT_JURISDICTION_LIST.reduce((sum, j) => sum + j.adminStatus.missingRequirements.length, 0);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate('/app/tax')}>
            Back to Tax Hub
          </Button>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: 'var(--text-primary)' }}>
            Four-State PIT Jurisdiction Administrator Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Live readiness matrix for LIRS (Lagos), KIRS (Kano), FCT-IRS (Abuja/FCT), and RIRS (Rivers).
          </p>
        </div>

        <Button variant="primary" onClick={() => navigate('/app/tax/pit/new')}>
          Launch PIT Self-Filing Wizard
        </Button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Supported Jurisdictions</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{PIT_JURISDICTION_LIST.length} / 4</div>
          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>LIRS, KIRS, FCT-IRS, RIRS</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Official Portals Online</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
            {PIT_JURISDICTION_LIST.filter((j) => j.adminStatus.portalAvailability === 'online').length} / 4
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Direct self-filing portal links active</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Public Filing APIs Available</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
            {PIT_JURISDICTION_LIST.filter((j) => j.adminStatus.apiAvailable).length} / 4
          </div>
          <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>Guided Form A packages enabled instead</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Open Integration Gaps</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{totalMissing}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Tracked per authority below</div>
        </Card>
      </div>

      {/* Matrix Table */}
      <Card style={{ overflowX: 'auto' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>F. Authority Compliance &amp; Readiness Matrix</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 860 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--bg-border)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 12 }}>
              <th style={{ padding: '10px 8px' }}>Jurisdiction &amp; Authority</th>
              <th style={{ padding: '10px 8px' }}>Registration</th>
              <th style={{ padding: '10px 8px' }}>Portal Availability</th>
              <th style={{ padding: '10px 8px' }}>Public API</th>
              <th style={{ padding: '10px 8px' }}>Integration Status</th>
              <th style={{ padding: '10px 8px' }}>Filing Template</th>
              <th style={{ padding: '10px 8px' }}>Last Verified</th>
              <th style={{ padding: '10px 8px' }}>Workspace Filings</th>
            </tr>
          </thead>
          <tbody>
            {PIT_JURISDICTION_LIST.map((j) => {
              const stateFilings = filings.filter((f) => f.state_code === j.stateCode);
              return (
                <tr key={j.stateCode} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ fontWeight: 700 }}>{j.stateLabel}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{j.authorityName}</div>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <Badge variant={j.adminStatus.registrationStatus === 'configured' ? 'success' : 'warning'}>
                      {j.adminStatus.registrationStatus}
                    </Badge>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <a
                      href={j.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent-light)', textDecoration: 'none' }}
                    >
                      <Globe size={13} />
                      <span>{j.adminStatus.portalAvailability}</span>
                      <ExternalLink size={12} />
                    </a>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {j.adminStatus.apiAvailable ? (
                      <Badge variant="success">Available</Badge>
                    ) : (
                      <Badge variant="warning">Unavailable (Institutional Only)</Badge>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <Badge variant="info">
                      {j.adminStatus.integrationStatus === 'self_filing_guided' ? 'Self-Filing Package + Guided Portal' : j.adminStatus.integrationStatus}
                    </Badge>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {j.adminStatus.filingTemplateAvailable ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)' }}>
                        <CheckCircle2 size={14} /> Form A Ready
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--error)' }}>
                        <XCircle size={14} /> Missing
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                    {j.adminStatus.lastVerificationDate}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{stateFilings.length}</span>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/app/tax/pit/new?state=${j.stateCode}`)}>
                        File
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Detailed Jurisdiction Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {PIT_JURISDICTION_LIST.map((j) => (
          <Card key={j.stateCode}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>{j.authorityName}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Tax ID: <strong>{j.individualTaxIdRequirement.idName}</strong> • Deadline: March 31
                </div>
              </div>
              <Badge variant="purple">{j.authorityCode}</Badge>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Official Website:</strong>{' '}
                <a href={j.officialWebsite} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)' }}>
                  {j.officialWebsite}
                </a>
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Filing Template:</strong>{' '}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <FileSpreadsheet size={12} /> {j.returnTemplates[0]?.formName}
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>API Investigation:</strong> {j.adminStatus.apiInvestigationSummary}
              </div>
              <div style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <ShieldAlert size={13} /> Missing Requirements / External Dependencies
                </div>
                <ul style={{ margin: '0 0 0 16px' }}>
                  {j.adminStatus.missingRequirements.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
