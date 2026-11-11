export type PitStateCode = 'LAGOS' | 'KANO' | 'FCT' | 'RIVERS';
export type PitAuthorityCode = 'LIRS' | 'KIRS' | 'FCT-IRS' | 'RIRS';
export type TaxpayerClassification = 'individual' | 'business_name';

export interface PitReturnTemplateSpec {
  taxYears: string;
  formName: string;
  description: string;
  portalPath: string;
}

export interface PitJurisdictionConfig {
  stateCode: PitStateCode;
  stateLabel: string;
  stateAliases: string[];
  authorityCode: PitAuthorityCode;
  authorityName: string;
  officialWebsite: string;
  portalUrl: string;
  portalName: string;
  supportContact: {
    phone?: string;
    email?: string;
    address?: string;
  };
  statutoryDeadline: string;
  individualTaxIdRequirement: {
    idName: string;
    idFormatHint: string;
    registrationProcess: string[];
  };
  businessNameRegistrationRequirement: {
    overview: string;
    registrationSteps: string[];
    requiredCacDocs: string[];
  };
  requiredPersonalInfo: string[];
  requiredIncomeInfo: {
    individual: string[];
    business_name: string[];
  };
  requiredSupportingDocuments: {
    individual: string[];
    business_name: string[];
  };
  returnTemplates: PitReturnTemplateSpec[];
  taxCalculationNotes: string[];
  filingProcedureSteps: string[];
  acknowledgementProcedure: string[];
  paymentAndTccProcedure: {
    paymentChannels: string[];
    tccRequirements: string[];
  };
  adminStatus: {
    registrationStatus: 'configured' | 'partial';
    portalAvailability: 'online' | 'degraded' | 'offline';
    apiAvailable: boolean;
    apiInvestigationSummary: string;
    integrationStatus: 'self_filing_guided' | 'api_integrated' | 'pending_approval';
    filingTemplateAvailable: boolean;
    missingRequirements: string[];
    lastVerificationDate: string;
  };
}

