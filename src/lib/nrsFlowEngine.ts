import type { NrsFlowConfig, AnswerStore, NrsExportPayload } from '../types/nrsQuestionFlow';
import flowData from './rova_question_flow.json';

export const flowConfig: NrsFlowConfig = flowData as NrsFlowConfig;

/**
 * Evaluates `show_if` conditions against current `answers{}`
 */
export function evaluateShowIf(condition: string | undefined, answers: AnswerStore): boolean {
  if (!condition || !condition.trim()) return true;

  const cond = condition.trim();

  // Sector conditional option check: "sectors_includes:Mining & Quarry"
  if (cond.startsWith('sectors_includes:')) {
    const targetSector = cond.replace('sectors_includes:', '').trim();
    const sectors = answers.sectors || [];
    return Array.isArray(sectors) && sectors.includes(targetSector);
  }

  // Any of sector check: "any_of:[Manufacturing, Mining & Quarry, Construction]"
  if (cond.includes('any_of:[')) {
    const match = cond.match(/any_of:\[(.*?)\]/);
    if (match && match[1]) {
      const targets = match[1].split(',').map((s) => s.trim());
      const sectors = answers.sectors || [];
      return Array.isArray(sectors) && targets.some((t) => sectors.includes(t));
    }
  }

  // Expression evaluation for equality, inequality, comparison
  try {
    let expr = cond.replace(/(answers\.|flag\.)([a-zA-Z0-9_]+)/g, (_match, prefix, key) => {
      const fullKey = prefix === 'flag.' ? `flag.${key}` : key;
      const val = answers[fullKey] ?? answers[key];
      if (val === undefined || val === null) return '0';
      if (typeof val === 'string') return `'${val}'`;
      if (typeof val === 'boolean') return val ? 'true' : 'false';
      return String(val);
    });

    expr = expr.replace(/==/g, '===').replace(/!=/g, '!==');

    const fn = new Function(`return Boolean(${expr});`);
    return Boolean(fn());
  } catch (_err) {
    return true;
  }
}

/**
 * Computes numeric value for `sum(chip_field)` or general formula expressions
 */
export function evaluateFormula(formula: string, answers: AnswerStore): number | boolean {
  if (!formula || !formula.trim()) return 0;

  const trimmed = formula.trim();

  // Handle balance_check boolean equality formula
  if (trimmed.includes('==')) {
    const parts = trimmed.split('==');
    if (parts.length === 2) {
      const left = Number(evaluateFormula(parts[0], answers));
      const right = Number(evaluateFormula(parts[1], answers));
      return Math.abs(left - right) < 0.01;
    }
  }

  // 1. Pre-process `sum(field_name)` macros
  let expr = trimmed.replace(/sum\(([a-zA-Z0-9_]+)\)/g, (_match, key) => {
    const val = answers[key];
    if (Array.isArray(val)) {
      return String(val.reduce((s: number, n: any) => s + (Number(n) || 0), 0));
    } else if (val && typeof val === 'object') {
      return String(Object.values(val).reduce((s: number, n: any) => s + (Number(n) || 0), 0));
    }
    return '0';
  });

  // 2. Replace remaining field identifiers with their numeric values
  expr = expr.replace(/\b([a-zA-Z_][a-zA-Z0-9._]*)\b/g, (match, fullKey) => {
    if (['sum', 'Math', 'true', 'false'].includes(fullKey) || !isNaN(Number(fullKey))) return match;
    const cleanKey = fullKey.startsWith('answers.') ? fullKey.replace('answers.', '') : fullKey;
    const val = answers[cleanKey] ?? answers[fullKey];
    return String(Number(val) || 0);
  });

  try {
    const fn = new Function(`return Number(${expr});`);
    const res = fn();
    return isNaN(res) ? 0 : res;
  } catch (_err) {
    return 0;
  }
}

/**
 * Recomputes all dynamic `flags_set`, derived values, and calculated fields into `answers{}`
 */
