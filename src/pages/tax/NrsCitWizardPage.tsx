import { useEffect, useState, useTransition } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, CheckCircle, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { flowConfig, evaluateShowIf, syncComputedEngineState } from '../../lib/nrsFlowEngine';
import type { AnswerStore, Stage } from '../../types/nrsQuestionFlow';
import { ChipSelectAmount } from '../../components/tax/ChipSelectAmount';
import { DerivedConfirmCard } from '../../components/tax/DerivedConfirmCard';
import { LiveBalanceWarning } from '../../components/tax/LiveBalanceWarning';
import { NrsSummaryPreview } from '../../components/tax/NrsSummaryPreview';

const LOCAL_STORAGE_KEY_PREFIX = 'rova_nrs_cit_draft_';

export default function NrsCitWizardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { filingId } = useParams<{ filingId?: string }>();
  const [_isPending, startTransition] = useTransition();

  // Load initial sparse state
  const [answers, setAnswers] = useState<AnswerStore>(() => {
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${filingId || 'new'}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_e) {
        /* fallback */
      }
    }
    return { year_of_assessment: 2026 };
  });

  const [currentStageId, setCurrentStageId] = useState<string>('profile');
  const [saving, setSaving] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Sync derived/calculated engine state on answers change
  const activeComputedState = syncComputedEngineState(answers, flowConfig);

  // Active stages filtered by show_if
  const activeStages = flowConfig.stages.filter(
    (stg) => stg.always_show || evaluateShowIf(stg.show_if, activeComputedState)
  );

  const currentStageIndex = Math.max(
    0,
    activeStages.findIndex((s) => s.id === currentStageId)
  );
  const currentStage: Stage = activeStages[currentStageIndex] || activeStages[0];

  // 1. Dual-Layer Persistence: Write-through cache to localStorage (1s debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(
        `${LOCAL_STORAGE_KEY_PREFIX}${filingId || 'new'}`,
        JSON.stringify(answers)
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [answers, filingId]);

  // 2. Periodic sync to Supabase (30s timer)
  useEffect(() => {
    const interval = setInterval(() => {
      saveDraftToSupabase();
    }, 30000);
    return () => clearInterval(interval);
  }, [answers, currentStageId]);

  const saveDraftToSupabase = async () => {
    if (!user) return;
    setSaving(true);

    const yearOfAssessment = Number(answers.year_of_assessment) || 2026;
    const grossIncome = Number(activeComputedState.total_revenue) || 0;
    const taxableIncome = Number(activeComputedState.profit_for_year) || 0;

    const recordPayload = {
      user_id: user.id,
      tax_type: 'CIT' as const,
      period_start: `${yearOfAssessment - 1}-01-01`,
      period_end: `${yearOfAssessment - 1}-12-31`,
      gross_income: grossIncome,
      deductions: Number(activeComputedState.cost_of_sales_total) || 0,
      taxable_income: taxableIncome,
      calculated_tax: Number(activeComputedState.tax_paid_or_payable) || 0,
      paid_tax: 0,
      status: 'pending' as const,
      notes: `NRS CIT Filing Draft (Stage: ${currentStageId})`,
    };

    if (filingId && filingId !== 'new') {
      await supabase.from('tax_records').update(recordPayload).eq('id', filingId);
    } else {
      const { data } = await supabase
        .from('tax_records')
        .insert(recordPayload)
        .select()
        .single();
      if (data?.id && !filingId) {
        startTransition(() => {
          navigate(`/app/tax/cit/${data.id}`, { replace: true });
        });
      }
    }
    setSaving(false);
  };

  const updateAnswer = (key: string, val: any) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleNextStage = () => {
    if (currentStageIndex < activeStages.length - 1) {
      const nextStage = activeStages[currentStageIndex + 1];
      setCurrentStageId(nextStage.id);
      saveDraftToSupabase();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStage = () => {
    if (currentStageIndex > 0) {
      const prevStage = activeStages[currentStageIndex - 1];
      setCurrentStageId(prevStage.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmitFiling = async () => {
    setSubmitting(true);
    await saveDraftToSupabase();
    localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}${filingId || 'new'}`);

    if (filingId && filingId !== 'new') {
      await supabase.from('tax_records').update({ status: 'filed' }).eq('id', filingId);
    }

    setSubmitting(false);
    navigate('/app/tax');
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/app/tax')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} /> Exit to Tax Hub
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => saveDraftToSupabase()}
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      </div>

      {/* Wizard Header & Stepper */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
          NRS Company Income Tax (CIT) Filing Wizard
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Minimal FIRS CIT filing generator — answering only relevant questions for your business
        </p>

        {/* Stage Progress Bar & Stepper */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--accent-light)',
            }}
          >
            <span>
              Stage {currentStageIndex + 1} of {activeStages.length}: {currentStage.title}
            </span>
            <span>{Math.round(((currentStageIndex + 1) / activeStages.length) * 100)}% Completed</span>
          </div>

          <div
            style={{
              height: 6,
              background: 'var(--bg-border)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${((currentStageIndex + 1) / activeStages.length) * 100}%`,
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-light))',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* Stepper Tabs */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingTop: 8 }}>
            {activeStages.map((stg, idx) => {
              const isActive = stg.id === currentStageId;
              const isCompleted = idx < currentStageIndex;

              return (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => setCurrentStageId(stg.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 16,
                    fontSize: 12,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    border: isActive
                      ? '1px solid var(--accent-primary)'
                      : '1px solid var(--bg-border)',
                    background: isActive
                      ? 'var(--accent-dim)'
                      : isCompleted
                      ? 'var(--bg-elevated)'
                      : 'var(--bg-base)',
                    color: isActive
                      ? 'var(--accent-light)'
                      : isCompleted
                      ? 'var(--text-secondary)'
                      : 'var(--text-disabled)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {isCompleted && <CheckCircle size={12} color="var(--success)" />}
                  {idx + 1}. {stg.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Stage Content */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          marginBottom: 24,
        }}
      >
        {currentStage.id === 'review_and_submit' ? (
          <NrsSummaryPreview
            answers={activeComputedState}
            onSubmit={handleSubmitFiling}
            submitting={submitting}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Stage Title */}
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {currentStage.title}
              </h2>
            </div>

            {/* Render Derived Confirm Cards (Add-backs & Deductions) */}
            {currentStage.derived && currentStage.derived.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-light)' }}>
                  Derived Tax Adjustments (Add-backs & Deductions)
                </div>
                {currentStage.derived.map((der) => {
                  if (!evaluateShowIf(der.show_if, activeComputedState)) return null;

                  const derivedVal = Number(activeComputedState[der.id]) || 0;
                  const overrideVal = answers[`override_${der.id}`];

                  return (
                    <DerivedConfirmCard
                      key={der.id}
                      derived={der}
                      derivedValue={derivedVal}
                      overrideValue={overrideVal}
                      onOverrideChange={(newVal) => updateAnswer(`override_${der.id}`, newVal)}
                    />
                  );
                })}
              </div>
            )}

            {/* Render Questions */}
            {currentStage.questions?.map((q) => {
              if (!evaluateShowIf(q.show_if, activeComputedState)) return null;

              return (
                <div
                  key={q.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 16,
                    background: 'var(--bg-base)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--bg-border)',
                  }}
                >
                  <label
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {q.prompt}
                    {q.required && <span style={{ color: 'var(--error)' }}>*</span>}
                  </label>

                  {q.note && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <HelpCircle size={13} color="var(--accent-light)" /> {q.note}
                    </div>
                  )}

                  {/* Question Type Input Handlers */}

                  {q.type === 'number' && (
                    <input
                      type="number"
                      placeholder="0.00"
                      value={answers[q.id] !== undefined ? answers[q.id] : ''}
                      onChange={(e) => updateAnswer(q.id, e.target.value)}
                      style={{
                        padding: '10px 14px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--bg-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  )}

                  {q.type === 'single_select' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {q.options?.map((opt) => {
                        const isSelected = answers[q.id] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => updateAnswer(q.id, opt)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 13,
                              fontWeight: 500,
                              border: isSelected
                                ? '1px solid var(--accent-primary)'
                                : '1px solid var(--bg-border)',
                              background: isSelected ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                              color: isSelected ? 'var(--accent-light)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'multi_select_searchable' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {q.options?.map((opt) => {
                        const selected: string[] = answers[q.id] || [];
                        const isSelected = selected.includes(opt);

                        const toggle = () => {
                          if (isSelected) {
                            updateAnswer(
                              q.id,
                              selected.filter((s) => s !== opt)
                            );
                          } else {
                            updateAnswer(q.id, [...selected, opt]);
                          }
                        };

                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={toggle}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 20,
                              fontSize: 13,
                              fontWeight: 500,
                              border: isSelected
                                ? '1px solid var(--accent-primary)'
                                : '1px solid var(--bg-border)',
                              background: isSelected ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                              color: isSelected ? 'var(--accent-light)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'number_repeat_per_selection' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(answers.sectors || ['Main Revenue']).map((sector: string, idx: number) => {
                        const sectorRev = (answers.revenue_per_sector || [])[idx] || '';
                        return (
                          <div
                            key={sector}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                              Revenue for <strong>{sector}</strong>:
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>₦</span>
                              <input
                                type="number"
                                placeholder="0.00"
                                value={sectorRev}
                                onChange={(e) => {
                                  const arr = [...(answers.revenue_per_sector || [])];
                                  arr[idx] = Number(e.target.value) || 0;
                                  updateAnswer('revenue_per_sector', arr);
                                }}
                                style={{
                                  width: 180,
                                  padding: '8px 12px',
                                  background: 'var(--bg-elevated)',
                                  border: '1px solid var(--bg-border)',
                                  borderRadius: 'var(--radius-sm)',
                                  color: 'var(--text-primary)',
                                  fontSize: 14,
                                  fontWeight: 600,
                                  textAlign: 'right',
                                  outline: 'none',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'boolean' && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => updateAnswer(q.id, true)}
                        style={{
                          padding: '8px 24px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 13,
                          fontWeight: 600,
                          border:
                            answers[q.id] === true
                              ? '1px solid var(--accent-primary)'
                              : '1px solid var(--bg-border)',
                          background:
                            answers[q.id] === true ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                          color:
                            answers[q.id] === true ? 'var(--accent-light)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => updateAnswer(q.id, false)}
                        style={{
                          padding: '8px 24px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 13,
                          fontWeight: 600,
                          border:
                            answers[q.id] === false
                              ? '1px solid var(--accent-primary)'
                              : '1px solid var(--bg-border)',
                          background:
                            answers[q.id] === false ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                          color:
                            answers[q.id] === false ? 'var(--accent-light)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        No
                      </button>
                    </div>
                  )}

                  {q.type === 'chip_select_then_amount' && (
                    <ChipSelectAmount
                      question={q}
                      value={answers[q.id] || {}}
                      onChange={(val) => updateAnswer(q.id, val)}
                      sectors={answers.sectors || []}
                    />
                  )}

                  {q.type === 'chip_select_then_amount_nested' && (
                    <ChipSelectAmount
                      question={q}
                      value={answers[q.id] || {}}
                      onChange={(val) => updateAnswer(q.id, val)}
                    />
                  )}
                </div>
              );
            })}

            {/* Live Balance Check Indicator on Statement of Financial Position Stage */}
            {currentStage.id === 'financial_position' && (
              <LiveBalanceWarning
                totalAssets={Number(activeComputedState.total_assets) || 0}
                totalLiabilities={
                  (Number(activeComputedState.total_current_liabilities) || 0) +
                  (Number(activeComputedState.non_current_liabilities_total) || 0)
                }
                totalEquity={Number(activeComputedState.total_equity) || 0}
                isBalanced={Boolean(activeComputedState.balance_check)}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <button
          type="button"
          onClick={handlePrevStage}
          disabled={currentStageIndex === 0}
          style={{
            padding: '10px 20px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            cursor: currentStageIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentStageIndex === 0 ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ArrowLeft size={16} /> Previous Stage
        </button>

        {currentStageIndex < activeStages.length - 1 && (
          <button
            type="button"
            onClick={handleNextStage}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
            }}
          >
            Next: {activeStages[currentStageIndex + 1].title} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