export const PIT_JURISDICTIONS: Record<PitStateCode, PitJurisdictionConfig> = {
  LAGOS: {
    stateCode: 'LAGOS',
    stateLabel: 'Lagos State',
    stateAliases: ['Lagos', 'Lagos State', 'Ikeja', 'Lekki', 'Victoria Island'],
    authorityCode: 'LIRS',
    authorityName: 'Lagos State Internal Revenue Service (LIRS)',
    officialWebsite: 'https://lirs.gov.ng',
    portalUrl: 'https://etax.lirs.net',
    portalName: 'LIRS eTax Portal',
    supportContact: {
      phone: '070022555477',
      address: 'The Good Samaritan Building, Central Business District, Alausa, Ikeja, Lagos',
    },
    statutoryDeadline: 'March 31 of each assessment year (covering Jan 1 – Dec 31 of the preceding income year)',
    individualTaxIdRequirement: {
      idName: 'LIRS Payer ID',
      idFormatHint: 'Starts with "N-" for individuals (distinct from JTB TIN)',
      registrationProcess: [
        'Visit https://etax.lirs.net and choose "Create New Taxpayer ID" / Individual Sign Up.',
        'Provide your BVN or NIN alongside your date of birth, phone number, email, and Lagos residential address.',
        'Receive your LIRS Payer ID (N-prefixed) and set your eTax login password.',
      ],
    },
    businessNameRegistrationRequirement: {
      overview:
        'A sole proprietor or owner of a CAC-registered Business Name resident in Lagos files Direct Assessment under their Individual LIRS Payer ID (not CIT).',
      registrationSteps: [
        'Register or sign in to https://etax.lirs.net with your Individual LIRS Payer ID.',
        'Update taxpayer profile details to reflect self-employment / trade / business-name activity and business address.',
        'File Direct Assessment via Annual Return Form A rather than corporate income tax.',
      ],
      requiredCacDocs: ['CAC Business Name Registration Certificate (BN)'],
    },
    requiredPersonalInfo: [
      'LIRS Payer ID (N-prefixed)',
      'BVN or NIN (for identity verification on eTax)',
      'Full legal name & date of birth',
      'Residential address in Lagos State & LGA/tax station',
      'Email address, phone number & profile photo',
      'Marital status / dependants declaration where requested on Form A',
    ],
    requiredIncomeInfo: {
      individual: [
        'Gross employment income (salary, bonuses, allowances, benefits-in-kind)',
        'Employer PAYE already deducted & Employer Filed Returns reference',
        'Rental income, dividends, interest, or side-hustle/freelance earnings',
        'Rent paid (for 2026+ NTA 2025 Rent Relief) or CRA reliefs (for <= 2025 PITA)',
        'Statutory deductions: Pension (PFA), NHF, NHIS, Life Assurance premiums',
      ],
      business_name: [
        'Gross business turnover / sales and service revenue for the year',
        'Wholly, reasonably, exclusively and necessarily incurred business expenses',
        'Net business profit / loss statement and owner drawings',
        'Any secondary employment or investment income',
        'Statutory deductions & eligible reliefs (Pension, NHF, Life Assurance, Rent Relief 2026+)',
      ],
    },
    requiredSupportingDocuments: {
      individual: [
        'LIRS Payer ID details',
        'Annual payslips or employer annual salary summary',
        'Employer-filed returns reference (verified in eTax "Employer Filed Returns" tab)',
        'PFA pension contribution statement, NHF/NHIS & life assurance premium receipts',
        'Official rent receipts / tenancy agreement (required for 2026+ NTA Rent Relief claim)',
      ],
      business_name: [
        'LIRS Payer ID & CAC Business Name Registration Certificate',
        'Statement of Income & Expenditure / Audited Accounts (or Business P&L)',
        'Business bank account statements for the income year',
        'Supporting invoices, expense receipts & evidence of statutory deductions/rent paid',
      ],
    },
    returnTemplates: [
      {
        taxYears: '2025 & Prior (PITA Regime) / 2026+ (NTA 2025 Regime)',
        formName: 'LIRS Form A — Annual Income Tax Return & Claims for Allowances/Reliefs',
        description:
          'Mandatory electronic Form A submitted via eTax for both salaried PAYE employees and Direct Assessment / Business Name owners.',
        portalPath: 'eTax Dashboard -> Returns -> My Tax Returns -> File Returns Here',
      },
    ],
    taxCalculationNotes: [
      'Statutory Nigerian PIT rates apply (PITA bands + CRA for tax years <= 2025; NTA 2025 bands + ₦800k tax-free band + Rent Relief up to ₦500k for tax years >= 2026).',
      'LIRS eTax provides a built-in portal tax assessment computation once Form A figures are entered.',
      'Salaried employees must still file Form A annually by March 31 even when PAYE was deducted monthly.',
    ],
    filingProcedureSteps: [
      'Sign in at https://etax.lirs.net using your LIRS Payer ID ("N-...") and password.',
      'Confirm your profile address, contact info, and (if salaried) check "Employer Filed Returns" for employer-reported figures.',
      'Open "Returns" -> "My Tax Returns" -> "File Returns Here" and choose the assessment year.',
      'Transcribe the exact income, business profit, and deduction figures from your ROVA Filing Package into Form A.',
      'Upload required schedules/financial statements and supporting relief receipts, review carefully, and click "File Returns".',
      'Download the eTax filing acknowledgement / assessment notice and upload it back into ROVA.',
    ],
    acknowledgementProcedure: [
      'Capture the LIRS eTax Form A submission confirmation / Assessment Reference Number generated upon clicking "File Returns".',
      'Download the PDF assessment notice / filing confirmation receipt from eTax.',
      'Upload the acknowledgement PDF/screenshot in ROVA Step 4 to update your PIT filing record.',
    ],
    paymentAndTccProcedure: {
      paymentChannels: [
        'Generate Bill / Payment Reference on LIRS eTax (EBS-RCM payment integration).',
        'Pay via approved bank branches or online banking/card channels linked to the eTax Assessment Bill.',
      ],
      tccRequirements: [
        'LIRS generally requires 3 consecutive years of filed Form A returns and zero outstanding tax liabilities.',
        'Once liabilities are cleared on eTax, generate and download your electronic Tax Clearance Certificate (e-TCC) directly from your eTax dashboard.',
      ],
    },
    adminStatus: {
      registrationStatus: 'configured',
      portalAvailability: 'online',
      apiAvailable: false,
      apiInvestigationSummary:
        'No open self-service public filing API exists. Institutional/EBS-RCM partner integrations require formal LIRS approval via LIRS helpdesk (070022555477).',
      integrationStatus: 'self_filing_guided',
      filingTemplateAvailable: true,
      missingRequirements: [
        'Official LIRS institutional third-party partner API approval (not publicly open)',
        'Employer-filed PAYE API feed (user cross-checks Employer Filed Returns manually in eTax)',
      ],
      lastVerificationDate: '2026-11-11',
    },
  },

  KANO: {
    stateCode: 'KANO',
    stateLabel: 'Kano State',
    stateAliases: ['Kano', 'Kano State'],
    authorityCode: 'KIRS',
    authorityName: 'Kano State Internal Revenue Service (KIRS)',
    officialWebsite: 'https://kirs.gov.ng',
    portalUrl: 'https://etax.kirs.gov.ng',
    portalName: 'KIRS e-Tax Portal',
    supportContact: {
      email: 'info@kirs.gov.ng',
      address: 'Tax House, Zoo Road, Kano (also Bank Road Head Office)',
    },
    statutoryDeadline: 'March 31 of each assessment year (annual Form A Self-Assessment deadline)',
    individualTaxIdRequirement: {
      idName: 'KIRS Taxpayer ID / TIN',
      idFormatHint: 'Registered via KIRS e-Tax profile / JTB TIN',
      registrationProcess: [
        'Access https://etax.kirs.gov.ng (or visit a KIRS tax office) to register and activate your KIRS taxpayer profile.',
        'Provide your NIN/BVN, valid ID, phone number, email, and Kano residential/business address to obtain or link your TIN.',
      ],
    },
    businessNameRegistrationRequirement: {
      overview:
        'Traders, consultants, artisans, landlords, and CAC-registered Business Name owners in Kano fall under KIRS Direct Assessment (not CIT).',
      registrationSteps: [
        'Register/link your TIN and enterprise/business profile on https://etax.kirs.gov.ng.',
        'Declare annual business profits and submit Self-Assessment Form A under Direct Assessment.',
      ],
      requiredCacDocs: ['CAC Business Name Registration Certificate (if registered)'],
    },
    requiredPersonalInfo: [
      'TIN / KIRS Taxpayer ID',
      'Full legal name & valid means of identification (NIN/National ID, Voter Card, or Passport)',
      'Residential address and business/shop location in Kano State',
      'Phone number & email address',
    ],
    requiredIncomeInfo: {
      individual: [
        'Total annual employment income, allowances, and PAYE deducted',
        'Property/landlord rental income or supplementary income',
        'Statutory deductions (Pension, NHF, NHIS, Life Assurance) & applicable rent/CRA reliefs',
      ],
      business_name: [
        'Gross annual trade/business income and revenue',
        'Allowable business operating expenses and net taxable profit',
        'Development Levy & previous tax assessment / payment references',
        'Statutory deductions & eligible personal reliefs',
      ],
    },
    requiredSupportingDocuments: {
      individual: [
        'TIN / KIRS taxpayer registration details',
        'Valid means of identification',
        'Annual payslips or employer income statement',
        'Evidence of previous tax payments / e-payment receipts & pension/NHF/rent proofs',
      ],
      business_name: [
        'Completed Tax Form A (Self-Assessment Form)',
        'TIN & valid means of identification',
        'Financial statements or records of income (invoices, ledger summaries, or business bank statements)',
        'Evidence of previous tax payments / e-payment receipts & Development Levy receipt',
      ],
    },
    returnTemplates: [
      {
        taxYears: '2025 & Prior / 2026+ Annual Assessment',
        formName: 'KIRS Self-Assessment Tax Form A (Direct Assessment / Annual Returns)',
        description:
          'Annual income declaration covering all taxable sources under PITA/NTA 2025 for individuals and direct assessment business-name owners.',
        portalPath: 'KIRS e-Tax Portal (etax.kirs.gov.ng) -> Self-Assessment / Annual Returns',
      },
    ],
    taxCalculationNotes: [
      'Taxable income uses statutory Nigerian PIT bands (PITA for <= 2025; NTA 2025 for >= 2026).',
      'KIRS requires Development Levy receipt and settlement of assessed liabilities alongside annual Form A returns for full clearance.',
    ],
    filingProcedureSteps: [
      'Log in or verify your taxpayer profile at https://etax.kirs.gov.ng (or KIRS office at Tax House, Zoo Road, Kano).',
      'Prepare your Form A income and expense schedule using your exported ROVA Filing Package.',
      'Submit Self-Assessment Form A and supporting income records / receipts through authorized KIRS channels.',
      'Generate your official KIRS payment bill/receipt and complete payment only via authorized KIRS gateways.',
      'Save your official KIRS submission/payment receipt and upload it into ROVA.',
    ],
    acknowledgementProcedure: [
      'Obtain the KIRS e-Tax submission acknowledgement / e-payment receipt reference.',
      'Upload the acknowledgement document or payment receipt in ROVA Step 4 for compliance tracking.',
    ],
    paymentAndTccProcedure: {
      paymentChannels: [
        'Authorized KIRS e-Tax payment gateways and designated collecting banks only.',
      ],
      tccRequirements: [
        'Annual Form A returns properly filed for the immediate past 3 consecutive years.',
        'All direct assessments, income taxes, and Development Levy fully paid with zero arrears.',
        'Verify receipts and TCC status on https://etax.kirs.gov.ng or via KIRS Head Office.',
      ],
    },
    adminStatus: {
      registrationStatus: 'configured',
      portalAvailability: 'online',
      apiAvailable: false,
      apiInvestigationSummary:
        'No open public third-party filing API exists. Institutional ICT/E-Tax integrations require direct approval via info@kirs.gov.ng.',
      integrationStatus: 'self_filing_guided',
      filingTemplateAvailable: true,
      missingRequirements: [
        'Official KIRS ICT institutional API partnership (not publicly available)',
        'Exact Kano State local Development Levy schedule for direct-assessment individuals (verify on KIRS bill notice)',
      ],
      lastVerificationDate: '2026-11-11',
    },
  },

  FCT: {
    stateCode: 'FCT',
    stateLabel: 'Federal Capital Territory (Abuja)',
    stateAliases: ['FCT', 'Abuja', 'Abuja/FCT', 'FCT-IRS', 'Federal Capital Territory'],
    authorityCode: 'FCT-IRS',
    authorityName: 'Federal Capital Territory Internal Revenue Service (FCT-IRS)',
    officialWebsite: 'https://fctirs.gov.ng',
    portalUrl: 'https://taxporta.fctirs.gov.ng',
    portalName: 'FCT-IRS Self-Service Portal (TaxPorta)',
    supportContact: {
      phone: '0700 220 0002',
      email: 'contactus@fctirs.gov.ng',
      address: 'FCT-IRS Headquarters, Abuja, Federal Capital Territory',
    },
    statutoryDeadline: 'March 31 of each assessment year (subject to any published FCT-IRS extension notice)',
    individualTaxIdRequirement: {
      idName: 'JTB TIN / FCT-IRS Payer ID',
      idFormatHint: 'JTB TIN integrated with NIN / BVN',
      registrationProcess: [
        'Register for an Individual TIN via the JTB TIN portal linked from https://fctirs.gov.ng using your NIN or BVN.',
        'Use the TIN lookup/verification tool on https://fctirs.gov.ng if you already hold a JTB TIN.',
        'Log in to https://taxporta.fctirs.gov.ng using your TIN / FCT-IRS Payer ID.',
      ],
    },
    businessNameRegistrationRequirement: {
      overview:
        'Registered Business Names (Enterprises) and sole proprietors operating in Abuja fall under Direct Assessment with FCT-IRS (LLCs go to NRS).',
      registrationSteps: [
        'Obtain/verify your Individual/Business Name TIN via JTB & FCT-IRS portal.',
        'Access https://taxporta.fctirs.gov.ng under Direct Assessment and upload your CAC Business Name Certificate with Form A.',
      ],
      requiredCacDocs: ['CAC Business Name Registration Certificate (BN)'],
    },
    requiredPersonalInfo: [
      'JTB TIN / FCT-IRS Payer ID',
      'Full legal name & valid ID (National ID/NIN slip, Voter Card, or International Passport)',
      'Proof of FCT residential or business address & designated FCT-IRS tax office',
      'Email address & phone number',
    ],
    requiredIncomeInfo: {
      individual: [
        'Total annual employment income, allowances, and PAYE deducted',
        'Other taxable income earned during Jan 1 – Dec 31',
        'Statutory deductions (Pension, NHF, NHIS, Life Assurance) & rent receipts (2026+)',
      ],
      business_name: [
        'Annual business revenue / turnover and statement of income & expenditure (P&L)',
        'Allowable business expenses and net business profit',
        'Bank statement inflows/outflows summary & previous 3-year assessment notices if applying for TCC',
        'Statutory deductions & rent relief (2026+) / CRA (<= 2025)',
      ],
    },
    requiredSupportingDocuments: {
      individual: [
        'Valid TIN linked to FCT-IRS',
        'Valid means of ID & proof of Abuja residential address',
        'Employment salary schedule / payslips & deduction receipts (Pension, NHF, Rent)',
        'Completed Form A via TaxPorta',
      ],
      business_name: [
        'Completed Form A via TaxPorta',
        'CAC Business Name Registration Certificate',
        'Audited financial statements or Statement of Income & Expenditure / P&L account',
        'Business & relevant personal bank statements for the income year',
        'Written application for TCC (addressed to Tax Controller or via portal) & prior 3 years tax payment receipts (if requesting TCC)',
      ],
    },
    returnTemplates: [
      {
        taxYears: '2025 & Prior / 2026+ Annual Return',
        formName: 'FCT-IRS Form A — Annual Income Tax Return (Direct Assessment / Individual)',
        description:
          'Mandatory electronic return on TaxPorta generating a Returns Reference Number upon selecting assessment year.',
        portalPath: 'TaxPorta -> Tax Returns -> File Returns -> File a New Return',
      },
    ],
    taxCalculationNotes: [
      'Statutory Nigerian PIT rules apply based on tax year (PITA <= 2025 vs NTA 2025 >= 2026).',
      'Failure to file by March 31 (unless extended by FCT-IRS) attracts penalties, interest, and Best of Judgment (BOJ) assessment.',
    ],
    filingProcedureSteps: [
      'Log in at https://taxporta.fctirs.gov.ng using your TIN / FCT-IRS Payer ID.',
      'Navigate to "Tax Returns" -> "File Returns" -> "File a New Return".',
      'Input the assessment date/year to generate your FCT-IRS Returns Reference Number.',
      'Enter your declared income, business profit, and statutory deductions from your ROVA Filing Package and upload supporting PDFs.',
      'Review all declarations, submit the return, and upload the Returns Reference / acknowledgement into ROVA.',
    ],
    acknowledgementProcedure: [
      'Save the FCT-IRS Returns Reference Number and downloadable submission receipt from TaxPorta.',
      'Upload the TaxPorta acknowledgement in ROVA Step 4 to record your submission.',
    ],
    paymentAndTccProcedure: {
      paymentChannels: [
        'Electronic assessment payment via https://taxporta.fctirs.gov.ng or designated FCT-IRS revenue banks.',
      ],
      tccRequirements: [
        'Completed Form A filings & evidence of full tax payment for the preceding 3 years.',
        'Written or digital TCC application to your designated FCT-IRS tax office.',
        'E-TCC is issued with a QR code verifiable directly on https://fctirs.gov.ng.',
      ],
    },
    adminStatus: {
      registrationStatus: 'configured',
      portalAvailability: 'online',
      apiAvailable: false,
      apiInvestigationSummary:
        'No open public filing API exists on taxporta.fctirs.gov.ng. Institutional API requests require contacting FCT-IRS ICT via contactus@fctirs.gov.ng or 0700 220 0002.',
      integrationStatus: 'self_filing_guided',
      filingTemplateAvailable: true,
      missingRequirements: [
        'FCT-IRS institutional third-party API access credentials (not publicly available)',
      ],
      lastVerificationDate: '2026-11-11',
    },
  },

  RIVERS: {
    stateCode: 'RIVERS',
    stateLabel: 'Rivers State',
    stateAliases: ['Rivers', 'Rivers State', 'Port Harcourt', 'PH'],
    authorityCode: 'RIRS',
    authorityName: 'Rivers State Internal Revenue Service (RIRS)',
    officialWebsite: 'https://riversbirs.gov.ng',
    portalUrl: 'https://rivtamis.riversbirs.gov.ng',
    portalName: 'RIRS RIVTAMIS Portal',
    supportContact: {
      phone: '08165019109 / 09016221850',
      email: 'info@riversbirs.gov.ng',
      address: 'Rivers State Internal Revenue Service Headquarters, Port Harcourt, Rivers State',
    },
    statutoryDeadline: 'March 31 of each assessment year (PITA / NTA statutory annual return deadline)',
    individualTaxIdRequirement: {
      idName: 'RIVTIN (Rivers State Tax Identification Number)',
      idFormatHint: 'Generated & validated on RIVTAMIS portal',
      registrationProcess: [
        'Go to https://rivtamis.riversbirs.gov.ng and register as an Individual Taxpayer to obtain your RIVTIN.',
        'Verify your individual profile using your National Identification Number (NIN), phone number, and email.',
      ],
    },
    businessNameRegistrationRequirement: {
      overview:
        'Self-employed professionals, sole traders, and CAC-registered Business Name owners resident in Rivers State register for Direct Assessment on RIVTAMIS.',
      registrationSteps: [
        'Ensure your RIVTIN profile is NIN-verified on https://rivtamis.riversbirs.gov.ng.',
        'Select your preferred RIRS tax station in Rivers State and file Direct Assessment Form A with income statements.',
      ],
      requiredCacDocs: ['CAC Business Name Registration Certificate / Enterprise Registration (if applicable)'],
    },
    requiredPersonalInfo: [
      'RIVTIN (Rivers State Tax Identification Number)',
      'Verified NIN (National Identification Number)',
      'Valid ID (NIN slip, International Passport, Driver Licence, or Voter Card)',
      'Rivers State residential / business address & preferred RIRS tax station',
      'Email address & phone number',
    ],
    requiredIncomeInfo: {
      individual: [
        'Gross annual salary / employment emoluments and PAYE remitted',
        'Other income sources earned during the assessment year',
        'Statutory deductions (Pension, NHF, NHIS, Life Assurance) & rent receipts (2026+)',
      ],
      business_name: [
        'Annual trade, business, profession, or vocation gross revenue',
        'Allowable business expenses & statement of income/profits',
        'Prior year tax assessment notices / payment proof (for 3-year TCC track)',
        'Statutory deductions & eligible personal reliefs',
      ],
    },
    requiredSupportingDocuments: {
      individual: [
        'Active NIN-verified RIVTIN',
        'Valid proof of identity (NIN slip, Passport, Driver Licence, or Voter Card)',
        'Annual salary/PAYE summary & relief receipts (compressed PDF format split by year where requested)',
      ],
      business_name: [
        'Completed electronic Form A on RIVTAMIS',
        'Proof of identity (NIN / ID) & active RIVTIN',
        'Statement of income/profits (or audited accounts / financial statements for Business Name)',
        'Business transaction records, invoices, or receipts',
        'Previous assessment notices & RIRS payment receipts / e-ticket receipts (compressed PDF format)',
      ],
    },
    returnTemplates: [
      {
        taxYears: '2025 & Prior / 2026+ Direct Assessment',
        formName: 'RIRS Form A (Electronic Direct Assessment / Annual Return on RIVTAMIS)',
        description:
          'Digital Form A and Direct Assessment workflow on RIVTAMIS with PDF upload support for supporting schedules.',
        portalPath: 'RIVTAMIS -> Dashboard -> Tax Returns / TCC -> Direct Assessment (Select Tax Station & Year)',
      },
    ],
    taxCalculationNotes: [
      'Statutory Nigerian PIT rates apply by tax year (PITA for <= 2025; NTA 2025 for >= 2026).',
      'RIVTAMIS includes a built-in Tax Calculator for Direct Assessment / PAYE / WHT verification.',
      'Supporting PDFs uploaded to RIVTAMIS must adhere to portal file-size limits and are best split cleanly by tax year.',
    ],
    filingProcedureSteps: [
      'Sign in at https://rivtamis.riversbirs.gov.ng using your Email, Phone Number, or RIVTIN/TAXID.',
      'Select your assigned RIRS Tax Station and target tax year(s) under Direct Assessment / Form A.',
      'Enter your declared income, business profit, and reliefs from your ROVA Filing Package into Form A.',
      'Upload compressed PDF scans of your financial statements, ID, and payment proofs.',
      'Review and submit your return, track assessment approval, settle any due bill, and upload your RIVTAMIS receipt into ROVA.',
    ],
    acknowledgementProcedure: [
      'Save the RIVTAMIS Direct Assessment submission receipt / e-ticket payment confirmation.',
      'Upload the acknowledgement PDF or screenshot into ROVA Step 4 to complete your compliance log.',
    ],
    paymentAndTccProcedure: {
      paymentChannels: [
        'RIVTAMIS e-ticket assessment billing and RIRS-approved payment channels.',
      ],
      tccRequirements: [
        'Active NIN-verified RIVTIN and 3 years of Direct Assessment Form A + supporting PDFs.',
        'RIRS issued payment receipts / e-ticket receipts settling all assessed liabilities.',
        'Online TCC verification and authentication available directly on https://rivtamis.riversbirs.gov.ng.',
      ],
    },
    adminStatus: {
      registrationStatus: 'configured',
      portalAvailability: 'online',
      apiAvailable: false,
      apiInvestigationSummary:
        'No open self-service third-party filing API exists on RIVTAMIS. Institutional API inquiries require contacting info@riversbirs.gov.ng.',
      integrationStatus: 'self_filing_guided',
      filingTemplateAvailable: true,
      missingRequirements: [
        'Official RIRS institutional API approval (not publicly open)',
        'Exact per-upload RIVTAMIS PDF megabyte limit should be checked inside active portal upload form',
      ],
      lastVerificationDate: '2026-11-11',
    },
  },
};

export const PIT_JURISDICTION_LIST: PitJurisdictionConfig[] = [
  PIT_JURISDICTIONS.LAGOS,
  PIT_JURISDICTIONS.KANO,
  PIT_JURISDICTIONS.FCT,
  PIT_JURISDICTIONS.RIVERS,
];

export function resolvePitJurisdiction(input: string): PitJurisdictionConfig | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  for (const config of PIT_JURISDICTION_LIST) {
    if (
      config.stateCode.toLowerCase() === normalized ||
      config.authorityCode.toLowerCase() === normalized ||
      config.stateLabel.toLowerCase() === normalized ||
      config.stateAliases.some((a) => a.toLowerCase() === normalized)
    ) {
      return config;
    }
  }
  return null;
}
