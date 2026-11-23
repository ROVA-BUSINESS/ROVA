import WhatsAppIcon from '../components/ui/WhatsAppIcon';
import { subscribeToPush, getExistingPushSubscription, isPushSupported } from '../lib/webPush.ts';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  CreditCard, Sun, Moon,
  Check, Building, Trash2, RefreshCw,
  AlertTriangle, Clock, Bell, Volume2, ChevronDown, Camera, Lock
} from 'lucide-react';
import { supabase, syncAllBanks, type Account } from '../lib/supabase';
import { formatCurrency } from '../lib/format';
import { getAccountingLockDate, setAccountingLockDate } from '../lib/smeAccountingService';
import { reopenGettingStartedGuide } from '../components/onboarding/GettingStartedGuide';
import BankConnectChoiceModal from '../components/BankConnectChoiceModal';
import {
  type TransactionReminderConfig,
  DEFAULT_REMINDER_CONFIG,
  getReminderConfig,
  saveReminderConfig,
  formatTimeDisplay,
  getBrowserNotificationPermission,
} from '../lib/transactionReminder';

type Tab = 'basics' | 'accounts' | 'notifications' | 'appearance' | 'security';

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara'
];

export default function SettingsPage() {
  const [waComingSoon, setWaComingSoon] = useState(false);
  const navigate = useNavigate();
  const { user, profile, updateProfile, signOut, isStaff, staffData } = useAuth();
  const canEditLockDate = !isStaff || (staffData as any)?.role?.toLowerCase() === 'accountant' || (staffData as any)?.role?.toLowerCase() === 'admin';
  const [lockDate, setLockDate] = useState('');
  const [savingLock, setSavingLock] = useState(false);
  const [lockSaved, setLockSaved] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>('basics');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isBankChoiceOpen, setIsBankChoiceOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Daily Transaction Reminder state
  const [reminderConfig, setReminderConfig] = useState<TransactionReminderConfig>(() =>
    user ? getReminderConfig(user.id) : DEFAULT_REMINDER_CONFIG
  );
  const [reminderPermission, setReminderPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [reminderSaved, setReminderSaved] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushSubscribing, setIsPushSubscribing] = useState(false);

  useEffect(() => {
    if (user) {
      setReminderConfig(getReminderConfig(user.id));
      setReminderPermission(getBrowserNotificationPermission());
      if (isPushSupported()) {
        getExistingPushSubscription().then((sub) => {
          setIsPushSubscribed(!!sub);
        });
      }
    }
  }, [user]);

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    business_name: '',
    phone: '',
    registration_type: 'registered' as 'registered' | 'unregistered',
    business_type: 'Retail & E-commerce',
    state: 'Lagos',
    city: 'Ikeja',
    address: '',
    country: 'Nigeria',
    logo_url: '',
    currency: 'NGN',
    staff_visibility_limit: '500000',
  });

  useEffect(() => {
    if (user) {
      loadAccounts();
      const ownerId = isStaff && staffData ? staffData.owner_id : user.id;
      getAccountingLockDate(ownerId).then((d) => setLockDate(d || ''));
    }
  }, [user, isStaff, staffData]);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        business_name: profile.business_name || '',
        phone: profile.phone || '',
        registration_type: profile.registration_type || 'registered',
        business_type: profile.business_type || 'Retail & E-commerce',
        state: profile.state || 'Lagos',
        city: profile.city || 'Ikeja',
        address: profile.address || '',
        country: profile.country || 'Nigeria',
        logo_url: profile.logo_url || '',
        currency: profile.currency || 'NGN',
        staff_visibility_limit: String(profile.staff_visibility_limit || 500000),
      });
    }
  }, [profile]);

  async function loadAccounts() {
    if (!user) return;
    setLoadingAccounts(true);
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id);
    setAccounts(data || []);
    setLoadingAccounts(false);
  }

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

  async function handleDeleteAccount(accountId: string) {
    if (!window.confirm('Are you sure you want to remove this linked account?')) return;
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user!.id);
    if (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account. Please try again.');
      loadAccounts();
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    const { error } = await updateProfile({
      ...profileForm,
      staff_visibility_limit: Number(profileForm.staff_visibility_limit),
    });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile: ' + (error.message || 'Unknown error'));
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo image must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setProfileForm((prev) => ({ ...prev, logo_url: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  async function handleDeleteUserAccount() {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeletingAccount(true);
    try {
      if (user) {
        await Promise.allSettled([
          supabase.from('transactions').delete().eq('user_id', user.id),
          supabase.from('invoices').delete().eq('user_id', user.id),
          supabase.from('expenses').delete().eq('user_id', user.id),
          supabase.from('accounts').delete().eq('user_id', user.id),
          supabase.from('categories').delete().eq('user_id', user.id),
          supabase.from('inventory_items').delete().eq('user_id', user.id),
          supabase.from('notifications').delete().eq('user_id', user.id),
          supabase.from('ai_pending_clarifications').delete().eq('user_id', user.id),
          supabase.from('team_members').delete().eq('owner_id', user.id),
          supabase.from('profiles').delete().eq('id', user.id),
        ]);
        await signOut();
        navigate('/');
      }
    } catch (err) {
      console.error('Account deletion error:', err);
      alert('Failed to delete account. Please contact support.');
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
    }
  }

  // Consistent card and input styles matching Patreon design
  const cardBg = isDark ? '#141416' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const inputBg = isDark ? '#1c1c20' : '#ffffff';
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : '#d1d5db';
  const inputFocusBorder = isDark ? '#60a5fa' : '#2563eb';
  const labelColor = isDark ? '#f3f4f6' : '#111827';
  const secondaryBtnBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6';
  const secondaryBtnText = isDark ? '#f3f4f6' : '#111827';
  const saveBtnBg = isDark ? '#ffffff' : '#000000';
  const saveBtnText = isDark ? '#000000' : '#ffffff';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'accounts', label: 'Account' },
    { id: 'notifications', label: 'Email & Notifications' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '16px 16px 120px', animation: 'fadeIn 0.25s ease' }}>
      {/* Title */}
      <h1
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: isDark ? '#ffffff' : '#0f172a',
          margin: '0 0 16px 0',
          letterSpacing: '-0.025em',
        }}
      >
        Settings
      </h1>

      {/* Horizontal Tabs with Underline Indicator */}
      <div
        style={{
          display: 'flex',
          gap: 28,
          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
          marginBottom: 32,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                position: 'relative',
                padding: '10px 0 14px 0',
                background: 'transparent',
                border: 'none',
                color: isActive
                  ? (isDark ? '#ffffff' : '#0284c7')
                  : (isDark ? '#9ca3af' : '#64748b'),
                fontSize: 14.5,
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s ease',
              }}
            >
              {tab.label}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: isDark ? '#38bdf8' : '#0284c7',
                    borderRadius: 2,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BASICS (Profile information) */}
      {activeTab === 'basics' && (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: 16,
            padding: '32px 36px',
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: isDark ? '#ffffff' : '#0f172a',
              margin: '0 0 24px 0',
            }}
          >
            Profile information
          </h2>

          {/* Profile Photo Row */}
          <div style={{ marginBottom: 26 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: labelColor,
                marginBottom: 10,
              }}
            >
              Profile
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {profileForm.logo_url ? (
                <img
                  src={profileForm.logo_url}
                  alt="Profile"
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `1px solid ${cardBorder}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: isDark ? '#27272a' : '#e2e8f0',
                    color: isDark ? '#cbd5e1' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 20,
                  }}
                >
                  {profileForm.full_name?.charAt(0) || profileForm.business_name?.charAt(0) || 'R'}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  background: secondaryBtnBg,
                  color: secondaryBtnText,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Camera size={14} />
                Upload photo
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Display name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: labelColor,
                  marginBottom: 8,
                }}
              >
                Display name
              </label>
              <input
                type="text"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                placeholder="Your full name"
                style={{
                  width: '100%',
                  height: 46,
                  padding: '0 14px',
                  borderRadius: 8,
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = inputFocusBorder)}
                onBlur={(e) => (e.target.style.borderColor = inputBorder)}
              />
            </div>

            {/* Business name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: labelColor,
                  marginBottom: 8,
                }}
              >
                Business name
              </label>
              <input
                type="text"
                value={profileForm.business_name}
                onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })}
                placeholder="Your registered or trading business name"
                style={{
                  width: '100%',
                  height: 46,
                  padding: '0 14px',
                  borderRadius: 8,
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = inputFocusBorder)}
                onBlur={(e) => (e.target.style.borderColor = inputBorder)}
              />
            </div>

            {/* Email */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: labelColor,
                  marginBottom: 8,
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                style={{
                  width: '100%',
                  height: 46,
                  padding: '0 14px',
                  borderRadius: 8,
                  background: isDark ? '#1a1a1f' : '#f8fafc',
                  border: `1px solid ${inputBorder}`,
                  color: isDark ? '#9ca3af' : '#64748b',
                  fontSize: 14,
                  outline: 'none',
                  cursor: 'not-allowed',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Country of Residence */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: labelColor,
                  marginBottom: 8,
                }}
              >
                Country of Residence
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={profileForm.country}
                  onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                  style={{
                    width: '100%',
                    height: 46,
                    padding: '0 40px 0 38px',
                    borderRadius: 8,
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: 14,
                    appearance: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = inputFocusBorder)}
                  onBlur={(e) => (e.target.style.borderColor = inputBorder)}
                >
                  <option value="Nigeria">Nigeria</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Ghana">Ghana</option>
                  <option value="Kenya">Kenya</option>
                  <option value="Canada">Canada</option>
                </select>
                <div
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 16,
                    pointerEvents: 'none',
                  }}
                >
                  {profileForm.country === 'Nigeria' ? '🇳🇬' : profileForm.country === 'United States' ? '🇺🇸' : profileForm.country === 'United Kingdom' ? '🇬🇧' : '🌍'}
                </div>
                <ChevronDown
                  size={16}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: isDark ? '#9ca3af' : '#64748b',
                  }}
                />
              </div>
            </div>

            {/* State of Residence */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: labelColor,
                  marginBottom: 8,
                }}
              >
                State of Residence
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={profileForm.state}
                  onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                  style={{
                    width: '100%',
                    height: 46,
                    padding: '0 40px 0 14px',
                    borderRadius: 8,
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: 14,
                    appearance: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = inputFocusBorder)}
                  onBlur={(e) => (e.target.style.borderColor = inputBorder)}
                >
                  {NIGERIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: isDark ? '#9ca3af' : '#64748b',
                  }}
                />
              </div>
            </div>

            {/* City & Address */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: labelColor,
                    marginBottom: 8,
                  }}
                >
                  City / LGA
                </label>
                <input
                  type="text"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                  placeholder="e.g. Ikeja"
                  style={{
                    width: '100%',
                    height: 46,
                    padding: '0 14px',
                    borderRadius: 8,
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = inputFocusBorder)}
                  onBlur={(e) => (e.target.style.borderColor = inputBorder)}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: labelColor,
                    marginBottom: 8,
                  }}
                >
                  Office / Business Address
                </label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  placeholder="Street address or shop location"
                  style={{
                    width: '100%',
                    height: 46,
                    padding: '0 14px',
                    borderRadius: 8,
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = inputFocusBorder)}
                  onBlur={(e) => (e.target.style.borderColor = inputBorder)}
                />
              </div>
            </div>

            {/* Registration Type & Business Type */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: labelColor,
                    marginBottom: 8,
                  }}
                >
                  Registration Type
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={profileForm.registration_type}
                    onChange={(e) => setProfileForm({ ...profileForm, registration_type: e.target.value as any })}
                    style={{
                      width: '100%',
                      height: 46,
                      padding: '0 40px 0 14px',
                      borderRadius: 8,
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                      color: isDark ? '#f8fafc' : '#0f172a',
                      fontSize: 14,
                      appearance: 'none',
                      outline: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = inputFocusBorder)}
                    onBlur={(e) => (e.target.style.borderColor = inputBorder)}
                  >
                    <option value="registered">Registered Business (CAC)</option>
                    <option value="unregistered">Unregistered Enterprise</option>
                  </select>
                  <ChevronDown
                    size={16}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: isDark ? '#9ca3af' : '#64748b',
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: labelColor,
                    marginBottom: 8,
                  }}
                >
                  Business Industry
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={profileForm.business_type}
                    onChange={(e) => setProfileForm({ ...profileForm, business_type: e.target.value })}
                    style={{
                      width: '100%',
                      height: 46,
                      padding: '0 40px 0 14px',
                      borderRadius: 8,
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                      color: isDark ? '#f8fafc' : '#0f172a',
                      fontSize: 14,
                      appearance: 'none',
                      outline: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = inputFocusBorder)}
                    onBlur={(e) => (e.target.style.borderColor = inputBorder)}
                  >
                    <option value="Retail & E-commerce">Retail &amp; E-commerce</option>
                    <option value="Food & Restaurant">Food &amp; Restaurant</option>
                    <option value="Professional Services">Professional Services</option>
                    <option value="Tech & Digital Agency">Tech &amp; Digital Agency</option>
                    <option value="Manufacturing & Logistics">Manufacturing &amp; Logistics</option>
                    <option value="Healthcare & Wellness">Healthcare &amp; Wellness</option>
                  </select>
                  <ChevronDown
                    size={16}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: isDark ? '#9ca3af' : '#64748b',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                style={{
                  padding: '11px 28px',
                  borderRadius: 10,
                  background: saveBtnBg,
                  color: saveBtnText,
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: saving ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'opacity 0.15s ease',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saved ? (
                  <>
                    <Check size={16} /> Saved
                  </>
                ) : saving ? (
                  'Saving...'
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNTS (Linked Banks & Cards) */}
      {activeTab === 'accounts' && (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: 16,
            padding: '32px 36px',
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', margin: '0 0 4px 0' }}>
                Linked Financial Accounts
              </h2>
              <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#64748b', margin: 0 }}>
                Manage your connected bank feeds, live balances, and syncing channels.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={handleSyncBanks}
                disabled={isSyncing}
                style={{
                  padding: '9px 16px',
                  borderRadius: 10,
                  background: secondaryBtnBg,
                  color: secondaryBtnText,
                  border: `1px solid ${cardBorder}`,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                Sync Banks
              </button>
              <button
                type="button"
                onClick={() => setIsBankChoiceOpen(true)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  background: saveBtnBg,
                  color: saveBtnText,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Connect Bank
              </button>
            </div>
          </div>

          {loadingAccounts ? (
            <div>
              {[1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12, marginBottom: 10 }} />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 16px',
                border: `1px dashed ${cardBorder}`,
                borderRadius: 12,
              }}
            >
              <CreditCard size={36} color={isDark ? '#64748b' : '#94a3b8'} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#f1f5f9' : '#1e293b' }}>
                No financial accounts linked yet
              </div>
              <p style={{ color: isDark ? '#9ca3af' : '#64748b', fontSize: 13, margin: '6px 0 16px' }}>
                Connect your business bank accounts to auto-import statement transactions.
              </p>
              <button
                type="button"
                onClick={() => setIsBankChoiceOpen(true)}
                style={{
                  padding: '9px 20px',
                  borderRadius: 10,
                  background: saveBtnBg,
                  color: saveBtnText,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Connect Your First Bank
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: 12,
                    background: isDark ? '#1a1a1f' : '#f8fafc',
                    border: `1px solid ${cardBorder}`,
                    gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                      }}
                    >
                      <Building size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>
                        {acc.name}
                      </div>
                      <div style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#64748b' }}>
                        {acc.institution} • {acc.currency}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>
                        {formatCurrency(acc.balance || 0)}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: acc.sync_source === 'email' ? '#0284c7' : '#10b981',
                        }}
                      >
                        {acc.sync_source === 'email' ? 'Email Feed' : 'Direct API'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(acc.id)}
                      title="Remove Account"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: 8,
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: NOTIFICATIONS (Daily Reminders & WhatsApp) */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Daily Reminders Card */}
          <div
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 16,
              padding: '32px 36px',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', margin: 0 }}>
                  Daily Transaction Reminders
                </h2>
                <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#64748b', margin: '2px 0 0' }}>
                  Get automated daily reminders to record expenses and categorize sales.
                </p>
              </div>
            </div>

            {/* Toggle row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: 12,
                background: isDark ? '#1a1a1f' : '#f8fafc',
                border: `1px solid ${cardBorder}`,
                marginBottom: 20,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
                  Enable Daily Alerts
                </div>
                <div style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#64748b', marginTop: 2 }}>
                  {reminderConfig.enabled ? `Active at ${formatTimeDisplay(reminderConfig.time)}` : 'Reminders are paused'}
                </div>
              </div>

              <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={reminderConfig.enabled}
                  onChange={(e) => setReminderConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 24,
                    background: reminderConfig.enabled ? '#0284c7' : (isDark ? '#374151' : '#cbd5e1'),
                    transition: '0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      height: 18,
                      width: 18,
                      left: reminderConfig.enabled ? 23 : 3,
                      bottom: 3,
                      borderRadius: '50%',
                      background: 'white',
                      transition: '0.2s',
                    }}
                  />
                </span>
              </label>
            </div>

            {/* Time Picker & Presets */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: labelColor, marginBottom: 8 }}>
                Reminder Time
              </label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <input
                  type="time"
                  value={reminderConfig.time}
                  onChange={(e) => setReminderConfig((prev) => ({ ...prev, time: e.target.value }))}
                  style={{
                    height: 44,
                    padding: '0 14px',
                    borderRadius: 8,
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: 15,
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['18:00', '19:00', '20:00', '21:00', '22:00'].map((time) => {
                    const isSel = reminderConfig.time === time;
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setReminderConfig((prev) => ({ ...prev, time }))}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: isSel ? (isDark ? '#ffffff' : '#000000') : secondaryBtnBg,
                          color: isSel ? (isDark ? '#000000' : '#ffffff') : secondaryBtnText,
                          border: isSel ? 'none' : `1px solid ${cardBorder}`,
                        }}
                      >
                        {formatTimeDisplay(time)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Channels & Sound */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: 12,
                  background: isDark ? '#1a1a1f' : '#f8fafc',
                  border: `1px solid ${cardBorder}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Bell size={18} color="#0284c7" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
                      Push Notifications
                    </div>
                    <div style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#64748b' }}>
                      Sends lock-screen alerts to your phone or desktop
                    </div>
                  </div>
                </div>

                {reminderPermission === 'denied' ? (
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>Blocked in browser</span>
                ) : isPushSubscribed ? (
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Active</span>
                ) : (
                  <button
                    type="button"
                    disabled={isPushSubscribing}
                    onClick={async () => {
                      if (!user?.id) return;
                      setIsPushSubscribing(true);
                      const res = await subscribeToPush(user.id);
                      setIsPushSubscribing(false);
                      if (res.success) {
                        setIsPushSubscribed(true);
                        setReminderPermission('granted');
                        setReminderConfig((prev) => ({ ...prev, notifyBrowser: true }));
                      } else {
                        setReminderPermission(getBrowserNotificationPermission());
                      }
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      background: saveBtnBg,
                      color: saveBtnText,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isPushSubscribing ? 'Enabling...' : 'Enable Alerts'}
                  </button>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', color: labelColor }}>
                <input
                  type="checkbox"
                  checked={reminderConfig.sound}
                  onChange={(e) => setReminderConfig((prev) => ({ ...prev, sound: e.target.checked }))}
                />
                <Volume2 size={16} color={isDark ? '#9ca3af' : '#64748b'} />
                <span>Play a reminder sound chime</span>
              </label>
            </div>

            {/* Save Reminder Button */}
            <button
              type="button"
              onClick={() => {
                if (!user) return;
                saveReminderConfig(user.id, reminderConfig);
                setReminderSaved(true);
                setTimeout(() => setReminderSaved(false), 2500);
              }}
              style={{
                padding: '11px 28px',
                borderRadius: 10,
                background: saveBtnBg,
                color: saveBtnText,
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {reminderSaved ? (
                <>
                  <Check size={16} /> Saved!
                </>
              ) : (
                'Save Reminder Settings'
              )}
            </button>
          </div>

          {/* WhatsApp Card */}
          <div
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 16,
              padding: '32px 36px',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#25D366',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <WhatsAppIcon size={20} color="#ffffff" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', margin: 0 }}>
                    ROVA WhatsApp Assistant
                  </h2>
                  <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#64748b', margin: '2px 0 0' }}>
                    Record expenses, send voice notes, and capture receipt images directly on WhatsApp.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setWaComingSoon(true)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  background: '#25D366',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <WhatsAppIcon size={16} color="#ffffff" />
                <span>{waComingSoon ? 'Launching Soon' : 'Launch Bot'}</span>
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: labelColor, marginBottom: 8 }}>
                WhatsApp Phone Number
              </label>
              <div style={{ display: 'flex', gap: 12, maxWidth: 440 }}>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="e.g. 08012345678"
                  style={{
                    flex: 1,
                    height: 44,
                    padding: '0 14px',
                    borderRadius: 8,
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: 14,
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = inputFocusBorder)}
                  onBlur={(e) => (e.target.style.borderColor = inputBorder)}
                />
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  style={{
                    padding: '0 20px',
                    borderRadius: 8,
                    background: saveBtnBg,
                    color: saveBtnText,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: 16,
            padding: '32px 36px',
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', margin: '0 0 8px 0' }}>
            Theme &amp; Appearance
          </h2>
          <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#64748b', margin: '0 0 24px 0' }}>
            Choose your preferred color theme for your workspace.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <button
              type="button"
              onClick={() => theme !== 'light' && toggleTheme()}
              style={{
                padding: '24px 20px',
                borderRadius: 12,
                border: `2px solid ${!isDark ? (isDark ? '#38bdf8' : '#0284c7') : cardBorder}`,
                background: !isDark ? (isDark ? '#1a1a1f' : '#f0fdf4') : inputBg,
                color: isDark ? '#f8fafc' : '#0f172a',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                transition: 'all 0.15s ease',
              }}
            >
              <Sun size={28} color={!isDark ? '#0284c7' : '#9ca3af'} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>Light Mode</div>
              <div style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#64748b', textAlign: 'center' }}>
                Clean white surfaces with high contrast text
              </div>
            </button>

            <button
              type="button"
              onClick={() => theme !== 'dark' && toggleTheme()}
              style={{
                padding: '24px 20px',
                borderRadius: 12,
                border: `2px solid ${isDark ? '#38bdf8' : cardBorder}`,
                background: isDark ? '#1a1a1f' : '#ffffff',
                color: isDark ? '#f8fafc' : '#0f172a',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                transition: 'all 0.15s ease',
              }}
            >
              <Moon size={28} color={isDark ? '#38bdf8' : '#9ca3af'} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>Dark Mode</div>
              <div style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#64748b', textAlign: 'center' }}>
                OLED-friendly dark surfaces easy on the eyes
              </div>
            </button>
          </div>

          {!isStaff && user?.id && (
            <div
              style={{
                marginTop: 28,
                paddingTop: 24,
                borderTop: `1px solid ${cardBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
                  Getting Started Setup Guide
                </div>
                <div style={{ fontSize: 12.5, color: isDark ? '#9ca3af' : '#64748b', marginTop: 3 }}>
                  Re-open the interactive onboarding &amp; migration checklist in the top header bar.
                </div>
              </div>
              <button
                type="button"
                onClick={() => reopenGettingStartedGuide(user.id)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  background: saveBtnBg,
                  color: saveBtnText,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Show Setup Guide
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SECURITY */}
      {activeTab === 'security' && (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: 16,
            padding: '32px 36px',
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', margin: '0 0 8px 0' }}>
              Account Security &amp; Period Controls
            </h2>
            <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#64748b', margin: 0 }}>
              Lock closed accounting periods to protect reconciled financials, and manage data erasure.
            </p>
          </div>

          {/* Accounting Period Lock Card */}
          <div
            style={{
              padding: '20px 24px',
              borderRadius: 12,
              background: isDark ? '#1a1a1f' : '#f8fafc',
              border: `1px solid ${cardBorder}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDark ? '#c084fc' : '#7c3aed', marginBottom: 6 }}>
              <Lock size={18} />
              <div style={{ fontSize: 15, fontWeight: 700 }}>Accounting Period Lock Date</div>
            </div>
            <p style={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.55, margin: '0 0 14px 0' }}>
              Block creating, editing, or deleting any transactions, invoices, bills, credit notes, or journal entries dated on or before the lock date. Enforced in both the app and database.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="date"
                value={lockDate}
                disabled={!canEditLockDate}
                onChange={(e) => setLockDate(e.target.value)}
                style={{
                  height: 42,
                  padding: '0 14px',
                  borderRadius: 8,
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                  opacity: canEditLockDate ? 1 : 0.6,
                }}
              />
              {canEditLockDate ? (
                <>
                  <button
                    type="button"
                    disabled={savingLock}
                    onClick={async () => {
                      if (!user) return;
                      setSavingLock(true);
                      try {
                        const ownerId = isStaff && staffData ? staffData.owner_id : user.id;
                        await setAccountingLockDate(ownerId, user.id, lockDate || null);
                        setLockSaved(true);
                        setTimeout(() => setLockSaved(false), 2500);
                      } catch (err: any) {
                        alert('Failed to save lock date: ' + (err.message || 'Unknown error'));
                      } finally {
                        setSavingLock(false);
                      }
                    }}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 8,
                      background: saveBtnBg,
                      color: saveBtnText,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {lockSaved ? 'Lock Date Saved ✓' : savingLock ? 'Saving...' : 'Save Lock Date'}
                  </button>
                  {lockDate && (
                    <button
                      type="button"
                      disabled={savingLock}
                      onClick={async () => {
                        if (!user || !window.confirm('Remove accounting period lock?')) return;
                        setSavingLock(true);
                        try {
                          const ownerId = isStaff && staffData ? staffData.owner_id : user.id;
                          await setAccountingLockDate(ownerId, user.id, null);
                          setLockDate('');
                        } finally {
                          setSavingLock(false);
                        }
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: secondaryBtnBg,
                        color: secondaryBtnText,
                        border: `1px solid ${cardBorder}`,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Unlock Period
                    </button>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#64748b' }}>
                  Only Business Owners, Admins, or Accountants can modify the lock date.
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              padding: '20px 24px',
              borderRadius: 12,
              background: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', marginBottom: 8 }}>
              <AlertTriangle size={18} />
              <div style={{ fontSize: 15, fontWeight: 700 }}>Danger Zone — Delete Account</div>
            </div>
            <p style={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              Permanently delete your ROVA account and all associated transactions, invoices, inventory, reports, and banking credentials. This action is irreversible.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmText('');
                setShowDeleteModal(true);
              }}
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Delete Account
            </button>
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: cardBg,
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: 28,
              boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', marginBottom: 12 }}>
              <AlertTriangle size={22} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Delete Account Permanently</h3>
            </div>
            <p style={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.5, marginBottom: 16 }}>
              This will permanently delete your ROVA account, business profile, all recorded transactions, invoices, inventory, connected bank accounts, and reports. <strong>This action cannot be undone.</strong>
            </p>
            <p style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#64748b', marginBottom: 8 }}>
              Please type <strong style={{ color: isDark ? '#ffffff' : '#0f172a' }}>DELETE</strong> to confirm:
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              style={{
                width: '100%',
                height: 44,
                padding: '0 14px',
                borderRadius: 8,
                background: inputBg,
                border: `1px solid ${inputBorder}`,
                color: isDark ? '#f8fafc' : '#0f172a',
                fontSize: 14,
                outline: 'none',
                marginBottom: 20,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                disabled={isDeletingAccount}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  background: secondaryBtnBg,
                  color: secondaryBtnText,
                  border: `1px solid ${cardBorder}`,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
                onClick={handleDeleteUserAccount}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: deleteConfirmText === 'DELETE' ? 'pointer' : 'not-allowed',
                  opacity: deleteConfirmText === 'DELETE' ? 1 : 0.5,
                }}
              >
                {isDeletingAccount ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BankConnectChoiceModal
        open={isBankChoiceOpen}
        onClose={() => setIsBankChoiceOpen(false)}
        onSuccess={loadAccounts}
      />
    </div>
  );
}
