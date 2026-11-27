import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, LayoutDashboard, ArrowLeftRight, TrendingUp,
  TrendingDown, BarChart3, Bot, PartyPopper,
  ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobile } from '../../hooks/useMobile';

export const START_PRODUCT_TOUR_EVENT = 'rova-product-tour-start';
const LOCAL_CACHE_PREFIX = 'rova_product_tour_done_v1_';

export function startProductTour() {
  window.dispatchEvent(new CustomEvent(START_PRODUCT_TOUR_EVENT));
}

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  /** Ordered fallback list of CSS selectors; if omitted, renders a centered modal */
  selectors?: string[];
  preferredPlacement?: 'right' | 'bottom' | 'top' | 'left';
  isFinal?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Rova',
    description:
      'Rova is your all-in-one platform for managing business finances. Track transactions, monitor sales and expenses, and view live financial reports — all in one simple workspace.',
    icon: Sparkles,
  },
  {
    id: 'dashboard',
    title: 'Your Financial Dashboard',
    description:
      'Get an instant overview of your business finances at a glance. Monitor your connected bank balance, Money In, Money Out, Profit Margin, and real-time cash flow trends right here.',
    icon: LayoutDashboard,
    selectors: ['[data-tour="dashboard-overview"]', '[data-tour="nav-dashboard"]'],
    preferredPlacement: 'bottom',
  },
  {
    id: 'transactions',
    title: 'Transactions',
    description:
      'Record and monitor every naira coming into and going out of your business. Click Add Transaction anytime to log income or expenses, or let Rova sync them automatically.',
    icon: ArrowLeftRight,
    selectors: ['[data-tour="add-transaction-btn"]', '[data-tour="mobile-nav-transactions"]'],
    preferredPlacement: 'bottom',
  },
  {
    id: 'sales',
    title: 'Sales & Invoicing',
    description:
      'Record sales, send professional invoices and receipts, and monitor all incoming business revenue so you always know who has paid and who still owes you.',
    icon: TrendingUp,
    selectors: ['[data-tour="nav-sales"]', '[data-tour="dashboard-money-in"]', '[data-tour="mobile-nav-invoice"]'],
    preferredPlacement: 'right',
  },
  {
    id: 'expenses',
    title: 'Expenses & Bills',
    description:
      'Record business spending, attach receipts, and track unpaid vendor bills in one place so you stay on top of operating costs and never miss a payment.',
    icon: TrendingDown,
    selectors: ['[data-tour="nav-expenses"]', '[data-tour="dashboard-money-out"]'],
    preferredPlacement: 'right',
  },
  {
    id: 'reports',
    title: 'Financial Reports',
    description:
      'View live Profit & Loss statements, Balance Sheets, and cash flow reports built automatically from your records so you always understand how your business is performing.',
    icon: BarChart3,
    selectors: ['[data-tour="nav-reports"]', '[data-tour="dashboard-cashflow"]'],
    preferredPlacement: 'right',
  },
  {
    id: 'assistant',
    title: 'Rova AI Assistant',
    description:
      'Ask Rova AI anything about your business finances in plain English — record transactions by text or voice, ask about monthly profit, or get instant bookkeeping guidance.',
    icon: Bot,
    selectors: ['[data-tour="nav-assistant"]', '[data-tour="floating-assistant-btn"]'],
    preferredPlacement: 'right',
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description:
      'Congratulations on completing your introduction to Rova! You are ready to track your finances with clarity and confidence. You can replay this tour anytime from Settings or Support.',
    icon: PartyPopper,
    isFinal: true,
  },
];

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

