import { useEffect, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  SUBFEATURE_TIPS,
  getLocalOnboardingState,
  loadOnboardingState,
  persistOnboardingKey,
  type SubfeatureTipKey,
} from '../../lib/contextualOnboarding';

interface Props {
  tipKey: SubfeatureTipKey;
  /** Optional condition to only show when the subfeature is actively engaged */
  visible?: boolean;
}

/**
 * Compact, non-intrusive first-use contextual tooltip for advanced subfeatures.
 * Shows once per user per subfeature and persists across logins/devices.
 */
export default function ContextualSubfeatureTip({ tipKey, visible = true }: Props) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!user?.id || !visible) return;
    // Fast synchronous local check first
    const local = getLocalOnboardingState(user.id);
    if (local[tipKey]) {
      setDismissed(true);
      return;
    }
    let cancelled = false;
    loadOnboardingState(user.id).then((map) => {
      if (!cancelled) {
        setDismissed(Boolean(map[tipKey]));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, tipKey, visible]);

  if (!visible || dismissed) return null;

  const tip = SUBFEATURE_TIPS[tipKey];
  if (!tip) return null;

  async function handleDismiss() {
    setDismissed(true);
    if (user?.id) {
      await persistOnboardingKey(user.id, tipKey, 'completed');
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(124, 58, 237, 0.10)',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        fontSize: 12,
        lineHeight: 1.5,
        color: 'var(--text-secondary)',
      }}
    >
      <Lightbulb size={15} color="#a78bfa" style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{tip.title}</div>
        <div>{tip.message}</div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(139, 92, 246, 0.18)',
          border: 'none',
          borderRadius: 6,
          padding: '4px 8px',
          color: '#c4b5fd',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Got it <X size={12} />
      </button>
    </div>
  );
}
