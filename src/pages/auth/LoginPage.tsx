import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Shield, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState<'admin' | 'staff'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogleSignIn() {
    setError('');
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) setError(error.message || 'Google sign-in failed. Please try again.');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error.message || 'Invalid email or password. Please try again.');
    } else {
      navigate('/app');
    }
  }

  const isLight = theme === 'light';

  return (
    <div style={{
      minHeight: '100vh', 
      background: 'var(--bg-base)',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 16,
      position: 'relative',
    }}>
      {/* Background Subtle Glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(147,51,234,0.1) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 420,
        animation: 'fadeIn 0.4s ease-out',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 140, height: 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 32px',
          }}>
            <Link to="/">
              <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
            </Link>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.5px' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Sign in to your {loginType === 'admin' ? 'Admin' : 'Staff'} account</p>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: 4, border: '1px solid var(--bg-border)' }}>
          {[
            { id: 'admin', label: 'Admin Login', icon: Shield },
            { id: 'staff', label: 'Staff Login', icon: Users }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setLoginType(t.id as any)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600,
                background: loginType === t.id ? 'var(--bg-card)' : 'transparent',
                color: loginType === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: loginType === t.id ? 'var(--shadow-sm)' : 'none',
                border: '1px solid',
                borderColor: loginType === t.id ? 'var(--bg-border)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 32,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              prefix={<Mail size={16} />}
              required
            />
            <div style={{ position: 'relative' }}>
              <Input
                label="Password"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                prefix={<Lock size={16} />}
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: 38, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <div style={{
                padding: '12px', background: 'var(--error-dim)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)',
                color: 'var(--error)', fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <Button variant="primary" size="lg" loading={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4, height: 48, fontWeight: 700 }}>
              Sign In
            </Button>
          </form>

          {loginType === 'admin' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--bg-border)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--bg-border)' }} />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                style={{
                  width: '100%', height: 48, borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                  color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                {googleLoading ? 'Connecting...' : 'Continue with Google'}
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 32, color: 'var(--text-muted)', fontSize: 13 }}>
          {loginType === 'admin' ? (
            <>Don't have an account? <Link to="/signup" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Create one</Link></>
          ) : (
            <>Don't have an account? <span style={{ color: 'var(--text-secondary)' }}>Contact your admin</span></>
          )}
        </p>
      </div>
    </div>
  );
}
