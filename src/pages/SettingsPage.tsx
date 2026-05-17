import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  CreditCard, Shield, Sun, Moon,
  Check, Building, Trash2
} from 'lucide-react';
import { supabase, type Account } from '../lib/supabase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { MonoConnectButton } from '../components/MonoConnectButton';
import EmailSyncSetup from '../components/bank-sync/EmailSyncSetup';

type Section = 'profile' | 'accounts' | 'security' | 'appearance';

export default function SettingsPage() {
  const { user, profile, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [section, setSection] = useState<Section>('profile');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEmailSyncOpen, setIsEmailSyncOpen] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    business_name: '',
    phone: '',
    mode: 'business' as 'personal' | 'business',
    currency: 'NGN',
    staff_visibility_limit: '500000'
  });

  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        business_name: profile.business_name || '',
        phone: profile.phone || '',
        mode: profile.mode || 'business',
        currency: profile.currency || 'NGN',
        staff_visibility_limit: String(profile.staff_visibility_limit || 500000)
      });
    }
  }, [profile]);

  async function loadAccounts() {
    setLoadingAccounts(true);
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.id);
    setAccounts(data || []);
    setLoadingAccounts(false);
  }

  async function handleDeleteAccount(accountId: string) {
    if (!window.confirm("Are you sure you want to remove this linked account? All associated settings will be deleted.")) return;

    // Optimistic UI update
    setAccounts(prev => prev.filter(a => a.id !== accountId));

    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user!.id);

    if (error) {
      console.error("Failed to delete account:", error);
      alert("Failed to delete account. Please try again.");
      loadAccounts(); // Revert optimistic update
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    const { error } = await updateProfile({
      ...profileForm,
      staff_visibility_limit: Number(profileForm.staff_visibility_limit)
    });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 12px 100px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Manage your account, financial connections, and app preferences.</p>
      </div>

      {/* Mobile & Tablet Horizontal Scrollable Pills */}
      <div className="mobile-nav-tabs mobile-only" style={{ display: 'none' }}>
        {[
          { id: 'profile', label: 'Profile' },
          { id: 'accounts', label: 'Linked Accounts' },
          { id: 'security', label: 'Security' },
          { id: 'appearance', label: 'Appearance' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setSection(item.id as Section)}
            data-active={section === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mobile-col" style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div style={{
          width: 240, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--bg-border)', padding: 8, flexShrink: 0,
          position: 'sticky', top: 100
        }} className="mobile-hide">
          {[
            { id: 'profile', label: 'Business Profile', icon: <Building size={18} /> },
            { id: 'accounts', label: 'Linked Accounts', icon: <CreditCard size={18} /> },
            { id: 'security', label: 'Security', icon: <Shield size={18} /> },
            { id: 'appearance', label: 'Appearance', icon: <Sun size={18} /> }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id as Section)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 'var(--radius-md)', border: 'none',
                background: section === item.id ? 'var(--accent-dim)' : 'transparent',
                color: section === item.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {section === 'profile' && (
            <Card>
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Business Details</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>This information will be used for invoices and reports.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="mobile-col" style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      label="Owner Full Name"
                      value={profileForm.full_name}
                      onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Input
                      label="Business Registered Name"
                      value={profileForm.business_name}
                      onChange={e => setProfileForm({ ...profileForm, business_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mobile-col" style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      label="Business Phone"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Currency</label>
                    <select
                      value={profileForm.currency}
                      onChange={e => setProfileForm({ ...profileForm, currency: e.target.value })}
                      style={{
                        width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--bg-border)',
                        background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14
                      }}
                    >
                      <option value="NGN">NGN - Nigerian Naira</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="GBP">GBP - British Pound</option>
                    </select>
                  </div>
                </div>

                <Button
                  variant="primary"
                  onClick={handleSaveProfile}
                  loading={saving}
                  style={{ alignSelf: 'flex-start', marginTop: 12 }}
                >
                  {saved ? <><Check size={18} /> Saved</> : 'Save Changes'}
                </Button>
              </div>
            </Card>
          )}

          {section === 'appearance' && (
            <Card>
              <h3 style={{ fontSize: 15, marginBottom: 20 }}>Theme Preferences</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}>Interface Mode</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={() => theme !== 'light' && toggleTheme()}
                      style={{
                        flex: 1, padding: '16px', borderRadius: 12, border: '2px solid',
                        borderColor: theme === 'light' ? 'var(--accent-primary)' : 'var(--bg-border)',
                        background: 'var(--bg-card)', color: 'var(--text-primary)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer'
                      }}
                    >
                      <Sun size={14} /> Light
                    </button>
                    <button
                      onClick={() => theme !== 'dark' && toggleTheme()}
                      style={{
                        flex: 1, padding: '16px', borderRadius: 12, border: '2px solid',
                        borderColor: theme === 'dark' ? 'var(--accent-primary)' : 'var(--bg-border)',
                        background: 'var(--bg-card)', color: 'var(--text-primary)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer'
                      }}
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <MonoConnectButton onSuccess={loadAccounts} size="sm" />
                  <Button variant="secondary" size="sm" onClick={() => setIsEmailSyncOpen(true)}>
                    Email Sync
                  </Button>
                </div>
              </div>
              {loadingAccounts ? (
                <div>{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />)}</div>
              ) : accounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <CreditCard size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No accounts connected yet</p>
                  <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4 }}>
                    Use "Connect Bank" (Mono) or "Email Sync" for other banks.
                  </p>
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
                        width: 40, height: 40, borderRadius: 10,
                        background: acc.color || 'var(--accent-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                      }}>
                        <CreditCard size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{acc.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{acc.institution} • {acc.currency}</div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{acc.balance.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: acc.sync_source === 'email' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                          {acc.sync_source === 'email' ? 'Email Synced' : acc.sync_source === 'mono' ? 'Mono Synced' : 'Manual'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAccount(acc.id)}
                        style={{
                          background: 'none', border: 'none', padding: 8,
                          color: 'var(--text-muted)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 8, transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'var(--error-dim)'; e.currentTarget.style.color = 'var(--error)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Remove Account"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {section === 'security' && (
            <Card>
              <h3 style={{ fontSize: 15, marginBottom: 20 }}>Account Security</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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

      <EmailSyncSetup
        isOpen={isEmailSyncOpen}
        onClose={() => setIsEmailSyncOpen(false)}
        onSuccess={loadAccounts}
      />
    </div>
  );
}
