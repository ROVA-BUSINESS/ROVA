import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MonoProvider, useMonoConnect } from '@mono.co/connect-react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, font } from '../lib/theme';

interface MonoConnectWrapperProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

// Ensure you replace this with the actual config logic or env variable for React Native
const MONO_PUBLIC_KEY = 'test_pk_...'; // Ideally from process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY

function ConnectButton({ onSuccess, onClose }: MonoConnectWrapperProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const { init } = useMonoConnect();

  // Expose a global or ref way to reset loading, or just let MonoProvider handle it
  // Actually, since MonoProvider wraps this, we can listen to a prop or context if we had one.
  // We'll just reset it after a delay, or better, lift the state up.

  const showStatus = (msg: string, isError = false) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), isError ? 5000 : 3000);
  };

  const handleConnect = () => {
    setIsConnecting(true);
    setStatusMsg(null);

    init();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.button, isConnecting && styles.buttonDisabled]} 
        onPress={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <>
            <Ionicons name="wallet-outline" size={16} color={colors.white} style={styles.icon} />
            <Text style={styles.buttonText}>Connect Bank</Text>
          </>
        )}
      </TouchableOpacity>
      
      {statusMsg && (
        <Text style={[styles.statusText, statusMsg.startsWith('✓') ? styles.statusSuccess : styles.statusError]}>
          {statusMsg}
        </Text>
      )}
    </View>
  );
}

export function MonoConnectWidget({ onSuccess }: { onSuccess?: () => void }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSuccess = async (data: any) => {
    setIsConnecting(false);
    const code = data?.code || data?.getAuthCode;
    console.log(`Mono connected. Exchanging code...`, code);
    if (!code) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        console.error('No active session found.');
        return;
      }

      const { data: exchangeData, error } = await supabase.functions.invoke('mono-exchange-token', {
        body: { code },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        console.error('Token exchange error:', error);
        return;
      }

      if (exchangeData && exchangeData.success) {
        console.log('Account linked:', exchangeData.accountName);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error('Unexpected error linking account:', err);
    }
  };

  const handleClose = () => {
    console.log('Mono widget closed');
    setIsConnecting(false);
  };

  const MonoTrigger = () => {
    const { init } = useMonoConnect();
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={[styles.button, isConnecting && styles.buttonDisabled]} 
          onPress={() => {
            setIsConnecting(true);
            setStatusMsg(null);
            init();
          }}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="wallet-outline" size={16} color={colors.white} style={styles.icon} />
              <Text style={styles.buttonText}>Connect Bank</Text>
            </>
          )}
        </TouchableOpacity>
        
        {statusMsg && (
          <Text style={[styles.statusText, statusMsg.startsWith('✓') ? styles.statusSuccess : styles.statusError]}>
            {statusMsg}
          </Text>
        )}
      </View>
    );
  };

  return (
    <MonoProvider
      publicKey="test_pk_s078zhmxkqlfc50m3wzd"
      onSuccess={handleSuccess}
      onClose={handleClose}
    >
      <MonoTrigger />
    </MonoProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  icon: {
    marginRight: 6,
  },
  buttonText: {
    color: colors.white,
    fontSize: font.sm,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: font.xs,
    fontWeight: '500',
    marginTop: 6,
  },
  statusSuccess: {
    color: colors.success,
  },
  statusError: {
    color: colors.danger,
  },
});
