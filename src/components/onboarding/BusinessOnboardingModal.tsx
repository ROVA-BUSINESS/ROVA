import React, { useState, useEffect } from 'react';
import { 
  Building2, ShieldCheck, MapPin, CheckCircle2, 
  ArrowRight, ArrowLeft, Info, AlertCircle, 
  FileText, Check, Edit2, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  isTestVerificationMode, 
  verifyRcBnNumber, 
  verifyIdentity 
} from '../../config/verification';
import Button from '../ui/Button';
import Input from '../ui/Input';

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara'
];

const BUSINESS_INDUSTRIES = [
  'Retail & E-commerce',
  'Logistics & Freight Services',
  'Food, Catering & Restaurant',
  'Professional & Consulting Services',
  'Technology & Software',
  'Construction & Real Estate',
  'Healthcare & Pharmacy',
  'Fashion & Beauty',
  'General Commerce & Trading',
  'Other'
];

export interface OnboardingData {
  business_name: string;
  registration_type: 'registered' | 'unregistered';
  rc_bn_number: string;
  business_type: string;
  business_verification_status: 'verified' | 'unverified' | 'pending' | 'failed';
  identity_verification_status: 'verified' | 'unverified' | 'pending' | 'skipped';
  identity_verification_type: 'nin' | 'bvn' | 'none';
  id_number: string;
  state: string;
  city: string;
  address: string;
  country: string;
  logo_url: string;
}

