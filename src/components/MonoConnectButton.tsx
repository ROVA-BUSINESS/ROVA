import React, { useState } from 'react';
import Connect from '@mono.co/connect.js';
import Button from './ui/Button';
import { supabase } from '../lib/supabase';
import { Wallet } from 'lucide-react';

interface MonoConnectButtonProps {
  onSuccess?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function MonoConnectButton({ onSuccess, className, variant = 'primary', size = 'md' }: MonoConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const showStatus = (msg: string, isError = false) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), isError ? 5000 : 3000);
  };

  const handleConnect = React.useCallback(() => {
    setIsConnecting(true);
    setStatusMsg(null);

    const monoPublicKey = import.meta.env.VITE_MONO_PUBLIC_KEY;

    if (!monoPublicKey) {
      console.error('VITE_MONO_PUBLIC_KEY is not defined in the environment.');
      showStatus('Mono configuration error. Please contact support.', true);
      setIsConnecting(false);
      return;
    }

    const connect = new Connect({
      key: monoPublicKey,
      onSuccess: async ({ code }: { code: string }) => {
        console.log(`Mono connected. Exchanging code...`);
        try {
          // Explicitly retrieve the session token to ensure the Authorization
          // header is always present when calling the edge function (prevents 401)
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;

          if (!accessToken) {
            console.error('No active session found. User may not be logged in.');
            showStatus('Authentication error. Please log in and try again.', true);
            setIsConnecting(false);
            return;
          }

          const { data, error } = await supabase.functions.invoke('mono-exchange-token', {
            body: { code },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (error) {
            // Try to extract the real error message from the edge function response
            let displayMsg = 'Failed to link account. Please try again.';
            try {
              // FunctionsHttpError carries the response body
              const body = await (error as any).context?.json?.();
              const realMsg = body?.error || error.message;
              console.error('Token exchange error:', realMsg, '| Full error:', error);
              if (realMsg && realMsg !== 'Unknown') displayMsg = `Link failed: ${realMsg}`;
            } catch {
              console.error('Token exchange error:', error);
            }
            showStatus(displayMsg, true);
            return;
          }

          if (data && data.success) {
            console.log('Account linked:', data.accountName, '| Balance:', data.balance);
            showStatus(`✓ ${data.accountName || 'Bank account'} linked successfully!`);
            if (onSuccess) onSuccess();
          } else {
            const errMsg = data?.error || 'Unknown error';
            console.error('Exchange failed:', errMsg);
            showStatus(`Failed to link account: ${errMsg}`, true);
          }
        } catch (err) {
          console.error('Unexpected error linking account:', err);
          showStatus('An unexpected error occurred while linking your account.', true);
        } finally {
          setIsConnecting(false);
        }
      },
      onClose: () => {
        console.log('Mono widget closed');
        setIsConnecting(false);
      },
      onLoad: () => {
        console.log('Mono widget loaded');
      },
    });

    connect.setup();
    connect.open();
  }, [onSuccess]);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className={className}
        variant={variant}
        size={size}
        loading={isConnecting}
        icon={<Wallet className="w-4 h-4" />}
      >
        Connect Bank
      </Button>
      {statusMsg && (
        <span style={{
          fontSize: 11,
          color: statusMsg.startsWith('✓') ? 'var(--success)' : 'var(--error)',
          fontWeight: 500,
          animation: 'fadeIn 0.2s ease',
        }}>
          {statusMsg}
        </span>
      )}
    </div>
  );
}
