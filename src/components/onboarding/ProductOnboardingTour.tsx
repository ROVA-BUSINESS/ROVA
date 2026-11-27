import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, PartyPopper, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobile } from '../../hooks/useMobile';
import {
  FEATURE_TOURS,
  getFeatureKeyForPath,
  loadOnboardingState,
  persistOnboardingKey,
  type FeatureTourKey,
  type OnboardingStateMap,
} from '../../lib/contextualOnboarding';

export const START_PRODUCT_TOUR_EVENT = 'rova-product-tour-start';

/**
 * Triggers a specific feature tour (or the Dashboard tour if omitted).
 * Can be called from Settings, Support, or Help anywhere in the app.
 */
export function startProductTour(featureKey?: FeatureTourKey) {
  window.dispatchEvent(new CustomEvent(START_PRODUCT_TOUR_EVENT, { detail: { featureKey } }));
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  /** Block auto-launch while setup or business onboarding modal is open */
  blocked?: boolean;
}

function isUserActivelyBusy(): boolean {
  if (typeof document === 'undefined') return false;
  const activeEl = document.activeElement;
  if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
    return true;
  }
  // Check if any modal/dialog overlay is currently open
  if (document.querySelector('[role="dialog"]')) {
    return true;
  }
  return false;
}

export default function ProductOnboardingTour({ blocked = false }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMobile = useMobile(768);
  const navigate = useNavigate();
  const location = useLocation();

  const [stateMap, setStateMap] = useState<OnboardingStateMap | null>(null);
  const [activeFeature, setActiveFeature] = useState<FeatureTourKey | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [pendingManualFeature, setPendingManualFeature] = useState<FeatureTourKey | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  // Load persisted onboarding completion state once per user
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    loadOnboardingState(user.id).then((map) => {
      if (!cancelled) setStateMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Track viewport resize
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Listen for manual replay triggers from Settings / Support
  useEffect(() => {
    const handleStart = (evt: Event) => {
      const detail = (evt as CustomEvent<{ featureKey?: FeatureTourKey }>).detail;
      const key: FeatureTourKey = detail?.featureKey || 'dashboard';
      const tourDef = FEATURE_TOURS[key];
      if (!tourDef) return;

      const currentFeature = getFeatureKeyForPath(location.pathname);
      if (currentFeature !== key) {
        setPendingManualFeature(key);
        navigate(tourDef.route);
      } else {
        setActiveFeature(key);
        setStepIndex(0);
      }
    };
    window.addEventListener(START_PRODUCT_TOUR_EVENT, handleStart);
    return () => window.removeEventListener(START_PRODUCT_TOUR_EVENT, handleStart);
  }, [location.pathname, navigate]);

  // Trigger pending manual tour once we land on its route
  useEffect(() => {
    if (!pendingManualFeature) return;
    const currentFeature = getFeatureKeyForPath(location.pathname);
    if (currentFeature !== pendingManualFeature) return;
    const timer = window.setTimeout(() => {
      setActiveFeature(pendingManualFeature);
      setStepIndex(0);
      setPendingManualFeature(null);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [pendingManualFeature, location.pathname]);

  // Auto-trigger contextual feature tour on first visit to any feature route
  // IMPORTANT: Never marks complete on navigation/unmount; never interrupts active modals/inputs
  useEffect(() => {
    if (blocked || !user?.id || !stateMap || activeFeature || pendingManualFeature) return;

    const routeFeature = getFeatureKeyForPath(location.pathname);
    if (!routeFeature) return;

    // Skip if already completed or skipped
    if (stateMap[routeFeature]?.status === 'completed' || stateMap[routeFeature]?.status === 'skipped') {
      return;
    }

    const timer = window.setTimeout(() => {
      if (isUserActivelyBusy()) return;
      setActiveFeature(routeFeature);
      setStepIndex(0);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [blocked, user?.id, stateMap, location.pathname, activeFeature, pendingManualFeature]);

  // If user navigates away mid-tour without clicking Finish or Skip, just close overlay WITHOUT marking complete
  useEffect(() => {
    if (!activeFeature) return;
    const routeFeature = getFeatureKeyForPath(location.pathname);
    if (routeFeature && routeFeature !== activeFeature) {
      setActiveFeature(null);
      setTargetRect(null);
    }
  }, [location.pathname, activeFeature]);

  const activeTour = activeFeature ? FEATURE_TOURS[activeFeature] : null;
  const currentStep = activeTour ? activeTour.steps[stepIndex] || activeTour.steps[0] : null;
  const totalSteps = activeTour ? activeTour.steps.length : 0;

  // Measure target element for spotlight
  const measureTarget = useCallback(() => {
    if (!activeFeature || !currentStep?.selectors || currentStep.selectors.length === 0) {
      setTargetRect(null);
      return;
    }

    let foundEl: HTMLElement | null = null;
    for (const sel of currentStep.selectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          foundEl = el;
          break;
        }
      }
    }

    if (!foundEl) {
      setTargetRect(null);
      return;
    }

    const rect = foundEl.getBoundingClientRect();
    if (rect.top < 64 || rect.bottom > window.innerHeight - 64) {
      foundEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    const pad = 6;
    setTargetRect({
      top: Math.max(4, rect.top - pad),
      left: Math.max(4, rect.left - pad),
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });
  }, [activeFeature, currentStep]);

  useEffect(() => {
    if (!activeFeature) return;
    measureTarget();
    const t1 = window.setTimeout(measureTarget, 220);
    const t2 = window.setTimeout(measureTarget, 500);
    window.addEventListener('scroll', measureTarget, true);
    window.addEventListener('resize', measureTarget);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('scroll', measureTarget, true);
      window.removeEventListener('resize', measureTarget);
    };
  }, [activeFeature, stepIndex, measureTarget]);

  const finishOrSkip = useCallback(
    async (status: 'completed' | 'skipped') => {
      if (!activeFeature || !user?.id) {
        setActiveFeature(null);
        return;
      }
      const key = activeFeature;
      setActiveFeature(null);
      setTargetRect(null);
      const updated = await persistOnboardingKey(user.id, key, status);
      setStateMap(updated);
    },
    [activeFeature, user?.id]
  );

  const handleNext = useCallback(() => {
    if (!activeTour) return;
    if (stepIndex >= activeTour.steps.length - 1) {
      void finishOrSkip('completed');
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [activeTour, stepIndex, finishOrSkip]);

  const handleBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!activeFeature) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void finishOrSkip('skipped');
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeFeature, stepIndex, handleNext, handleBack, finishOrSkip]);

  // Responsive popover positioning
  const popoverStyle = useMemo<React.CSSProperties>(() => {
    const cardW = isMobile ? Math.min(viewport.w - 24, 380) : 390;

    if (!targetRect || isMobile) {
      if (isMobile && targetRect) {
        return {
          position: 'fixed',
          left: '50%',
          bottom: 18,
          transform: 'translateX(-50%)',
          width: cardW,
          zIndex: 10002,
        };
      }
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: cardW,
        zIndex: 10002,
      };
    }

    const gap = 16;
    const estH = 260;
    const pref = currentStep?.preferredPlacement || 'bottom';

    let top = targetRect.top + targetRect.height + gap;
    let left = targetRect.left + targetRect.width / 2 - cardW / 2;

    if (pref === 'right' && targetRect.left + targetRect.width + gap + cardW < viewport.w - 16) {
      left = targetRect.left + targetRect.width + gap;
      top = targetRect.top + targetRect.height / 2 - estH / 2;
    } else if (pref === 'left' && targetRect.left - gap - cardW > 16) {
      left = targetRect.left - gap - cardW;
      top = targetRect.top + targetRect.height / 2 - estH / 2;
    } else if (pref === 'top' && targetRect.top - gap - estH > 16) {
      top = targetRect.top - gap - estH;
    } else if (targetRect.top + targetRect.height + gap + estH > viewport.h - 16) {
      top = Math.max(16, targetRect.top - gap - estH);
    }

    left = Math.max(16, Math.min(left, viewport.w - cardW - 16));
    top = Math.max(16, Math.min(top, viewport.h - estH - 16));

    return {
      position: 'fixed',
      top,
      left,
      width: cardW,
      zIndex: 10002,
    };
  }, [targetRect, isMobile, viewport, currentStep]);

  if (!activeTour || !currentStep) return null;

  const progressPct = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 100;
  const Icon = currentStep.isFinal ? PartyPopper : Sparkles;

  return (
    <>
      {/* Dimmed Backdrop with optional SVG Spotlight Cutout */}
      <svg
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 10000,
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <defs>
          <mask id="rovaflow-contextual-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={isDark ? 'rgba(6, 8, 18, 0.72)' : 'rgba(15, 23, 42, 0.56)'}
          mask="url(#rovaflow-contextual-spotlight-mask)"
        />
      </svg>

      {/* Glowing Spotlight Border */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: 12,
            border: '2px solid #8b5cf6',
            boxShadow: '0 0 0 4px rgba(139, 92, 246, 0.25), 0 0 28px rgba(139, 92, 246, 0.45)',
            pointerEvents: 'none',
            zIndex: 10001,
            transition: 'all 0.22s ease',
          }}
        />
      )}

      {/* Tour Popover Card */}
      <div
        role="dialog"
        aria-label={currentStep.title}
        style={{
          ...popoverStyle,
          background: isDark ? '#141521' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.4)' : 'rgba(124, 58, 237, 0.28)'}`,
          borderRadius: 16,
          padding: 20,
          boxShadow: isDark
            ? '0 24px 60px rgba(0, 0, 0, 0.65)'
            : '0 20px 50px rgba(15, 23, 42, 0.22)',
          color: isDark ? '#f8fafc' : '#0f172a',
        }}
      >
        {/* Top Row: Feature Label + Step Counter + Skip X */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(139, 92, 246, 0.16)',
                color: '#a78bfa',
              }}
            >
              {activeTour.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              Step {stepIndex + 1} of {totalSteps}
            </span>
          </div>
          <button
            type="button"
            aria-label="Skip tour"
            onClick={() => void finishOrSkip('skipped')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            height: 4,
            width: '100%',
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
            borderRadius: 999,
            overflow: 'hidden',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {/* Title & Body */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(167,139,250,0.12))',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={18} color="#a78bfa" />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>
              {currentStep.title}
            </h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: isDark ? '#cbd5e1' : '#475569', margin: 0 }}>
              {currentStep.description}
            </p>
          </div>
        </div>

        {/* Controls: Skip Tour | Back | Next / Finish */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button
            type="button"
            onClick={() => void finishOrSkip('skipped')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 4px',
            }}
          >
            Skip Tour
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  color: isDark ? '#e2e8f0' : '#334155',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
              }}
            >
              {currentStep.isFinal ? 'Got It' : 'Next'}
              {!currentStep.isFinal && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
