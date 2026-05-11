import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function GmailCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code || !state) {
        setStatus('error');
        setError('Missing authorization code or state from Google.');
        return;
      }

      try {
        const { accountId } = JSON.parse(decodeURIComponent(state));
        
        // Invoke edge function to exchange code for token
        const { error: invokeError, data } = await supabase.functions.invoke('email-bank-sync', {
          body: { 
            action: 'exchange_token', 
            code, 
            accountId,
            redirectUri: window.location.origin.includes('localhost') 
              ? 'http://localhost:3000/auth/callback/gmail' 
              : 'https://rovabusiness.com/auth/callback/gmail'
          }
        });

        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(data.error);

        setStatus('success');
        setTimeout(() => {
          navigate('/app/dashboard');
        }, 3000);

      } catch (err: any) {
        console.error("Callback error:", err);
        setStatus('error');
        setError(err.message || 'Failed to exchange token with Google');
      }
    }

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 16 }}>
      <div style={{ maxWidth: 400, width: '100%', background: 'var(--bg-card)', padding: 32, borderRadius: 16, border: '1px solid var(--bg-border)', textAlign: 'center' }}>
        {status === 'loading' && (
          <>
            <div style={{
              width: 48, height: 48, margin: '0 auto 24px',
              border: '3px solid rgba(147,51,234,0.1)',
              borderTopColor: 'var(--accent-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Connecting your Bank...</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Please wait while we securely authorize with Google and fetch your latest balance.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 size={32} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Connection Successful!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Your bank has been successfully linked via Gmail. Redirecting you to the dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <AlertCircle size={32} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Connection Failed</h2>
            <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 24 }}>{error}</p>
            <button 
              onClick={() => navigate('/app/dashboard')}
              style={{ padding: '12px 24px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
