/**
 * Production-Accurate LIRS PIT Automation Workflow
 * Derived directly from inspected official LIRS e-Tax portal DOM snapshots
 * Files analyzed: returns.html, generate bill page.html, Dashboard.html
 */

import type { WorkflowStep } from './workflowTypes';

export const LIRS_OFFICIAL_FILING_STEPS: WorkflowStep[] = [
  // ── STAGE 1: PORTAL NAVIGATION & YEAR SELECTION ──────────────
  {
    stepId: 'lirs_click_file_returns',
    order: 1,
    title: 'Initiate Return on e-Tax Dashboard',
    description: 'Click the primary "File Returns Here" banner action',
    action: 'AI_CLICK',
    selector: 'button:has-text("File Returns Here"), a:has-text("File Returns")',
    isSensitive: false,
    requiresHandoff: false,
    expectedUrlPattern: 'etax.lirs.net',
  },
  {
    stepId: 'lirs_select_assessment_year',
    order: 2,
    title: 'Select Tax Year (e.g. 2025 / 2026)',
    description: 'Select filing assessment year pill',
    action: 'AI_CLICK',
    selector: 'button:has-text("2025"), button:has-text("2026")',
    isSensitive: false,
    requiresHandoff: false,
  },

  // ── STAGE 2: STATUTORY INCOME DECLARATION ─────────────────────
  {
    stepId: 'lirs_fill_trade_income',
    order: 3,
    title: 'Fill Business / Trade Income',
    description: 'Populate verified sole proprietor net trade income from Rova General Ledger',
    action: 'AI_FILL',
    selector: 'input[name="tradeIncome"]',
    fieldBinding: 'computation.taxable_income',
    isSensitive: false,
    requiresHandoff: false,
  },
  {
    stepId: 'lirs_fill_salary',
    order: 4,
    title: 'Fill Employment Salary (if any)',
    description: 'Populate director / employee salary earnings from payroll',
    action: 'AI_FILL',
    selector: 'input[name="salary"]',
    fieldBinding: 'taxpayer.salary_income',
    isSensitive: false,
    requiresHandoff: false,
  },
  {
    stepId: 'lirs_fill_commission',
    order: 5,
    title: 'Fill Commission & Bonuses',
    description: 'Populate commission earnings',
    action: 'AI_FILL',
    selector: 'input[name="commission"]',
    fieldBinding: 'taxpayer.commission',
    isSensitive: false,
    requiresHandoff: false,
  },
  {
    stepId: 'lirs_fill_allowances',
    order: 6,
    title: 'Fill Allowances',
    description: 'Populate housing, transport, and other allowances',
    action: 'AI_FILL',
    selector: 'input[name="allowance"]',
    fieldBinding: 'taxpayer.allowances',
    isSensitive: false,
    requiresHandoff: false,
  },
  {
    stepId: 'lirs_fill_pension',
    order: 7,
    title: 'Fill Statutory Pension Contribution',
    description: 'Deductible pension contribution under PRA 2014',
    action: 'AI_FILL',
    selector: 'input[name="pension"]',
    fieldBinding: 'computation.pension_deduction',
    isSensitive: false,
    requiresHandoff: false,
  },

  // ── STAGE 3: ACCOMMODATION & RESIDENCY SCHEDULE ───────────────
  {
    stepId: 'lirs_fill_residence',
    order: 8,
    title: 'Fill Lagos Residential Address',
    description: 'Taxpayer primary residence within Lagos State',
    action: 'AI_FILL',
    selector: 'input[name="residentialAddress"]',
    fieldBinding: 'taxpayer.address',
    isSensitive: false,
    requiresHandoff: false,
  },
  {
    stepId: 'lirs_fill_rent',
    order: 9,
    title: 'Fill Annual Accommodation Rent Paid',
    description: 'Annual rent paid for primary residence',
    action: 'AI_FILL',
    selector: 'input[name="accommodationRent"]',
    fieldBinding: 'taxpayer.rent_paid',
    isSensitive: false,
    requiresHandoff: false,
  },

  // ── STAGE 4: SUPPORTING EVIDENCE ATTACHMENT ───────────────────
  {
    stepId: 'lirs_attach_bank_statement',
    order: 10,
    title: 'Attach Certified Bank Statement PDF',
    description: 'Auto-attach Rova verified bank account ledger / statement package',
    action: 'AI_FILL',
    selector: 'input[name="bankAccountStatement"], input[id="returns-file-0"]',
    fieldBinding: 'document.bank_statement_pdf',
    isSensitive: false,
    requiresHandoff: false,
  },

  // ── STAGE 5: ASSESSMENT GENERATION & CUSTOMER APPROVAL ────────
  {
    stepId: 'lirs_click_next_review',
    order: 11,
    title: 'Proceed to Assessment Calculation Review',
    description: 'Advance to LIRS tax assessment computation screen',
    action: 'AI_CLICK',
    selector: 'button:has-text("Next"), button:has-text("Save Draft")',
    isSensitive: false,
    requiresHandoff: false,
  },
  {
    stepId: 'lirs_final_customer_approval',
    order: 12,
    title: 'Customer Review & Submission Authorization',
    description: 'Mandatory customer review of final assessment notice before bill generation',
    action: 'CUSTOMER_APPROVAL',
    selector: 'button:has-text("Submit"), button:has-text("Generate")',
    isSensitive: false,
    requiresHandoff: true,
    handoffType: 'APPROVAL',
    promptMessage: 'Please review your LIRS tax computation and declared income. Click "Approve" to finalize submission and generate your e-Tax Assessment Bill.',
  },
];
