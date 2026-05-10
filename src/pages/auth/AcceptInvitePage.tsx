import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function AcceptInvitePage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase auto-processes the #access_token in the URL hash.
  // Wait for the session to be established before showing the form.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSessionReady(true);
    });

    // Also check for an existing session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {

      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSetPassword(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message || 'Failed to set password. Please try again.');
      return;
    }

    setDone(true);
    setTimeout(() => navigate('/app/dashboard'), 2000);
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(147,51,234,0.15) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400, animation: 'fadeIn 0.4s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 100, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={theme === 'light' ? '/rova-light.png' : '/rova.png'}
              alt="ROVA Logo"
              style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ fontSize: 24, marginBottom: 6 }}>
            {done ? 'You\'re all set!' : 'Welcome to the team'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {done
              ? 'Redirecting you to the dashboard...'
              : 'Set a password to activate your staff account'}
          </p>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
        }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Password set successfully!</p>
            </div>
          ) : !sessionReady ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{
                width: 32, height: 32,
                border: '3px solid var(--bg-border)',
                borderTopColor: 'var(--accent-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px',
              }} />
              Verifying your invite link...
            </div>
          ) : (
            <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="New Password"
                type={showPass ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                prefix={<Lock size={14} />}
                suffix={
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
                required
              />
              <Input
                label="Confirm Password"
                type={showPass ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                prefix={<Lock size={14} />}
                required
              />

              {error && (
                <div style={{
                  padding: '10px 12px', background: 'var(--error-dim)',
                  border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)',
                  color: 'var(--error)', fontSize: 13,
                }}>
                  {error}
                </div>
              )}

              <Button variant="primary" size="lg" loading={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                Set Password & Enter
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
