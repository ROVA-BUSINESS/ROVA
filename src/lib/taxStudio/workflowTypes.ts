/**
 * Automation Workflow Engine Types & Pre-configured Definitions
 * Supports LIRS PIT, Kano IRS, Rivers State BIR, FCT-IRS, and Federal CIT (NRS/TaxPro-Max)
 */

export type ElementActionType =
  | 'AI_FILL'
  | 'CUSTOMER_FILL'
  | 'AI_CLICK'
  | 'CUSTOMER_APPROVAL'
  | 'SKIP'
  | 'ASK_CUSTOMER'
  | 'PAUSE';

export interface WorkflowStep {
  stepId: string;
  order: number;
  title: string;
  description: string;
  action: ElementActionType;
  selector: string;
  fieldBinding?: string;
  isSensitive: boolean;
  requiresHandoff: boolean;
  handoffType?: 'OTP' | 'PASSWORD' | 'BVN' | 'NIN' | 'DOCUMENT' | 'APPROVAL';
  promptMessage?: string;
  expectedUrlPattern?: string;
}

export interface TaxAuthorityWorkflowConfig {
  code: string;
  name: string;
  portalUrl: string;
  taxType: 'PIT' | 'CIT';
  description: string;
  steps: WorkflowStep[];
}

import { LIRS_OFFICIAL_FILING_STEPS } from './lirsFilingConfig';

