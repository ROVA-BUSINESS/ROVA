import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Shield, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function LoginPage() {
  const { signIn } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState<'admin' | 'staff'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