export function syncComputedEngineState(answers: AnswerStore, config: NrsFlowConfig = flowConfig): AnswerStore {
  const nextAnswers = { ...answers };

  // 1. Process flags_set from answers
  config.stages.forEach((stage) => {
    if (!evaluateShowIf(stage.show_if, nextAnswers)) return;

    stage.questions?.forEach((q) => {
      if (!evaluateShowIf(q.show_if, nextAnswers)) return;

      if (q.flags_set) {
        if (q.id === 'closing_inventory_total') {
          const val = Number(nextAnswers.closing_inventory_total) || 0;
          nextAnswers['flag.closing_inventory_value'] = val;
        } else if (q.type === 'chip_select_then_amount' || q.type === 'chip_select_then_amount_nested') {
          const chipAmounts = nextAnswers[q.id] || {};
          Object.entries(q.flags_set).forEach(([chipName, flagKey]) => {
            const amount = Number(chipAmounts[chipName]) || 0;
            nextAnswers[flagKey] = amount;
          });
        }
      }
    });
  });

  // 2. Process calculated & derived fields
  config.stages.forEach((stage) => {
    if (!evaluateShowIf(stage.show_if, nextAnswers)) return;

    stage.calculated?.forEach((calc) => {
      const val = evaluateFormula(calc.formula, nextAnswers);
      nextAnswers[calc.id] = val;
    });

    stage.derived?.forEach((der) => {
      if (evaluateShowIf(der.show_if, nextAnswers)) {
        if (nextAnswers[`override_${der.id}`] === undefined) {
          const derivedVal = evaluateFormula(der.formula, nextAnswers);
          nextAnswers[der.id] = derivedVal;
        } else {
          nextAnswers[der.id] = nextAnswers[`override_${der.id}`];
        }
      }
    });
  });

  return nextAnswers;
}

/**
 * Hydrates sparse `answers{}` into complete NRS Submission Payload.
 * Populates all known `nrs_field` definitions from the JSON spec with explicit `0.00` if unanswered.
 */
export function hydrateForExport(answers: AnswerStore, config: NrsFlowConfig = flowConfig): NrsExportPayload {
  const fullPayload: NrsExportPayload = {};
  const computedState = syncComputedEngineState(answers, config);

  const setNrsField = (nrsKey?: string, val?: any) => {
    if (!nrsKey) return;

    const keys = nrsKey.split(',').map((k) => k.trim());
    const numericVal = Number(val);
    const formattedVal = isNaN(numericVal) ? (val !== undefined && val !== null ? String(val) : '0.00') : numericVal.toFixed(2);

    keys.forEach((k) => {
      fullPayload[k] = formattedVal;
    });
  };

  config.stages.forEach((stage) => {
    stage.questions?.forEach((q) => {
      if (q.nrs_field) {
        const val = computedState[q.id];
        setNrsField(q.nrs_field, val !== undefined ? val : '0.00');
      }

      if (q.nrs_field_map) {
        const selectedChips = computedState[q.id] || {};
        Object.entries(q.nrs_field_map).forEach(([chipName, nrsKey]) => {
          const amount = selectedChips[chipName];
          setNrsField(nrsKey, amount !== undefined ? amount : '0.00');
        });
      }

      if (q.nrs_field_map_top) {
        const selectedChips = computedState[q.id] || {};
        Object.entries(q.nrs_field_map_top).forEach(([chipName, nrsKey]) => {
          const amount = selectedChips[chipName];
          setNrsField(nrsKey, amount !== undefined ? amount : '0.00');
        });
      }

      if (q.optional_breakdown) {
        q.optional_breakdown.fields.forEach((fieldKey, idx) => {
          const nrsKey = q.optional_breakdown?.nrs_fields[idx];
          const amount = computedState[`${q.id}_${fieldKey}`];
          setNrsField(nrsKey, amount !== undefined ? amount : '0.00');
        });
      }
    });

    stage.derived?.forEach((der) => {
      if (der.nrs_field) {
        const val = computedState[der.id];
        setNrsField(der.nrs_field, val !== undefined ? val : '0.00');
      }
    });

    stage.calculated?.forEach((calc) => {
      if (calc.nrs_field && typeof computedState[calc.id] === 'number') {
        setNrsField(calc.nrs_field, computedState[calc.id]);
      }
    });
  });

  return fullPayload;
}
