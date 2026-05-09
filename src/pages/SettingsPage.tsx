import { useEffect, useState, type FormEvent } from 'react';
import { Trash2, User, CreditCard, Shield, Palette, Moon, Sun } from 'lucide-react';
import { supabase, type Account } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency } from '../lib/format';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { MonoConnectButton } from '../components/MonoConnectButton';

type Section = 'profile' | 'accounts' | 'security' | 'appearance';

export default function SettingsPage() {
  const { user, profile, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [section, setSection] = useState<Section>('profile');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: '', business_name: '', phone: '', mode: 'business', currency: 'NGN', staff_visibility_limit: '500000',
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        business_name: profile.business_name || '',
        phone: profile.phone || '',
        mode: profile.mode || 'business',
        currency: profile.currency || 'NGN',
        staff_visibility_limit: profile.staff_visibility_limit ? String(profile.staff_visibility_limit) : '500000',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (user) loadAccounts();
  }, [user]);

  async function loadAccounts() {
    setLoadingAccounts(true);
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user!.id).order('created_at');
    setAccounts(data || []);
    setLoadingAccounts(false);
  }

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateProfile({
      ...profileForm,
      staff_visibility_limit: Number(profileForm.staff_visibility_limit) || 500000,
    } as any);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this account? This will not delete associated transactions.')) return;
    await supabase.from('accounts').delete().eq('id', id);
    setAccounts(prev => prev.filter(a => a.id !== id));
  }

  async function toggleAccountActive(account: Account) {
    await supabase.from('accounts').update({ is_active: !account.is_active }).eq('id', account.id);
    setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, is_active: !a.is_active } : a));
  }

  const sectionNav = [
    { key: 'profile' as Section, label: 'Profile', icon: User },
    { key: 'appearance' as Section, label: 'Appearance', icon: Palette },
    { key: 'accounts' as Section, label: 'Accounts', icon: CreditCard },
    { key: 'security' as Section, label: 'Security', icon: Shield },
  ];

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 900, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Manage your profile, accounts, and preferences</p>
      </div>

      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        <div className="mobile-nav-tabs" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sectionNav.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              data-active={section === key}
              onClick={() => setSection(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 'var(--radius-md)', textAlign: 'left', fontSize: 13,
                background: section === key ? 'var(--accent-dim)' : 'transparent',
                color: section === key ? 'var(--accent-light)' : 'var(--text-muted)',
                fontWeight: section === key ? 600 : 400,
                borderLeft: `2px solid ${section === key ? 'var(--accent-primary)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div>
          {section === 'profile' && (
            <Card>
              <h3 style={{ fontSize: 15, marginBottom: 20 }}>Profile Information</h3>
              <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Input
                    label="Full Name"
                    value={profileForm.full_name}
                    onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="John Doe"
                  />
                  <Input
                    label="Business Name"
                    value={profileForm.business_name}
                    onChange={e => setProfileForm(p => ({ ...p, business_name: e.target.value }))}
                    placeholder="Acme Ltd"
                  />
                </div>
                <Input
                  label="Phone Number"
                  value={profileForm.phone}
                  onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+234 000 000 0000"
                />

                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Currency</label>
                  <select
                    value={profileForm.currency}
                    onChange={e => setProfileForm(p => ({ ...p, currency: e.target.value }))}
                    style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
                  >
                    <option value="NGN">NGN — Nigerian Naira (₦)</option>
                    <option value="USD">USD — US Dollar ($)</option>
                    <option value="GBP">GBP — British Pound (£)</option>
                    <option value="EUR">EUR — Euro (€)</option>
                    <option value="GHS">GHS — Ghana Cedi (₵)</option>
                    <option value="KES">KES — Kenyan Shilling (KSh)</option>
                  </select>
                </div>
                
                <div style={{ padding: '16px', background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Shield size={16} color="var(--warning)" />
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Team Security Controls</h4>
                  </div>
                  <Input
                    label="Staff Visibility Threshold (Amount)"
                    type="number"
                    min="0"
                    step="1000"
                    value={profileForm.staff_visibility_limit}
                    onChange={e => setProfileForm(p => ({ ...p, staff_visibility_limit: e.target.value }))}
                    placeholder="500000"
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                    Staff members will not be able to view individual transactions, invoices, or cash movements exceeding this amount. Their dashboard totals will also exclude these high-value items.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Button variant="primary" loading={saving} type="submit">Save Changes</Button>
                  {saved && <span style={{ fontSize: 13, color: 'var(--success)' }}>Saved!</span>}
                </div>
              </form>

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Email: </span>{user?.email}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Member since: </span>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' }) : '—'}
                </div>
              </div>
            </Card>
          )}

          {section === 'appearance' && (
            <Card>
              <h3 style={{ fontSize: 15, marginBottom: 20 }}>Appearance</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Theme Preference</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Toggle between light and dark mode</div>
                  </div>
                  <div style={{ display: 'flex', background: 'var(--bg-base)', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                    <button
                      onClick={() => theme === 'dark' && toggleTheme()}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500, background: theme === 'light' ? 'var(--bg-elevated)' : 'transparent', color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: theme === 'light' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
                    >
                      <Sun size={14} /> Light
                    </button>
                    <button
                      onClick={() => theme === 'light' && toggleTheme()}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500, background: theme === 'dark' ? 'var(--bg-elevated)' : 'transparent', color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: theme === 'dark' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
                    >
                      <Moon size={14} /> Dark
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {section === 'accounts' && (
            <Card>
              <div className="mobile-col mobile-gap-4" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, flex: 1 }}>Financial Accounts</h3>
                <MonoConnectButton onSuccess={loadAccounts} size="sm" />
              </div>
              {loadingAccounts ? (
                <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />)}</div>
              ) : accounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <CreditCard size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No accounts connected yet</p>
                  <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4 }}>Use "Connect Bank" to link your bank account via Mono</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {accounts.map(acc => (
                    <div key={acc.id} className="mobile-col" style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-md)',
                        background: acc.color || '#9333ea',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <CreditCard size={16} color="white" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: acc.is_active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{acc.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {acc.type}{acc.institution ? ` · ${acc.institution}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                        {formatCurrency(acc.balance)}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-start' }}>
                        <button
                          onClick={() => toggleAccountActive(acc)}
                          style={{
                            padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                            background: acc.is_active ? 'var(--success-dim)' : 'var(--bg-hover)',
                            color: acc.is_active ? 'var(--success)' : 'var(--text-muted)',
                            border: `1px solid ${acc.is_active ? 'rgba(34,197,94,0.2)' : 'var(--bg-border)'}`,
                          }}
                        >
                          {acc.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <button onClick={() => deleteAccount(acc.id)}
                          style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                        ><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {section === 'security' && (
            <Card>
              <h3 style={{ fontSize: 15, marginBottom: 20 }}>Security</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Email</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user?.email}</div>
                </div>
                <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Password</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Last changed: Not available</div>
                  <Button variant="secondary" size="sm">Change Password</Button>
                </div>
                <div style={{ padding: '14px', background: 'var(--error-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--error)', marginBottom: 4 }}>Danger Zone</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Permanently delete your account and all associated data.</div>
                  <Button variant="danger" size="sm">Delete Account</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>


    </div>
  );
}
