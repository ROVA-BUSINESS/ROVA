import { useState } from 'react';
import { Mail, AlertCircle, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

interface EmailSyncSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NIGERIAN_BANKS = [
  { name: 'Access Bank', sender: 'alerts@accessbankplc.com' },
  { name: 'Citibank Nigeria', sender: 'alerts@citi.com' },
  { name: 'Ecobank Nigeria', sender: 'alerts@ecobank.com' },
  { name: 'Fidelity Bank', sender: 'alerts@fidelitybank.ng' },
  { name: 'First Bank of Nigeria', sender: 'firstcontact@firstbanknigeria.com' },
  { name: 'First City Monument Bank (FCMB)', sender: 'ebusiness@fcmb.com' },
  { name: 'Globus Bank', sender: 'alerts@globusbank.com' },
  { name: 'Guaranty Trust Bank (GTB)', sender: 'geonea@gtbank.com' },
  { name: 'Heritage Bank', sender: 'alerts@hbng.com' },
  { name: 'Keystone Bank', sender: 'alerts@keystonebankng.com' },
  { name: 'Kuda Bank', sender: 'alerts@kudabank.com' },
  { name: 'Moniepoint', sender: 'alerts@moniepoint.com' },
  { name: 'Opay', sender: 'alerts@opayweb.com' },
  { name: 'Palmpay', sender: 'alerts@palmpay.com' },
  { name: 'Polaris Bank', sender: 'alerts@polarisbanklimited.com' },
  { name: 'Providus Bank', sender: 'alerts@providusbank.com' },
  { name: 'Stanbic IBTC Bank', sender: 'alerts@stanbicibtc.com' },
  { name: 'Standard Chartered Bank', sender: 'alerts@sc.com' },
  { name: 'Sterling Bank', sender: 'alerts@sterling.ng' },
  { name: 'SunTrust Bank', sender: 'alerts@suntrustng.com' },
  { name: 'Titan Trust Bank', sender: 'alerts@titantrustbank.com' },
  { name: 'Union Bank of Nigeria', sender: 'alerts@unionbankng.com' },
  { name: 'United Bank for Africa (UBA)', sender: 'cfc@ubagroup.com' },
  { name: 'Unity Bank', sender: 'alerts@unitybankng.com' },
  { name: 'VFD Microfinance Bank', sender: 'alerts@vfd.com' },
  { name: 'Wema Bank', sender: 'alerts@wemabank.com' },
  { name: 'Zenith Bank', sender: 'alertz@zenithbank.com' },
];

export default function EmailSyncSetup({ isOpen, onClose, onSuccess }: EmailSyncSetupProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    bankName: '',
    accountNumber: '',
    emailAddress: '',
    provider: 'gmail' as 'gmail' | 'outlook'
  });

  async function handleSetup(provider: 'gmail' | 'outlook') {
    if (!formData.bankName || !formData.accountNumber || !formData.emailAddress) {
      setError('Please fill all fields');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // 1. Create the account record
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .insert({
          user_id: user!.id,
          name: `${formData.bankName} (Email)`,
          institution: formData.bankName,
          type: 'bank',
          sync_source: 'email',
          sync_status: 'pending',
          sync_account_id: formData.accountNumber
        })
        .select()
        .single();

      if (accError) throw accError;

      // 2. Save sync settings
      const bank = NIGERIAN_BANKS.find(b => b.name === formData.bankName);
      const { error: settingsError } = await supabase
        .from('bank_email_sync_settings')
        .insert({
          user_id: user!.id,
          account_id: account.id,
          bank_name: formData.bankName,
          account_number: formData.accountNumber,
          email_address: formData.emailAddress,
          provider: provider,
          bank_sender_address: bank?.sender || 'alerts@bank.com'
        });

      if (settingsError) throw settingsError;

      // 3. Generate OAuth URL and redirect
      if (provider === 'gmail') {
        const clientId = "171458072202-" + "719a77v3e8paplevqouq3a5io0a4b7h4.apps.googleusercontent.com";
        const redirectUri = window.location.origin.includes('localhost') 
          ? 'http://localhost:3000/auth/callback/gmail' 
          : 'https://rovabusiness.com/auth/callback/gmail';
        
        // We pass the account.id in the state parameter so we know which account to update on callback
        const state = encodeURIComponent(JSON.stringify({ accountId: account.id }));
        const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly');
        
        const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
        
        window.location.href = oauthUrl;
      } else {
        setFormData(prev => ({ ...prev, provider }));
        setStep(3); // Outlook not yet implemented
      }
    } catch (err: any) {
      console.error("Setup Error:", err);
      setError(err.message || "An error occurred while connecting the bank. Please ensure your database is updated.");
    } finally {
      setLoading(false);
    }
  }

  function handleOAuth() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess();
      onClose();
    }, 2000);
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Setup Email Bank Sync">
      <div style={{ padding: '8px 4px' }}>
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ padding: 16, background: 'rgba(147,51,234,0.05)', borderRadius: 12, border: '1px solid rgba(147,51,234,0.1)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ padding: 8, background: 'var(--accent-primary)', borderRadius: 8 }}>
                  <Mail size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>How it works</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    We'll securely scan your bank alerts to record transactions and update your balance automatically.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Select Bank</label>
                <select 
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--bg-border)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14
                  }}
                >
                  <option value="">Select a bank...</option>
                  {NIGERIAN_BANKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>

              <Input 
                label="Account Number"
                placeholder="0123456789"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              />

              <Input 
                label="Business Email Address"
                placeholder="finance@yourcompany.com"
                type="email"
                value={formData.emailAddress}
                onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
              />
            </div>

            {error && (
              <div style={{ display: 'flex', gap: 8, padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: 12 }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <Button 
              variant="primary" 
              fullWidth 
              onClick={() => setStep(2)}
              disabled={!formData.bankName || !formData.accountNumber || !formData.emailAddress}
            >
              Next: Connect Provider
            </Button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, textAlign: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Connect your Inbox</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Choose your email provider to grant ROVA read-only access to your bank alerts.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button 
                onClick={() => handleSetup('gmail')}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 16, borderRadius: 12, border: '1px solid var(--bg-border)',
                  background: 'var(--bg-card)', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                  opacity: loading ? 0.7 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" alt="Gmail" style={{ width: 20 }} />
                  <span style={{ fontWeight: 600 }}>Gmail / G-Suite</span>
                </div>
                {loading && formData.provider === 'gmail' ? (
                  <span style={{ fontSize: 12, color: 'var(--accent-primary)' }}>Connecting...</span>
                ) : (
                  <ChevronRight size={18} color="var(--text-muted)" />
                )}
              </button>

              <button 
                onClick={() => handleSetup('outlook')}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 16, borderRadius: 12, border: '1px solid var(--bg-border)',
                  background: 'var(--bg-card)', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                  opacity: loading ? 0.7 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                    <path fill="#0078d4" d="M12.5,8.5L34,4v40l-21.5-4.5V8.5z"/>
                    <path fill="#28a8ea" d="M34,4h9.5c1.4,0,2.5,1.1,2.5,2.5v35c0,1.4-1.1,2.5-2.5,2.5H34V4z"/>
                    <path fill="#fff" d="M22.2,28.8c-2.3,0-4-1.3-4-3.5c0-2.2,1.7-3.6,4-3.6s4,1.4,4,3.6C26.2,27.5,24.5,28.8,22.2,28.8z M22.2,23.3 c-1,0-1.7,0.7-1.7,2c0,1.3,0.6,2,1.7,2s1.7-0.7,1.7-2C23.9,24,23.2,23.3,22.2,23.3z"/>
                  </svg>
                  <span style={{ fontWeight: 600 }}>Outlook / Office 365</span>
                </div>
                {loading && formData.provider === 'outlook' ? (
                  <span style={{ fontSize: 12, color: 'var(--accent-primary)' }}>Connecting...</span>
                ) : (
                  <ChevronRight size={18} color="var(--text-muted)" />
                )}
              </button>
            </div>

            {error && (
              <div style={{ display: 'flex', gap: 8, padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: 12, textAlign: 'left' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
              <Lock size={12} />
              <span>ROVA only reads bank alert emails. We never see personal mail.</span>
            </div>
            
            <button onClick={() => { setError(''); setStep(1); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 13, cursor: 'pointer' }}>
              Go Back
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 size={32} color="#22c55e" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Almost Ready!</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
              Account created. Now authorize ROVA to scan your {formData.provider === 'gmail' ? 'Gmail' : 'Outlook'} for <strong>{formData.bankName}</strong> alerts.
            </p>
            
            <Button variant="primary" fullWidth loading={loading} onClick={handleOAuth}>
              Authorize Read Access
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
