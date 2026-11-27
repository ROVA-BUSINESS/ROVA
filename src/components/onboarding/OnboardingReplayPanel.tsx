import { useEffect, useState } from 'react';
import { Play, RotateCcw, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  FEATURE_TOURS,
  FEATURE_TOUR_ORDER,
  loadOnboardingState,
  resetAllOnboardingTours,
  type FeatureTourKey,
  type OnboardingStateMap,
} from '../../lib/contextualOnboarding';
import { startProductTour } from './ProductOnboardingTour';

interface Props {
  compact?: boolean;
}

export default function OnboardingReplayPanel({ compact = false }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [stateMap, setStateMap] = useState<OnboardingStateMap>({});
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    loadOnboardingState(user.id).then(setStateMap);
  }, [user?.id]);

  async function handleResetAll() {
    if (!user?.id) return;
    setResetting(true);
    await resetAllOnboardingTours(user.id);
    setStateMap({});
    setResetting(false);
    setResetMsg('All feature tours and first-use tips have been reset.');
    setTimeout(() => setResetMsg(''), 3500);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#64748b' }}>
          Replay any feature walkthrough below, or reset all tours to see them again on first visit.
        </div>
        <button
          type="button"
          onClick={handleResetAll}
          disabled={resetting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            borderRadius: 8,
            fontSize: 11.5,
            fontWeight: 600,
            background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
            color: isDark ? '#e2e8f0' : '#334155',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={12} /> {resetting ? 'Resetting...' : 'Reset All Tours'}
        </button>
      </div>

      {resetMsg && (
        <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>{resetMsg}</div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: 8,
        }}
      >
        {FEATURE_TOUR_ORDER.map((key: FeatureTourKey) => {
          const def = FEATURE_TOURS[key];
          const done = Boolean(stateMap[key]);
          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 10,
                background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                {done ? (
                  <CheckCircle2 size={14} color="#22c55e" style={{ flexShrink: 0 }} />
                ) : (
                  <Circle size={14} color={isDark ? '#64748b' : '#94a3b8'} style={{ flexShrink: 0 }} />
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isDark ? '#e2e8f0' : '#1e293b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {def.label}
                </span>
              </div>

              <button
                type="button"
                onClick={() => startProductTour(key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 9px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(124, 58, 237, 0.14)',
                  color: '#a78bfa',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Play size={10} /> Replay
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