export default function ProductOnboardingTour({ blocked = false }: Props) {
  const { user, profile, refreshAuth } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMobile = useMobile(768);
  const navigate = useNavigate();
  const location = useLocation();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [pendingManualStart, setPendingManualStart] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  const currentStep = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];
  const totalSteps = TOUR_STEPS.length;

  // Listen for manual restart ("Take a Product Tour" from Settings or Support)
  useEffect(() => {
    const handleStart = () => {
      if (!location.pathname.startsWith('/app/dashboard')) {
        setPendingManualStart(true);
        navigate('/app/dashboard');
      } else {
        setStepIndex(0);
        setActive(true);
      }
    };
    window.addEventListener(START_PRODUCT_TOUR_EVENT, handleStart);
    return () => window.removeEventListener(START_PRODUCT_TOUR_EVENT, handleStart);
  }, [location.pathname, navigate]);

  // Trigger tour once navigated to /app/dashboard for manual restart
  useEffect(() => {
    if (pendingManualStart && location.pathname.startsWith('/app/dashboard')) {
      const timer = setTimeout(() => {
        setPendingManualStart(false);
        setStepIndex(0);
        setActive(true);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [pendingManualStart, location.pathname]);

  // Auto-launch once for first-time users when dashboard is ready
  useEffect(() => {
    if (!user?.id || !profile || blocked || active) return;
    if (!location.pathname.startsWith('/app/dashboard')) return;

    const localDone = (() => {
      try {
        return localStorage.getItem(`${LOCAL_CACHE_PREFIX}${user.id}`) === 'true';
      } catch {
        return false;
      }
    })();

    // Respect both DB flag and local cache; only auto-launch if DB explicitly says false (not completed)
    if (localDone || profile.onboarding_tour_completed === true) return;
    // Wait until profile.onboarding_tour_completed is explicitly false (new user after migration)
    if (profile.onboarding_tour_completed !== false) return;

    // Wait briefly for dashboard cards to finish loading/rendering asynchronously
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const dashReady = Boolean(document.querySelector('[data-tour="dashboard-overview"]'));
      if (dashReady || attempts >= 12) {
        clearInterval(interval);
        setStepIndex(0);
        setActive(true);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [user?.id, profile, blocked, active, location.pathname]);

  // Measure target element for the current step
  const measureTarget = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });

    if (!active || !currentStep.selectors || currentStep.selectors.length === 0) {
      setTargetRect(null);
      return;
    }

    let foundEl: Element | null = null;
    for (const sel of currentStep.selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          foundEl = el;
          break;
        }
      }
    }

    if (!foundEl) {
      // Element unavailable due to permissions, device size, or missing data -> centered explanation card
      setTargetRect(null);
      return;
    }

    const rect = foundEl.getBoundingClientRect();
    const pad = 6;
    setTargetRect({
      top: Math.max(4, rect.top - pad),
      left: Math.max(4, rect.left - pad),
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });
  }, [active, currentStep]);

  // Scroll target smoothly into view when step changes, then re-measure
  useEffect(() => {
    if (!active) return;

    if (currentStep.selectors) {
      for (const sel of currentStep.selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            if (r.top < 64 || r.bottom > window.innerHeight - 80) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;
          }
        }
      }
    }

    measureTarget();
    const t1 = setTimeout(measureTarget, 160);
    const t2 = setTimeout(measureTarget, 400);

    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [active, stepIndex, currentStep, measureTarget]);

  const persistTourDone = useCallback(async () => {
    if (!user?.id) return;
    try {
      localStorage.setItem(`${LOCAL_CACHE_PREFIX}${user.id}`, 'true');
    } catch {
      // ignore storage errors
    }
    try {
      await supabase
        .from('profiles')
        .update({
          onboarding_tour_completed: true,
          onboarding_tour_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      await refreshAuth();
    } catch (err) {
      console.warn('[ProductOnboardingTour] Could not persist to DB (local fallback saved):', err);
    }
  }, [user?.id, refreshAuth]);

  const handleCloseAndSave = useCallback(() => {
    setActive(false);
    persistTourDone();
  }, [persistTourDone]);

  const handleNext = useCallback(() => {
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
    } else {
      handleCloseAndSave();
    }
  }, [stepIndex, totalSteps, handleCloseAndSave]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }, [stepIndex]);

  // Keyboard accessibility: ArrowRight / Enter = Next, ArrowLeft = Back, Escape = Skip
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseAndSave();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, handleNext, handleBack, handleCloseAndSave]);

  // Compute smart tooltip coordinates so it never overflows or covers the target
  const popoverStyle = useMemo((): React.CSSProperties => {
    const cardW = isMobile ? Math.min(viewport.w - 28, 380) : 360;
    const estH = 235;
    const margin = 16;

    // Centered modal for Welcome, Final step, or when no target rect exists
    if (!targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: isMobile ? Math.min(viewport.w - 28, 400) : 420,
        zIndex: 10002,
      };
    }

    // Mobile: dock cleanly at bottom (or top if target is in bottom half)
    if (isMobile) {
      const targetInBottomHalf = targetRect.top + targetRect.height / 2 > viewport.h * 0.55;
      return {
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        width: cardW,
        ...(targetInBottomHalf ? { top: 64 } : { bottom: 74 }),
        zIndex: 10002,
      };
    }

    const gap = 14;
    const pref = currentStep.preferredPlacement || 'bottom';

    const fitsRight = targetRect.left + targetRect.width + gap + cardW <= viewport.w - margin;
    const fitsLeft = targetRect.left - gap - cardW >= margin;
    const fitsBottom = targetRect.top + targetRect.height + gap + estH <= viewport.h - margin;
    const fitsTop = targetRect.top - gap - estH >= margin;

    let top = viewport.h / 2 - estH / 2;
    let left = viewport.w / 2 - cardW / 2;

    if (pref === 'right' && fitsRight) {
      left = targetRect.left + targetRect.width + gap;
      top = Math.min(Math.max(margin, targetRect.top - 10), viewport.h - estH - margin);
    } else if (pref === 'bottom' && fitsBottom) {
      top = targetRect.top + targetRect.height + gap;
      left = Math.min(Math.max(margin, targetRect.left), viewport.w - cardW - margin);
    } else if (fitsRight) {
      left = targetRect.left + targetRect.width + gap;
      top = Math.min(Math.max(margin, targetRect.top), viewport.h - estH - margin);
    } else if (fitsBottom) {
      top = targetRect.top + targetRect.height + gap;
      left = Math.min(Math.max(margin, targetRect.left), viewport.w - cardW - margin);
    } else if (fitsTop) {
      top = targetRect.top - estH - gap;
      left = Math.min(Math.max(margin, targetRect.left), viewport.w - cardW - margin);
    } else if (fitsLeft) {
      left = targetRect.left - cardW - gap;
      top = Math.min(Math.max(margin, targetRect.top), viewport.h - estH - margin);
    }

    return {
      position: 'fixed',
      top,
      left,
      width: cardW,
      zIndex: 10002,
      transition: 'top 0.28s cubic-bezier(0.22, 1, 0.36, 1), left 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
    };
  }, [targetRect, isMobile, viewport, currentStep.preferredPlacement]);

  if (!active) return null;

  const StepIcon = currentStep.icon;
  const cardBg = isDark ? '#16161a' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)';
  const pct = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rova-tour-title"
      style={{ position: 'fixed', inset: 0, zIndex: 10000 }}
    >
      {/* Dimmed Backdrop with Crisp SVG Spotlight Cutout */}
      <svg
        width={viewport.w}
        height={viewport.h}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'auto',
          zIndex: 10000,
        }}
        onClick={(e) => {
          // Clicking dimmed background does not accidentally lose place; keep tour focused
          e.stopPropagation();
        }}
      >
        <defs>
          <mask id="rova-spotlight-mask">
            <rect x="0" y="0" width={viewport.w} height={viewport.h} fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={viewport.w}
          height={viewport.h}
          fill={isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.56)'}
          mask="url(#rova-spotlight-mask)"
        />
      </svg>

      {/* Glowing Highlight Border Around Selected Element */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: 12,
            border: '2px solid var(--accent-primary)',
            boxShadow: '0 0 0 4px rgba(124, 58, 237, 0.28), 0 8px 30px rgba(124, 58, 237, 0.35)',
            pointerEvents: 'none',
            zIndex: 10001,
            transition: 'all 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      )}

      {/* Explanatory Popover / Modal Card */}
      <div
        style={{
          ...popoverStyle,
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 18,
          boxShadow: isDark
            ? '0 24px 60px rgba(0, 0, 0, 0.7)'
            : '0 20px 50px rgba(15, 23, 42, 0.22)',
          padding: targetRect ? '20px 22px' : '28px 26px',
          color: 'var(--text-primary)',
          boxSizing: 'border-box',
        }}
      >
        {/* Top Row: Step Counter + Skip/Close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: currentStep.isFinal
                  ? 'var(--success-dim)'
                  : 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
                color: currentStep.isFinal ? 'var(--success)' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <StepIcon size={16} />
            </div>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.02em',
              }}
            >
              Step {stepIndex + 1} of {totalSteps}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCloseAndSave}
            aria-label="Skip product tour"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>Skip</span>
            <X size={14} />
          </button>
        </div>

        {/* Title & Explanation */}
        <h2
          id="rova-tour-title"
          style={{
            fontSize: targetRect ? 17 : 21,
            fontWeight: 800,
            margin: '0 0 8px 0',
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          {currentStep.title}
        </h2>
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            margin: '0 0 18px 0',
          }}
        >
          {currentStep.description}
        </p>

        {/* Progress Bar */}
        <div
          style={{
            width: '100%',
            height: 5,
            borderRadius: 6,
            background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
            overflow: 'hidden',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: 6,
              background: currentStep.isFinal
                ? 'var(--success)'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-light))',
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {/* Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleNext}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: currentStep.isFinal ? '10px 22px' : '8px 18px',
              borderRadius: 10,
              background: currentStep.isFinal
                ? 'var(--success)'
                : 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
              color: '#ffffff',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)',
            }}
          >
            <span>{currentStep.isFinal ? 'Get Started' : 'Next'}</span>
            {!currentStep.isFinal && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
