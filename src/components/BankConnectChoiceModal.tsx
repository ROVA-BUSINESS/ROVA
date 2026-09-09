import { useState } from 'react';
import { Mail, Building2 } from 'lucide-react';
import Modal from './ui/Modal';
import { MonoConnectButton } from './MonoConnectButton';
import EmailSyncSetup from './bank-sync/EmailSyncSetup';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BankConnectChoiceModal({ open, onClose, onSuccess }: Props) {
  const [showEmailSync, setShowEmailSync] = useState(false);

  if (showEmailSync) {
    return (
      <EmailSyncSetup
        isOpen={true}
        onClose={() => {
          setShowEmailSync(false);
          onClose();
        }}
        onSuccess={() => {
          setShowEmailSync(false);
          onSuccess();
          onClose();
        }}
      />
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect Bank Account" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
          Choose how you would like to connect your bank to ROVA:
        </p>

        {/* Option 1: Mono Direct Bank Connection */}
        <div style={{
          padding: 16,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--bg-border)',
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-light)'
            }}>
              <Building2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Mono (Direct Bank API)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Direct connection for major Nigerian commercial banks</div>
            </div>
          </div>
          <MonoConnectButton
            onSuccess={() => {
              onSuccess();
              onClose();
            }}
            size="sm"
            className="w-full"
          />
        </div>

        {/* Option 2: Email Sync */}
        <div
          onClick={() => setShowEmailSync(true)}
          style={{
            padding: 16,
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--accent-border)',
            background: 'var(--bg-elevated)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--accent-primary)';
            el.style.background = 'var(--bg-hover)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--accent-border)';
            el.style.background = 'var(--bg-elevated)';
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#3b82f6'
          }}>
            <Mail size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Email Sync</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Automatic transaction ingestion via Gmail OAuth or statement forwarding</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
