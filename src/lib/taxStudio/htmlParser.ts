/**
 * HTML Parser & Element Analyzer for Rova Automation Studio
 * Extracts forms, input fields, buttons, dropdowns, and validation rules from uploaded portal HTML
 */

import type { ElementActionType } from './workflowTypes';

export interface ParsedElement {
  id: string;
  tagName: string;
  type?: string;
  name?: string;
  elementId?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  required: boolean;
  pattern?: string;
  maxLength?: number;
  classes: string[];
  options?: Array<{ label: string; value: string }>;
  selectorPrimary: string;
  selectorFallbacks: string[];
  isSensitiveGuess: boolean;
  actionRecommendation: ElementActionType;
  suggestedBinding?: string;
}

export interface ParsedForm {
  id: string;
  action?: string;
  method?: string;
  elements: ParsedElement[];
}

export interface ParsedPortalSnapshot {
  title: string;
  forms: ParsedForm[];
  allElements: ParsedElement[];
  standaloneButtons: ParsedElement[];
}

/**
 * Builds CSS selectors with prioritized fallbacks:
 * 1. #id
 * 2. [name="..."]
 * 3. [data-testid="..."]
 * 4. Tag + Name / Class combination
 */
function generateSelectors(el: Element): { primary: string; fallbacks: string[] } {
  const fallbacks: string[] = [];
  const id = el.getAttribute('id');
  const name = el.getAttribute('name');
  const testId = el.getAttribute('data-testid') || el.getAttribute('data-cy');
  const tagName = el.tagName.toLowerCase();
  const type = el.getAttribute('type');

  let primary = '';

  if (id && !id.match(/\d{5,}/)) {
    // Avoid purely auto-generated random ID strings
    primary = `#${id}`;
  } else if (name) {
    primary = `${tagName}[name="${name}"]`;
  } else if (testId) {
    primary = `[data-testid="${testId}"]`;
  } else {
    // Generic fallback
    primary = tagName;
    if (type) primary += `[type="${type}"]`;
  }

  // Generate fallbacks
  if (id) fallbacks.push(`#${id}`);
  if (name) fallbacks.push(`${tagName}[name="${name}"]`);
  if (testId) fallbacks.push(`[data-testid="${testId}"]`);

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    fallbacks.push(`[aria-label="${ariaLabel}"]`);
  }

  const textContent = el.textContent?.trim();
  if ((tagName === 'button' || tagName === 'a') && textContent && textContent.length < 40) {
    fallbacks.push(`text="${textContent}"`);
  }

  return { primary, fallbacks: Array.from(new Set(fallbacks)) };
}

/**
 * Detects whether an element represents sensitive customer credentials
 */
function isSensitiveField(name: string = '', label: string = '', placeholder: string = '', type: string = ''): boolean {
  if (type === 'password') return true;
  const combined = `${name} ${label} ${placeholder}`.toLowerCase();
  const sensitiveKeywords = [
    'bvn',
    'bank verification',
    'nin',
    'national identification',
    'password',
    'pin',
    'otp',
    'token',
    'one-time',
    'passcode',
    'secret',
    'cvv',
  ];
  return sensitiveKeywords.some((keyword) => combined.includes(keyword));
}

/**
 * Suggests Rova data bindings based on common Nigerian tax portal labels
 */
function suggestFieldBinding(name: string = '', label: string = '', placeholder: string = ''): {
  binding?: string;
  action: 'AI_FILL' | 'CUSTOMER_FILL' | 'AI_CLICK' | 'CUSTOMER_APPROVAL' | 'SKIP';
} {
  const text = `${name} ${label} ${placeholder}`.toLowerCase();

  // Sensitive handoff fields
  if (text.includes('bvn')) return { binding: 'customer.bvn', action: 'CUSTOMER_FILL' };
  if (text.includes('nin')) return { binding: 'customer.nin', action: 'CUSTOMER_FILL' };
  if (text.includes('otp') || text.includes('token')) return { binding: 'session.otp', action: 'CUSTOMER_FILL' };
  if (text.includes('password') || text.includes('passcode')) return { binding: 'session.password', action: 'CUSTOMER_FILL' };

  // Taxpayer Identifiers
  if (text.includes('tin') || text.includes('tax identification')) {
    return { binding: 'taxpayer.tin', action: 'AI_FILL' };
  }
  if (text.includes('payer id') || text.includes('payer_id') || text.includes('pid')) {
    return { binding: 'taxpayer.payer_id', action: 'AI_FILL' };
  }
  if (text.includes('rc number') || text.includes('rc_no') || text.includes('cac')) {
    return { binding: 'company.rc_number', action: 'AI_FILL' };
  }

  // Names & Personal Info
  if (text.includes('company name') || text.includes('business name')) {
    return { binding: 'company.name', action: 'AI_FILL' };
  }
  if (text.includes('first name')) return { binding: 'taxpayer.first_name', action: 'AI_FILL' };
  if (text.includes('last name') || text.includes('surname')) return { binding: 'taxpayer.last_name', action: 'AI_FILL' };
  if (text.includes('full name') || text.includes('taxpayer name')) return { binding: 'taxpayer.full_name', action: 'AI_FILL' };
  if (text.includes('email')) return { binding: 'taxpayer.email', action: 'AI_FILL' };
  if (text.includes('phone') || text.includes('mobile')) return { binding: 'taxpayer.phone', action: 'AI_FILL' };
  if (text.includes('address')) return { binding: 'taxpayer.address', action: 'AI_FILL' };

  // Tax Financial Computations
  if (text.includes('gross income') || text.includes('turnover') || text.includes('revenue')) {
    return { binding: 'computation.gross_revenue', action: 'AI_FILL' };
  }
  if (text.includes('chargeable') || text.includes('taxable income') || text.includes('assessable profit')) {
    return { binding: 'computation.taxable_income', action: 'AI_FILL' };
  }
  if (text.includes('capital allowance')) return { binding: 'computation.capital_allowance', action: 'AI_FILL' };
  if (text.includes('tax liability') || text.includes('total tax')) return { binding: 'computation.tax_payable', action: 'AI_FILL' };

  // Submission Buttons
  if (text.includes('submit') || text.includes('file return') || text.includes('pay') || text.includes('confirm')) {
    return { action: 'CUSTOMER_APPROVAL' };
  }

  return { action: 'AI_FILL' };
}

