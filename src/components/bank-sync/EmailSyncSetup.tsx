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
  { name: 'Fidelity Bank', sender: 'alerts@fidelitybank.ng' },
  { name: 'Polaris Bank', sender: 'alerts@polarisbank.com' },
  { name: 'Sterling Bank', sender: 'noreply@sterling.ng' },
  { name: 'Wema Bank', sender: 'alerts@wemabank.com' },
  { name: 'FCMB', sender: 'alerts@fcmb.com' },
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

  async function handleSetup() {
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
          provider: formData.provider,
          bank_sender_address: bank?.sender || 'alerts@bank.com'
        });

      if (settingsError) throw settingsError;

      setStep(3); // Move to success/OAuth step
    } catch (err: any) {
      setError(err.message);
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
                onClick={() => { setFormData({ ...formData, provider: 'gmail' }); handleSetup(); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 16, borderRadius: 12, border: '1px solid var(--bg-border)',
                  background: 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" alt="Gmail" style={{ width: 20 }} />
                  <span style={{ fontWeight: 600 }}>Gmail / G-Suite</span>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </button>

              <button 
                onClick={() => { setFormData({ ...formData, provider: 'outlook' }); handleSetup(); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 16, borderRadius: 12, border: '1px solid var(--bg-border)',
                  background: 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg" alt="Outlook" style={{ width: 20 }} />
                  <span style={{ fontWeight: 600 }}>Outlook / Office 365</span>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
              <Lock size={12} />
              <span>ROVA only reads bank alert emails. We never see personal mail.</span>
            </div>
            
            <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 13, cursor: 'pointer' }}>
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