export default function BusinessOnboardingModal() {
  const { user, profile, updateProfile, refreshAuth } = useAuth();
  
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isVerifyingRc, setIsVerifyingRc] = useState<boolean>(false);
  const [rcVerifyMessage, setRcVerifyMessage] = useState<string>('');

  const [formData, setFormData] = useState<OnboardingData>({
    business_name: profile?.business_name || '',
    registration_type: (profile?.registration_type as any) || 'registered',
    rc_bn_number: profile?.rc_bn_number || '',
    business_type: profile?.business_type || 'Retail & E-commerce',
    business_verification_status: profile?.business_verification_status || 'unverified',
    identity_verification_status: profile?.identity_verification_status || 'skipped',
    identity_verification_type: profile?.identity_verification_type || 'none',
    id_number: '',
    state: profile?.state || 'Lagos',
    city: profile?.city || 'Ikeja',
    address: profile?.address || '',
    country: 'Nigeria',
    logo_url: profile?.logo_url || '',
  });

  // Load saved progress from localStorage if present
  useEffect(() => {
    if (!user) return;
    const savedKey = `rova_onboarding_data_${user.id}`;
    const savedStepKey = `rova_onboarding_step_${user.id}`;
    
    const savedLocal = localStorage.getItem(savedKey);
    const savedStepLocal = localStorage.getItem(savedStepKey);

    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Error parsing saved onboarding data:', e);
      }
    } else if (profile) {
      setFormData(prev => ({
        ...prev,
        business_name: profile.business_name || prev.business_name,
        phone: profile.phone || prev.address,
      }));
    }

    if (savedStepLocal) {
      const s = parseInt(savedStepLocal, 10);
      if (s >= 1 && s <= 5) setStep(s);
    }
  }, [user, profile]);

  // Save progress on form data / step change
  const updateFormData = (updates: Partial<OnboardingData>) => {
    setFormData(prev => {
      const next = { ...prev, ...updates };
      if (user) {
        localStorage.setItem(`rova_onboarding_data_${user.id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    if (user) {
      localStorage.setItem(`rova_onboarding_step_${user.id}`, String(nextStep));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 1 validation & proceed
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.business_name.trim()) {
      setError('Please enter your business name.');
      return;
    }
    if (formData.registration_type === 'registered' && !formData.rc_bn_number.trim()) {
      setError('Please enter your RC or BN registration number.');
      return;
    }
    goToStep(2);
  };

  // Verify RC/BN
  const handleVerifyRc = async () => {
    if (!formData.rc_bn_number.trim()) {
      setError('Please enter your RC/BN number.');
      return;
    }
    setIsVerifyingRc(true);
    setError('');
    setRcVerifyMessage('');

    const res = await verifyRcBnNumber(formData.rc_bn_number, formData.registration_type);
    setIsVerifyingRc(false);

    if (res.success) {
      updateFormData({ business_verification_status: 'verified' });
      setRcVerifyMessage(res.message);
    } else {
      updateFormData({ business_verification_status: 'failed' });
      setError(res.message);
    }
  };

  // Step 2 proceed (Verification step)
  const handleStep2Submit = async () => {
    setError('');
    if (isTestVerificationMode()) {
      // In Test Mode: Allow continuing smoothly
      if (formData.identity_verification_type !== 'none' && formData.id_number) {
        const idRes = await verifyIdentity(
          formData.identity_verification_type === 'nin' ? 'NIN' : 'BVN',
          formData.id_number
        );
        if (idRes.success) {
          updateFormData({ identity_verification_status: 'verified' });
        }
      } else {
        updateFormData({ identity_verification_status: 'skipped' });
      }
      goToStep(3);
    } else {
      // Production mode requirements
      if (formData.registration_type === 'registered' && formData.business_verification_status !== 'verified') {
        setError('Please verify your business RC/BN number before proceeding.');
        return;
      }
      goToStep(3);
    }
  };

  // Step 3 proceed (Details & Address)
  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.address.trim()) {
      setError('Please enter your business address.');
      return;
    }
    if (!formData.city.trim()) {
      setError('Please enter your city.');
      return;
    }
    goToStep(4);
  };

  // Step 4 Final Complete Action
  const handleFinalComplete = async () => {
    setLoading(true);
    setError('');

    try {
      const ninLast4 = formData.id_number && formData.identity_verification_type === 'nin'
        ? formData.id_number.slice(-4)
        : undefined;

      const bvnLast4 = formData.id_number && formData.identity_verification_type === 'bvn'
        ? formData.id_number.slice(-4)
        : undefined;

      const { error: dbError } = await updateProfile({
        business_name: formData.business_name,
        registration_type: formData.registration_type,
        rc_bn_number: formData.registration_type === 'registered' ? formData.rc_bn_number : '',
        business_type: formData.business_type,
        business_verification_status: formData.business_verification_status,
        identity_verification_status: formData.identity_verification_status,
        identity_verification_type: formData.identity_verification_type,
        nin_last_4: ninLast4,
        bvn_last_4: bvnLast4,
        city: formData.city,
        state: formData.state,
        address: formData.address,
        country: 'Nigeria',
        logo_url: formData.logo_url,
        business_profile_completed: true,
        onboarding_step: 5,
      });

      if (dbError) {
        setError(dbError.message || 'Failed to save business profile.');
        setLoading(false);
        return;
      }

      // Clear local onboarding progress caches
      if (user) {
        localStorage.removeItem(`rova_onboarding_data_${user.id}`);
        localStorage.removeItem(`rova_onboarding_step_${user.id}`);
      }

      await refreshAuth();
      setLoading(false);
      goToStep(5);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 10, 15, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16,
      overflowY: 'auto'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-xl)',
        width: '100%',
        maxWidth: 620,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(147, 51, 234, 0.1)',
        padding: 32,
        animation: 'fadeIn 0.3s ease-out',
        margin: 'auto',
      }}>

        {/* Top Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--accent-light)',
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 12
          }}>
            <Building2 size={14} /> ROVA Business Onboarding
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            Set up your business
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Let's get the basics set up so ROVA can manage your business properly.
          </p>
        </div>

        {/* Progress Bar (Steps 1 to 4) */}
        {step <= 4 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{
                position: 'absolute', top: 14, left: 24, right: 24, height: 2,
                background: 'var(--bg-border)', zIndex: 1
              }} />
              <div style={{
                position: 'absolute', top: 14, left: 24,
                width: `${((step - 1) / 3) * 100}%`, height: 2,
                background: 'var(--accent-primary)', transition: 'all 0.3s ease', zIndex: 2
              }} />

              {[
                { s: 1, label: 'Business' },
                { s: 2, label: 'Verification' },
                { s: 3, label: 'Details' },
                { s: 4, label: 'Complete' }
              ].map(item => {
                const isActive = step === item.s;
                const isCompleted = step > item.s;
                return (
                  <div key={item.s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 3 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: isCompleted ? 'var(--accent-primary)' : isActive ? 'var(--bg-card)' : 'var(--bg-elevated)',
                      border: `2px solid ${isCompleted || isActive ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                      color: isCompleted ? 'white' : isActive ? 'var(--accent-light)' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 0 12px var(--accent-border)' : 'none'
                    }}>
                      {isCompleted ? <Check size={14} /> : item.s}
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: isActive || isCompleted ? 700 : 500,
                      color: isActive ? 'var(--text-primary)' : isCompleted ? 'var(--accent-light)' : 'var(--text-muted)'
                    }}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'var(--error-dim)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--error)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP 1: BUSINESS INFORMATION ────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Business Name <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Acme Enterprise"
                value={formData.business_name}
                onChange={e => updateFormData({ business_name: e.target.value })}
                prefix={<Building2 size={16} />}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Registration Status <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => updateFormData({ registration_type: 'registered' })}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-lg)',
                    border: `1.5px solid ${formData.registration_type === 'registered' ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                    background: formData.registration_type === 'registered' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                    color: formData.registration_type === 'registered' ? 'var(--accent-light)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ShieldCheck size={16} /> Registered Business
                </button>
                <button
                  type="button"
                  onClick={() => updateFormData({ registration_type: 'unregistered', rc_bn_number: '' })}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-lg)',
                    border: `1.5px solid ${formData.registration_type === 'unregistered' ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                    background: formData.registration_type === 'unregistered' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                    color: formData.registration_type === 'unregistered' ? 'var(--accent-light)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <FileText size={16} /> Unregistered Business
                </button>
              </div>
            </div>

            {formData.registration_type === 'registered' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  RC or BN Number <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. RC 1234567 or BN 9876543"
                  value={formData.rc_bn_number}
                  onChange={e => updateFormData({ rc_bn_number: e.target.value })}
                  prefix={<FileText size={16} />}
                  required
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Your CAC Registration number as shown on your business certificate.
                </span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Business Type / Industry
              </label>
              <select
                value={formData.business_type}
                onChange={e => updateFormData({ business_type: e.target.value })}
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  color: 'var(--text-primary)',
                  padding: '0 14px',
                  fontSize: 14,
                  outline: 'none'
                }}
              >
                {BUSINESS_INDUSTRIES.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button variant="primary" size="lg" type="submit" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Continue <ArrowRight size={16} />
              </Button>
            </div>
          </form>
        )}

        {/* ── STEP 2: VERIFICATION ─────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Test Mode Banner */}
            {isTestVerificationMode() && (
              <div style={{
                padding: '14px 16px',
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent-border)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--accent-light)',
                fontSize: 13,
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12
              }}>
                <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Test Mode Active:</strong> Identity and RC/BN verification integrations are currently being connected. You can complete setup and test all ROVA features without identity verification blocking you.
                </div>
              </div>
            )}

            {/* Business RC/BN Verification Card */}
            {formData.registration_type === 'registered' && (
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 18
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ShieldCheck size={20} color="var(--accent-light)" />
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>CAC Business Verification</span>
                  </div>
                  {formData.business_verification_status === 'verified' && (
                    <span style={{
                      padding: '4px 10px', background: 'var(--success-dim)', color: 'var(--success)',
                      borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4
                    }}>
                      <CheckCircle2 size={13} /> Verified ✓
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Registration Number: <strong>{formData.rc_bn_number}</strong>
                </p>

                {rcVerifyMessage && (
                  <div style={{ padding: '8px 12px', background: 'var(--success-dim)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 12, marginBottom: 12 }}>
                    {rcVerifyMessage}
                  </div>
                )}

                {formData.business_verification_status !== 'verified' && (
                  <Button variant="secondary" size="sm" onClick={handleVerifyRc} loading={isVerifyingRc}>
                    Verify RC/BN Number
                  </Button>
                )}
              </div>
            )}

            {/* Identity Verification Card */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 18
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <ShieldAlert size={20} color="var(--accent-light)" />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Verify Your Identity</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Identity verification protects your business account and enables higher financial transaction limits.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => updateFormData({ identity_verification_type: 'nin' })}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${formData.identity_verification_type === 'nin' ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                    background: formData.identity_verification_type === 'nin' ? 'var(--accent-dim)' : 'transparent',
                    color: formData.identity_verification_type === 'nin' ? 'var(--accent-light)' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Verify with NIN (Primary)
                </button>
                <button
                  type="button"
                  onClick={() => updateFormData({ identity_verification_type: 'bvn' })}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${formData.identity_verification_type === 'bvn' ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                    background: formData.identity_verification_type === 'bvn' ? 'var(--accent-dim)' : 'transparent',
                    color: formData.identity_verification_type === 'bvn' ? 'var(--accent-light)' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Verify with BVN
                </button>
              </div>

              {formData.identity_verification_type !== 'none' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    {formData.identity_verification_type.toUpperCase()} Number (11 Digits)
                  </label>
                  <Input
                    type="text"
                    placeholder={`Enter your 11-digit ${formData.identity_verification_type.toUpperCase()}`}
                    value={formData.id_number}
                    onChange={e => updateFormData({ id_number: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    🔒 Encrypted securely. ROVA will never display your full NIN/BVN.
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <Button variant="secondary" size="lg" onClick={() => goToStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={16} /> Back
              </Button>
              <Button variant="primary" size="lg" onClick={handleStep2Submit} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isTestVerificationMode() ? 'Continue Setup' : 'Continue'} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: DETAILS (ADDRESS & BRANDING) ───────────────────────── */}
        {step === 3 && (
          <form onSubmit={handleStep3Submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Business Address <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. 15 Commercial Avenue, Yaba"
                value={formData.address}
                onChange={e => updateFormData({ address: e.target.value })}
                prefix={<MapPin size={16} />}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  City <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Ikeja"
                  value={formData.city}
                  onChange={e => updateFormData({ city: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  State <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <select
                  value={formData.state}
                  onChange={e => updateFormData({ state: e.target.value })}
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    color: 'var(--text-primary)',
                    padding: '0 14px',
                    fontSize: 14,
                    outline: 'none'
                  }}
                >
                  {NIGERIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Country
              </label>
              <Input type="text" value="Nigeria" disabled readOnly />
            </div>

            {/* Optional Logo */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px dashed var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 18,
              textAlign: 'center'
            }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Add your business logo (Optional)
              </label>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Logos will appear on your customer invoices and payment receipts.
              </p>

              {formData.logo_url ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                  <img
                    src={formData.logo_url}
                    alt="Logo Preview"
                    style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', objectFit: 'contain', background: 'white', padding: 4 }}
                  />
                  <Button variant="secondary" size="sm" onClick={() => updateFormData({ logo_url: '' })}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <Input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={formData.logo_url}
                    onChange={e => updateFormData({ logo_url: e.target.value })}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>You can also add or change your logo anytime in Settings.</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <Button variant="secondary" size="lg" type="button" onClick={() => goToStep(2)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={16} /> Back
              </Button>
              <Button variant="primary" size="lg" type="submit" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Review Summary <ArrowRight size={16} />
              </Button>
            </div>
          </form>
        )}

        {/* ── STEP 4: FINAL REVIEW & CONFIRMATION ──────────────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              
              {/* Section 1: Business */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-light)', marginBottom: 6 }}>Business Information</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}><strong>Name:</strong> {formData.business_name}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    <strong>Registration:</strong> {formData.registration_type === 'registered' ? `Registered (${formData.rc_bn_number || 'N/A'})` : 'Unregistered Business'}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}><strong>Industry:</strong> {formData.business_type}</p>
                </div>
                <button onClick={() => goToStep(1)} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <Edit2 size={14} /> Edit
                </button>
              </div>

              {/* Section 2: Verification */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-light)', marginBottom: 6 }}>Verification Status</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                    <strong>CAC Business Status:</strong> {formData.registration_type === 'registered' ? (formData.business_verification_status === 'verified' ? 'Verified ✓' : 'Pending Verification') : 'N/A (Unregistered)'}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    <strong>Identity Verification:</strong> {formData.identity_verification_type !== 'none' ? `${formData.identity_verification_type.toUpperCase()} Connected` : 'Deferred (Test Mode)'}
                  </p>
                </div>
                <button onClick={() => goToStep(2)} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <Edit2 size={14} /> Edit
                </button>
              </div>

              {/* Section 3: Contact & Address */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-light)', marginBottom: 6 }}>Contact & Address</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}><strong>Email:</strong> {user?.email}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}><strong>Address:</strong> {formData.address}, {formData.city}, {formData.state}, Nigeria</p>
                </div>
                <button onClick={() => goToStep(3)} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <Edit2 size={14} /> Edit
                </button>
              </div>

              {/* Section 4: Branding */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-light)', marginBottom: 4 }}>Branding</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                    {formData.logo_url ? 'Logo uploaded' : 'No logo uploaded (Skipped for now)'}
                  </p>
                </div>
                <button onClick={() => goToStep(3)} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <Edit2 size={14} /> Edit
                </button>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <Button variant="secondary" size="lg" onClick={() => goToStep(3)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={16} /> Back
              </Button>
              <Button variant="primary" size="lg" onClick={handleFinalComplete} loading={loading} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} /> Complete Setup
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 5: ONBOARDING COMPLETE CELEBRATION ───────────────────── */}
        {step === 5 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 72, height: 72,
              background: 'var(--success-dim)',
              border: '2px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 30px rgba(34, 197, 94, 0.25)'
            }}>
              <CheckCircle2 size={38} color="var(--success)" />
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
              Your business is ready! 🎉
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.6 }}>
              Welcome to ROVA! Your business profile for <strong>{formData.business_name}</strong> is fully configured. You can now start recording transactions, issuing invoices, and tracking financial performance.
            </p>

            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                window.location.href = '/app/dashboard';
              }}
              style={{
                padding: '14px 36px',
                fontSize: 15,
                fontWeight: 700,
                background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                boxShadow: '0 4px 20px var(--accent-border)'
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
