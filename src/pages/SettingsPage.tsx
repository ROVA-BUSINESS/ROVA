import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  CreditCard, Shield, Sun, Moon,
  Check, Building, Trash2, RefreshCw,
  MessageSquare, CheckCircle2, ExternalLink, Mic, Image, Zap
} from 'lucide-react';
import { supabase, syncAllBanks, type Account } from '../lib/supabase';
import { formatCurrency } from '../lib/format';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import BankConnectChoiceModal from '../components/BankConnectChoiceModal';


type Section = 'profile' | 'whatsapp' | 'accounts' | 'security' | 'appearance';

export default function SettingsPage() {
  const { user, profile, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [section, setSection] = useState<Section>('profile');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isBankChoiceOpen, setIsBankChoiceOpen] = useState(false);

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

  async function handleSyncBanks() {
    setIsSyncing(true);
    try {
      await syncAllBanks(user?.id);
      await loadAccounts();
    } catch (err) {
      console.error('Failed to sync banks:', err);
    } finally {
      setIsSyncing(false);
    }
  }

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
    } else {
      console.error("Failed to save profile:", error);
      alert("Failed to save profile: " + (error.message || "Unknown error"));
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 12px 100px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Manage your account, WhatsApp AI bot connections, and app preferences.</p>
      </div>

      {/* Mobile & Tablet Horizontal Scrollable Pills */}
      <div className="mobile-nav-tabs mobile-only" style={{ display: 'none' }}>
        {[
          { id: 'profile', label: 'Profile' },
          { id: 'whatsapp', label: 'WhatsApp Bot' },
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
            { id: 'whatsapp', label: 'WhatsApp Bot', icon: <MessageSquare size={18} /> },
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

          {section === 'whatsapp' && (
            <Card>
              <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800 }}>ROVA WhatsApp Bot Integration</h3>
                    <span style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: profileForm.phone ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: profileForm.phone ? '#10b981' : '#f59e0b',
                      border: profileForm.phone ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                      display: 'inline-flex', alignItems: 'center', gap: 4
                    }}>
                      <CheckCircle2 size={12} />
                      {profileForm.phone ? 'WhatsApp Number Linked' : 'Phone Required'}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Record expenses, upload receipt photos, and send voice notes directly to ROVA on WhatsApp.
                  </p>
                </div>

                <a
                  href={`https://wa.me/2349132957881?text=Hello%20ROVA!%20I%20want%20to%20start%20logging%20my%20transactions.`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    padding: '10px 20px', borderRadius: 'var(--radius-full)',
                    background: 'linear-gradient(135deg, #1da851, #128C3E)',
                    border: '1px solid rgba(18, 140, 62, 0.8)',
                    color: '#ffffff', fontSize: 13.5, fontWeight: 700,
                    textDecoration: 'none', boxShadow: '0 4px 16px rgba(18,140,62,0.35)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = 'linear-gradient(135deg, #25D366, #1da851)';
                    el.style.transform = 'translateY(-1px)';
                    el.style.boxShadow = '0 6px 22px rgba(18, 140, 62, 0.45)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = 'linear-gradient(135deg, #1da851, #128C3E)';
                    el.style.transform = 'none';
                    el.style.boxShadow = '0 4px 16px rgba(18,140,62,0.35)';
                  }}
                >
                  <img src="/whatsapp-logo.png" alt="WhatsApp" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
                  <span>Launch ROVA Bot on WhatsApp</span>
                  <ExternalLink size={14} style={{ opacity: 0.9, marginLeft: 2 }} />
                </a>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Phone linking box */}
                <div style={{
                  padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--bg-border)'
                }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Your WhatsApp Phone Number
                  </label>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    This number is used to identify your account when you text, record audio, or send receipt photos to ROVA Bot.
                  </p>
                  <div style={{ display: 'flex', gap: 12, maxWidth: 460 }}>
                    <Input
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="e.g. +2348012345678 or 08012345678"
                    />
                    <Button variant="primary" onClick={handleSaveProfile} loading={saving}>
                      {saved ? 'Saved!' : 'Save Phone'}
                    </Button>
                  </div>
                </div>

                {/* Capabilities grid */}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
                    What You Can Send to ROVA Bot:
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    <div style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--bg-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                        <Zap size={16} /> 1. Text Messages
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                        &ldquo;Paid ₦15,000 for generator fuel at Mobil station&rdquo;<br />
                        &ldquo;Received ₦250,000 payment from Client X&rdquo;
                      </p>
                    </div>

                    <div style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--bg-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                        <Mic size={16} /> 2. Voice Notes
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                        Hold down the voice record button and say:<br />
                        &ldquo;Hey ROVA, I just spent 45,000 Naira buying office supplies.&rdquo;
                      </p>
                    </div>

                    <div style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--bg-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                        <Image size={16} /> 3. Receipt Photos
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                        Snap a photo of your paper receipt or invoice. ROVA AI OCR extracts line items, totals, and merchants automatically.
                      </p>
                    </div>
                  </div>
                </div>
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
                  <Button variant="secondary" size="sm" onClick={handleSyncBanks} loading={isSyncing}>
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> Sync Banks
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setIsBankChoiceOpen(true)}>
                    + Connect Bank
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
                        background: (acc.color && acc.color.toLowerCase() === '#9333ea') ? 'var(--accent-primary)' : (acc.color || 'var(--accent-dim)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                      }}>
                        <CreditCard size={20} style={{ display: 'block' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{acc.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{acc.institution} • {acc.currency}</div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{formatCurrency(acc.balance || 0)}</div>
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

      <BankConnectChoiceModal
        open={isBankChoiceOpen}
        onClose={() => setIsBankChoiceOpen(false)}
        onSuccess={loadAccounts}
      />
    </div>
  );
}