/**
 * Parses raw HTML string and produces structured metadata for the Automation Studio
 */
export function parsePortalHtml(rawHtml: string): ParsedPortalSnapshot {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const title = doc.title || 'Untitled Tax Portal Page';
  const allElements: ParsedElement[] = [];
  const forms: ParsedForm[] = [];

  // Helper to extract an element's label
  const findLabel = (el: Element): string => {
    const id = el.getAttribute('id');
    if (id) {
      const labelEl = doc.querySelector(`label[for="${id}"]`);
      if (labelEl && labelEl.textContent) return labelEl.textContent.trim();
    }
    // Closest label parent
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.textContent) return parentLabel.textContent.trim();

    // Previous sibling label
    const prev = el.previousElementSibling;
    if (prev && prev.tagName.toLowerCase() === 'label' && prev.textContent) {
      return prev.textContent.trim();
    }

    // Aria label or placeholder
    return el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
  };

  const processFormElement = (el: Element, index: number): ParsedElement => {
    const tagName = el.tagName.toLowerCase();
    const type = el.getAttribute('type') || (tagName === 'textarea' ? 'textarea' : 'text');
    const name = el.getAttribute('name') || '';
    const elementId = el.getAttribute('id') || '';
    const label = findLabel(el);
    const placeholder = el.getAttribute('placeholder') || '';
    const required = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
    const classes = Array.from(el.classList);
    const { primary, fallbacks } = generateSelectors(el);

    const isSensitive = isSensitiveField(name, label, placeholder, type);
    const recommendation = suggestFieldBinding(name, label, placeholder);

    let options: Array<{ label: string; value: string }> | undefined = undefined;
    if (tagName === 'select') {
      options = Array.from(el.querySelectorAll('option')).map((opt) => ({
        label: opt.textContent?.trim() || opt.value,
        value: opt.value,
      }));
    }

    return {
      id: elementId || `elem_${tagName}_${name || index}`,
      tagName,
      type,
      name,
      elementId,
      label,
      placeholder,
      value: (el as HTMLInputElement).value || '',
      required,
      pattern: el.getAttribute('pattern') || undefined,
      maxLength: el.hasAttribute('maxlength') ? Number(el.getAttribute('maxlength')) : undefined,
      classes,
      options,
      selectorPrimary: primary,
      selectorFallbacks: fallbacks,
      isSensitiveGuess: isSensitive,
      actionRecommendation: isSensitive ? 'CUSTOMER_FILL' : recommendation.action,
      suggestedBinding: recommendation.binding,
    };
  };

  // Process forms
  const formElements = Array.from(doc.querySelectorAll('form'));
  if (formElements.length > 0) {
    formElements.forEach((formEl, formIdx) => {
      const formId = formEl.getAttribute('id') || `form_${formIdx + 1}`;
      const action = formEl.getAttribute('action') || '';
      const method = formEl.getAttribute('method') || 'GET';

      const inputs = Array.from(formEl.querySelectorAll('input, select, textarea, button'));
      const parsedInputs = inputs.map((input, idx) => processFormElement(input, idx));

      forms.push({
        id: formId,
        action,
        method,
        elements: parsedInputs,
      });

      allElements.push(...parsedInputs);
    });
  }

  // Scan standalone inputs/buttons outside forms
  const standaloneNodes = Array.from(doc.querySelectorAll('body input, body select, body textarea, body button')).filter(
    (el) => !el.closest('form')
  );

  const standaloneParsed = standaloneNodes.map((el, idx) => processFormElement(el, idx + 1000));
  allElements.push(...standaloneParsed);

  const standaloneButtons = allElements.filter(
    (e) => e.tagName === 'button' || e.type === 'submit' || e.type === 'button'
  );

  return {
    title,
    forms,
    allElements,
    standaloneButtons,
  };
}