export const OFFICIAL_TAX_AUTHORITIES: TaxAuthorityWorkflowConfig[] = [
  {
    code: 'LIRS',
    name: 'Lagos State Internal Revenue Service (LIRS)',
    portalUrl: 'https://etax.lirs.net/',
    taxType: 'PIT',
    description: 'Personal Income Tax & Direct Assessment filing for Lagos State residents and enterprise owners.',
    steps: LIRS_OFFICIAL_FILING_STEPS,
  },
  {
    code: 'NRS_CIT',
    name: 'Federal Company Income Tax (NRS / TaxPro-Max)',
    portalUrl: 'https://selfservice.nrs.gov.ng/',
    taxType: 'CIT',
    description: 'Federal Company Income Tax returns administered by the Federal Tax Authority (distinct from CAC).',
    steps: [
      {
        stepId: 'nrs_nav_self_filing',
        order: 1,
        title: 'Navigate to Self-Filing Portal',
        description: 'Open official NRS self-service dashboard',
        action: 'AI_CLICK',
        selector: 'text=/Self[ -]Filing/i',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'nrs_select_cit',
        order: 2,
        title: 'Select Corporate Income Tax (CIT)',
        description: 'Choose CIT filing category',
        action: 'AI_CLICK',
        selector: 'text=/Corporate Income Tax|CIT/i',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'nrs_fill_turnover',
        order: 3,
        title: 'Fill Company Turnover',
        description: 'Populate verified corporate turnover from Rova Profit & Loss',
        action: 'AI_FILL',
        selector: 'input[name*="turnover"], input[id*="turnover"]',
        fieldBinding: 'computation.turnover',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'nrs_fill_assessable_profit',
        order: 4,
        title: 'Fill Assessable Profit',
        description: 'Populate adjusted assessable profit after allowable deductions',
        action: 'AI_FILL',
        selector: 'input[name*="assessable_profit"], input[id*="assessableProfit"]',
        fieldBinding: 'computation.assessable_profit',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'nrs_attach_schedule',
        order: 5,
        title: 'Attach Statutory CIT Schedule',
        description: 'Attach the Rova-generated 2026_CIT_ROVA_filled.xlsx workbook',
        action: 'AI_FILL',
        selector: 'input[type="file"]',
        fieldBinding: 'document.cit_excel_package',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'nrs_final_approval',
        order: 6,
        title: 'Customer Final CIT Approval',
        description: 'Customer approves assessment generation before submission',
        action: 'CUSTOMER_APPROVAL',
        selector: 'button:has-text("Submit Return"), button:has-text("Generate Assessment")',
        isSensitive: false,
        requiresHandoff: true,
        handoffType: 'APPROVAL',
        promptMessage: 'Please review the CIT computation and attached schedules. Click "Approve" to file.',
      },
    ],
  },
  {
    code: 'KANO_IRS',
    name: 'Kano State Internal Revenue Service',
    portalUrl: 'https://kanoirs.gov.ng/',
    taxType: 'PIT',
    description: 'Personal Income Tax & self-assessment filing for Kano residents.',
    steps: [
      {
        stepId: 'kano_nav_portal',
        order: 1,
        title: 'Navigate to Kano IRS eBIRs',
        description: 'Open Kano revenue portal',
        action: 'AI_CLICK',
        selector: 'a[href*="ebirs"], a:has-text("eServices")',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'kano_fill_tin',
        order: 2,
        title: 'Enter Tax Identification Number',
        description: 'Populate Kano State Taxpayer TIN',
        action: 'AI_FILL',
        selector: 'input[name*="tin"]',
        fieldBinding: 'taxpayer.tin',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'kano_final_approval',
        order: 3,
        title: 'Customer Approval',
        description: 'Approve assessment request',
        action: 'CUSTOMER_APPROVAL',
        selector: 'button:has-text("Submit")',
        isSensitive: false,
        requiresHandoff: true,
        handoffType: 'APPROVAL',
      },
    ],
  },
  {
    code: 'RIVERS_BIR',
    name: 'Rivers State Board of Internal Revenue',
    portalUrl: 'https://riversbirs.gov.ng/',
    taxType: 'PIT',
    description: 'Personal Income Tax & RIV-TIN direct assessment for Rivers State residents.',
    steps: [
      {
        stepId: 'rivers_nav_portal',
        order: 1,
        title: 'Open Rivers Revenue Portal',
        description: 'Navigate to Rivers State tax portal',
        action: 'AI_CLICK',
        selector: 'a:has-text("e-Services"), a[href*="portal"]',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'rivers_fill_riv_tin',
        order: 2,
        title: 'Enter RIV-TIN',
        description: 'Fill taxpayer Rivers State TIN',
        action: 'AI_FILL',
        selector: 'input[name*="riv_tin"], input[placeholder*="RIV-TIN"]',
        fieldBinding: 'taxpayer.riv_tin',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'rivers_final_approval',
        order: 3,
        title: 'Customer Review & Approval',
        description: 'Approve assessment notice generation',
        action: 'CUSTOMER_APPROVAL',
        selector: 'button:has-text("Submit")',
        isSensitive: false,
        requiresHandoff: true,
        handoffType: 'APPROVAL',
      },
    ],
  },
  {
    code: 'FCT_IRS',
    name: 'Federal Capital Territory Internal Revenue Service (FCT-IRS)',
    portalUrl: 'https://fctirs.gov.ng/',
    taxType: 'PIT',
    description: 'Personal Income Tax for residents of Abuja FCT.',
    steps: [
      {
        stepId: 'fct_nav_portal',
        order: 1,
        title: 'Open FCT-IRS Portal',
        description: 'Navigate to Abuja tax portal',
        action: 'AI_CLICK',
        selector: 'a:has-text("Portal"), a[href*="selfservice"]',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'fct_fill_tin',
        order: 2,
        title: 'Enter FCT Taxpayer ID',
        description: 'Populate FCT Taxpayer TIN',
        action: 'AI_FILL',
        selector: 'input[name*="tin"], input[placeholder*="TIN"]',
        fieldBinding: 'taxpayer.tin',
        isSensitive: false,
        requiresHandoff: false,
      },
      {
        stepId: 'fct_final_approval',
        order: 3,
        title: 'Customer Review & Submission',
        description: 'Customer approves filing declaration',
        action: 'CUSTOMER_APPROVAL',
        selector: 'button:has-text("Submit")',
        isSensitive: false,
        requiresHandoff: true,
        handoffType: 'APPROVAL',
      },
    ],
  },
];
