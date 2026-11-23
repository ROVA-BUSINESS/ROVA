import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, ChevronRight, X, Sparkles, Upload, Layers,
  Landmark, ArrowLeftRight, FileText, Receipt, TrendingUp,
  ShieldCheck, Bot, PartyPopper, SkipForward
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobile } from '../../hooks/useMobile';

const STORAGE_PREFIX = 'rova_getting_started_v1_';
export const REOPEN_GUIDE_EVENT = 'rova-getting-started-reopen';

interface PersistedGuideState {
  dismissed: boolean;
  isSwitcher: boolean;
  skippedIds: string[];
  visitedIds: string[];
}

const DEFAULT_STATE: PersistedGuideState = {
  dismissed: false,
  isSwitcher: false,
  skippedIds: [],
  visitedIds: [],
};

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadGuideState(userId: string): PersistedGuideState {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      dismissed: Boolean(parsed.dismissed),
      isSwitcher: Boolean(parsed.isSwitcher),
      skippedIds: Array.isArray(parsed.skippedIds) ? parsed.skippedIds : [],
      visitedIds: Array.isArray(parsed.visitedIds) ? parsed.visitedIds : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveGuideState(userId: string, state: PersistedGuideState) {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function reopenGettingStartedGuide(userId: string) {
  const current = loadGuideState(userId);
  saveGuideState(userId, { ...current, dismissed: false });
  window.dispatchEvent(new CustomEvent(REOPEN_GUIDE_EVENT));
}

interface StepDef {
  id: string;
  title: string;
  tip: string;
  to: string;
  icon: React.ElementType;
  migrationOnly?: boolean;
}

const MIGRATION_STEPS: StepDef[] = [
  {
    id: 'import_csv',
    title: 'Import Past Bank Statements (CSV)',
    tip: 'Bring in your transaction history in seconds.',
    to: '/app/payment?tab=import',
    icon: Upload,
    migrationOnly: true,
  },
  {
    id: 'review_coa',
    title: 'Review Chart of Accounts & Opening Balances',
    tip: 'Make sure your starting balances match your old books.',
    to: '/app/chart-of-accounts',
    icon: Layers,
    migrationOnly: true,
  },
];

const CORE_STEPS: StepDef[] = [
  {
    id: 'connect_bank',
    title: 'Connect Your Bank or Email Alerts',
    tip: 'Stop manual entry — Rova captures bank alerts automatically.',
    to: '/app/payment?tab=banking',
    icon: Landmark,
  },
  {
    id: 'first_tx',
    title: 'Log or Sync Your First Transaction',
    tip: 'See AI auto-categorize transfers and ask in plain English if unclear.',
    to: '/app/transactions',
    icon: ArrowLeftRight,
  },
  {
    id: 'first_invoice',
    title: 'Create an Invoice or Payment Link',
    tip: 'Get paid faster via Paystack with automatic reconciliation.',
    to: '/app/invoices',
    icon: FileText,
  },
  {
    id: 'first_expense',
    title: 'Record an Expense or Vendor Bill',
    tip: 'Attach receipts and track unpaid supplier bills in one place.',
    to: '/app/expenses',
    icon: Receipt,
  },
  {
    id: 'view_pl',
    title: 'View Your Live Profit & Loss',
    tip: 'Know your real profit anytime — statements build automatically.',
    to: '/app/profit-loss',
    icon: TrendingUp,
  },
  {
    id: 'check_tax',
    title: 'Check Your Tax Summary & Savings',
    tip: 'Track Nigerian VAT, PAYE, CIT, and legal tax savings.',
    to: '/app/tax',
    icon: ShieldCheck,
  },
  {
    id: 'ask_ai',
    title: 'Ask Rova AI a Question',
    tip: "Try 'How much did I make this month?' — no spreadsheets needed.",
    to: '/app/assistant',
    icon: Bot,
  },
];

async function safeCount(table: string, userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

export default function GettingStartedGuide() {
  const { user, isStaff } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMobile = useMobile(768);
  const navigate = useNavigate();
  const location = useLocation();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [guideState, setGuideState] = useState<PersistedGuideState>(() =>
    user?.id ? loadGuideState(user.id) : DEFAULT_STATE
  );
  const [autoCompleted, setAutoCompleted] = useState<Record<string, boolean>>({});

  // Sync from localStorage when user changes or reopen event fires
  useEffect(() => {
    if (!user?.id) return;
    setGuideState(loadGuideState(user.id));

    const onReopen = () => {
      setGuideState(loadGuideState(user.id));
      setOpen(true);
    };
    window.addEventListener(REOPEN_GUIDE_EVENT, onReopen);
    return () => window.removeEventListener(REOPEN_GUIDE_EVENT, onReopen);
  }, [user?.id]);

  // Track visited-page steps on route changes
  useEffect(() => {
    if (!user?.id) return;
    const path = location.pathname;
    const search = location.search;
    const newlyVisited: string[] = [];

    if (path.startsWith('/app/profit-loss')) newlyVisited.push('view_pl');
    if (path.startsWith('/app/tax')) newlyVisited.push('check_tax');
    if (path.startsWith('/app/chart-of-accounts')) newlyVisited.push('review_coa');
    if (path.startsWith('/app/payment') && search.includes('tab=import')) newlyVisited.push('import_csv');

    if (newlyVisited.length > 0) {
      setGuideState((prev) => {
        const merged = Array.from(new Set([...prev.visitedIds, ...newlyVisited]));
        if (merged.length === prev.visitedIds.length) return prev;
        const next = { ...prev, visitedIds: merged };
        saveGuideState(user.id, next);
        return next;
      });
    }
  }, [location.pathname, location.search, user?.id]);

  // Auto-detect completed steps from Supabase on mount & route changes
  useEffect(() => {
    if (!user?.id || isStaff || guideState.dismissed) return;
    let cancelled = false;

    async function checkProgress() {
      const uid = user!.id;
      const [
        connectedBanks,
        emailSync,
        accounts,
        txCount,
        invCount,
        payLinksCount,
        expCount,
        billsCount,
        chatCount,
      ] = await Promise.all([
        safeCount('connected_banks', uid),
        safeCount('bank_email_sync_settings', uid),
        safeCount('accounts', uid),
        safeCount('transactions', uid),
        safeCount('invoices', uid),
        safeCount('payment_links', uid),
        safeCount('expenses', uid),
        safeCount('bills', uid),
        safeCount('chat_conversations', uid),
      ]);

      if (cancelled) return;
      setAutoCompleted({
        connect_bank: connectedBanks > 0 || emailSync > 0 || accounts > 0,
        first_tx: txCount > 0,
        first_invoice: invCount > 0 || payLinksCount > 0,
        first_expense: expCount > 0 || billsCount > 0,
        ask_ai: chatCount > 0,
      });
    }

    checkProgress();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isStaff, guideState.dismissed, location.pathname]);

  // Close desktop popover on outside click
  useEffect(() => {
    if (!open || isMobile) return;
    function handleOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, isMobile]);

  const activeSteps = useMemo(() => {
    return guideState.isSwitcher ? [...MIGRATION_STEPS, ...CORE_STEPS] : CORE_STEPS;
  }, [guideState.isSwitcher]);

  const isStepDone = (id: string) =>
    Boolean(autoCompleted[id] || guideState.visitedIds.includes(id) || guideState.skippedIds.includes(id));

  const completedCount = activeSteps.filter((s) => isStepDone(s.id)).length;
  const totalCount = activeSteps.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = completedCount === totalCount && totalCount > 0;
  const nextIncompleteId = activeSteps.find((s) => !isStepDone(s.id))?.id || null;

  // Hide for staff users or when dismissed
  if (!user?.id || isStaff || guideState.dismissed) {
    return null;
  }

  function updatePersisted(patch: Partial<PersistedGuideState>) {
    const next = { ...guideState, ...patch };
    setGuideState(next);
    saveGuideState(user!.id, next);
  }

  function toggleSkip(id: string) {
    const exists = guideState.skippedIds.includes(id);
    const nextSkipped = exists
      ? guideState.skippedIds.filter((x) => x !== id)
      : [...guideState.skippedIds, id];
    updatePersisted({ skippedIds: nextSkipped });
  }

  function handleDismiss() {
    setOpen(false);
    updatePersisted({ dismissed: true });
  }

  function handleStepAction(step: StepDef) {
    setOpen(false);
    navigate(step.to);
  }

  // Circular SVG progress ring math
  const ringR = 7.5;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - pct / 100);

  const surfaceBg = isDark ? '#141417' : '#ffffff';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)';

  const checklistBody = (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: isMobile ? '78vh' : '74vh' }}>
      {/* Popover Header */}
      <div
        style={{
          padding: '16px 18px 14px',
          borderBottom: `1px solid ${borderCol}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Sparkles size={15} color="var(--accent-primary)" />
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              Getting Started with ROVA
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {completedCount} of {totalCount} completed · {pct}% ready
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Close"
          style={{
            padding: 5,
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress Bar */}
      <div style={{ padding: '10px 18px 0' }}>
        <div
          style={{
            width: '100%',
            height: 6,
            borderRadius: 6,
            background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: 6,
              background: allDone
                ? 'var(--success)'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-light))',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Optional Switcher Toggle */}
      <div style={{ padding: '12px 18px 8px' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 10,
            background: guideState.isSwitcher ? 'var(--accent-dim)' : 'var(--bg-elevated)',
            border: `1px solid ${guideState.isSwitcher ? 'var(--accent-border)' : 'var(--bg-border)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
              Switching from another app or Excel?
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              Adds CSV statement import &amp; opening balance steps
            </div>
          </div>
          <input
            type="checkbox"
            checked={guideState.isSwitcher}
            onChange={(e) => updatePersisted({ isSwitcher: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)', cursor: 'pointer', flexShrink: 0 }}
          />
        </label>
      </div>

      {/* Celebration OR Checklist Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 14px' }}>
        {allDone ? (
          <div
            style={{
              textAlign: 'center',
              padding: '28px 16px',
              borderRadius: 14,
              background: isDark ? 'rgba(34, 197, 94, 0.08)' : '#ecfdf5',
              border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.25)' : '#bbf7d0'}`,
              margin: '6px 4px',
            }}
          >
            <PartyPopper size={34} color="var(--success)" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              You&apos;re all set up on ROVA!
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Your books, statements, and AI assistant are ready to run on autopilot. You can re-open this guide anytime in Settings.
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                padding: '9px 18px',
                borderRadius: 10,
                background: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Hide Setup Guide
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeSteps.map((step) => {
              const done = isStepDone(step.id);
              const isSkipped = guideState.skippedIds.includes(step.id) && !autoCompleted[step.id] && !guideState.visitedIds.includes(step.id);
              const isNext = step.id === nextIncompleteId;
              const StepIcon = step.icon;

              return (
                <div
                  key={step.id}
                  style={{
                    padding: '11px 12px',
                    borderRadius: 12,
                    background: isNext
                      ? 'var(--accent-dim)'
                      : done
                      ? 'transparent'
                      : 'var(--bg-elevated)',
                    border: `1px solid ${
                      isNext
                        ? 'var(--accent-border)'
                        : done
                        ? 'var(--bg-border)'
                        : 'var(--bg-border)'
                    }`,
                    opacity: done ? 0.68 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: done
                          ? 'var(--success-dim)'
                          : isNext
                          ? 'var(--accent-primary)'
                          : 'var(--bg-card)',
                        color: done
                          ? 'var(--success)'
                          : isNext
                          ? '#ffffff'
                          : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {done ? <CheckCircle2 size={14} /> : <StepIcon size={13} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            textDecoration: done ? 'line-through' : 'none',
                          }}
                        >
                          {step.title}
                        </span>
                        {step.migrationOnly && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 6,
                              background: 'rgba(59,130,246,0.14)',
                              color: '#3b82f6',
                              textTransform: 'uppercase',
                            }}
                          >
                            Migration
                          </span>
                        )}
                        {isSkipped && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(Skipped)</span>
                        )}
                      </div>

                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 }}>
                        {step.tip}
                      </div>

                      {!done && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleStepAction(step)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 11px',
                              borderRadius: 8,
                              background: isNext ? 'var(--accent-primary)' : 'var(--bg-card)',
                              color: isNext ? '#ffffff' : 'var(--text-primary)',
                              border: isNext ? 'none' : '1px solid var(--bg-border)',
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <span>Do this now</span>
                            <ChevronRight size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSkip(step.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '5px 8px',
                              borderRadius: 8,
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            <SkipForward size={11} /> Skip
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {!allDone && (
        <div
          style={{
            padding: '10px 18px',
            borderTop: `1px solid ${borderCol}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11.5,
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Re-open anytime in Settings</span>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Dismiss guide
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Compact Header Pill Trigger with Circular Progress Ring */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Getting Started Setup Checklist"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          height: 32,
          padding: isMobile ? '0 9px' : '0 11px',
          borderRadius: 999,
          background: open ? 'var(--accent-dim)' : 'var(--bg-elevated)',
          border: `1px solid ${open ? 'var(--accent-border)' : 'var(--bg-border)'}`,
          color: 'var(--text-primary)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="19" height="19" viewBox="0 0 20 20" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
          <circle
            cx="10"
            cy="10"
            r={ringR}
            fill="none"
            stroke={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)'}
            strokeWidth="2.4"
          />
          <circle
            cx="10"
            cy="10"
            r={ringR}
            fill="none"
            stroke={allDone ? 'var(--success)' : 'var(--accent-primary)'}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray={ringC}
            strokeDashoffset={ringOffset}
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <span>
          {isMobile ? `${completedCount}/${totalCount}` : `Setup · ${completedCount}/${totalCount}`}
        </span>
      </button>

      {/* Desktop Floating Popover */}
      {open && !isMobile && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 390,
            background: surfaceBg,
            border: `1px solid ${borderCol}`,
            borderRadius: 16,
            boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.65)' : '0 16px 42px rgba(15,23,42,0.16)',
            zIndex: 1200,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {checklistBody}
        </div>
      )}

      {/* Mobile Bottom Sheet / Modal */}
      {open && isMobile && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 1400,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              background: surfaceBg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTop: `1px solid ${borderCol}`,
              boxShadow: '0 -10px 40px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            {checklistBody}
          </div>
        </div>
      )}
    </div>
  );
}
