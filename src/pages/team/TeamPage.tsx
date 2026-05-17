import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, Shield, Users, Activity, Clock, CircleCheck as CheckCircle, Circle as XCircle, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase, type TeamMember, type ActivityLog } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

type Tab = 'members' | 'activity';

const ROLE_DESCRIPTIONS: Record<TeamMember['role'], string> = {
  admin: 'Full access — can manage everything',
  staff: 'View dashboard & transactions only',
};

const ROLE_VARIANT: Record<TeamMember['role'], 'error' | 'warning' | 'info' | 'default'> = {
  admin: 'error', staff: 'info',
};

const ACTION_ICONS: Record<ActivityLog['action'], React.ElementType> = {
  created: CheckCircle, updated: AlertCircle, deleted: XCircle,
  viewed: Activity, processed: CheckCircle, sent: CheckCircle,
  paid: CheckCircle, approved: CheckCircle,
};

const ACTION_COLORS: Record<ActivityLog['action'], string> = {
  created: 'var(--success)', updated: 'var(--warning)', deleted: 'var(--error)',
  viewed: 'var(--text-muted)', processed: 'var(--success)', sent: 'var(--info)',
  paid: 'var(--success)', approved: 'var(--success)',
};

export default function TeamPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ fullName: '', invite_email: '', role: 'staff' as TeamMember['role'] });
  const [saving, setSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [membersRes, logsRes] = await Promise.all([
      supabase.from('team_members').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('activity_logs').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false }).limit(100),
    ]);
    setMembers(membersRes.data || []);
    setLogs(logsRes.data || []);
    setLoading(false);
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError('');
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.invite_email,
          role: form.role,
          redirectTo: `${window.location.origin}/accept-invite`,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to invite staff');

      setShowModal(false);
      setForm({ fullName: '', invite_email: '', role: 'staff' });
      loadData();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invite.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string, email: string) {
    if (!confirm(`Remove ${email} from your team?`)) return;
    await supabase.from('team_members').delete().eq('id', id);
    await supabase.from('activity_logs').insert({
      user_id: user!.id, owner_id: user!.id,
      action: 'deleted', entity_type: 'team_member', entity_label: email,
    });
    loadData();
  }

  async function updateRole(id: string, role: TeamMember['role']) {
    await supabase.from('team_members').update({ role }).eq('id', id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'members', label: 'Team Members', icon: Users },
    { key: 'activity', label: 'Activity Log', icon: Activity },
  ];

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1000, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Team & Access Control</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Manage team members, roles, and monitor all activity</p>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px',
              borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500,
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.15s', boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
              border: tab === t.key ? '1px solid var(--bg-border)' : '1px solid transparent',
            }}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'members' && (
        <div>
          <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
            {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
              <Card key={role} style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Shield size={14} color="var(--accent-light)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{role}</span>
                  <Badge variant={ROLE_VARIANT[role as TeamMember['role']]}>{role}</Badge>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</p>
              </Card>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Team Members ({members.length})</h3>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>Invite Member</Button>
          </div>

          {loading ? (
            <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 64, marginBottom: 10 }} />)}</div>
          ) : members.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Users size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No team members yet</p>
                <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4, marginBottom: 16 }}>Invite accountants, staff, or collaborators</p>
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>Invite Member</Button>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(member => (
                <Card key={member.id} style={{ padding: '14px 16px' }}>
                  <div className="mobile-col" style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Users size={15} color="var(--text-muted)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.invite_email}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                          Invited {formatDate(member.invited_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} className="mobile-gap-4">
                      <select value={member.role} onChange={e => updateRole(member.id, e.target.value as TeamMember['role'])}
                        style={{ padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}>
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                      </select>
                      <Badge variant={member.status === 'active' ? 'success' : member.status === 'pending' ? 'warning' : 'error'}>
                        {member.status}
                      </Badge>
                      <button onClick={() => handleRemove(member.id, member.invite_email)}
                        style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                      ><Trash2 size={13} /></button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Activity Log</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 100 actions</span>
          </div>
          {loading ? (
            <div>{[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />)}</div>
          ) : logs.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Clock size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No activity recorded yet</p>
                <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4 }}>Actions will appear here as your team uses ROVA</p>
              </div>
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {logs.map((log, i) => {
                const Icon = ACTION_ICONS[log.action] || Activity;
                const color = ACTION_COLORS[log.action] || 'var(--text-muted)';
                return (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--bg-border)' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-elevated)', border: `1px solid var(--bg-border)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Icon size={13} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        <span style={{ fontWeight: 600, color }}>{log.action}</span>
                        {' '}{log.entity_type.replace('_', ' ')}
                        {log.entity_label ? <span style={{ color: 'var(--text-secondary)' }}> — {log.entity_label}</span> : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(log.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); setInviteError(''); }} title="Invite Team Member" size="sm">
        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Full Name" placeholder="Jane Doe" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} required />
          <Input label="Email Address" type="email" placeholder="colleague@company.com" value={form.invite_email} onChange={e => setForm(p => ({ ...p, invite_email: e.target.value }))} required />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as TeamMember['role'] }))}
              style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="admin">Admin — Full access</option>
              <option value="staff">Staff — Dashboard & transactions</option>
            </select>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)' }}>
              {ROLE_DESCRIPTIONS[form.role]}
            </div>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--info-dim)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)' }}>
            An invite email will be sent. They must click the link to set their password and activate their account.
          </div>
          {inviteError && (
            <div style={{ padding: '10px 12px', background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: 13 }}>
              {inviteError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); setInviteError(''); }}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">Send Invite</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
