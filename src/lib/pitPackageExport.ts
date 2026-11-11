import { downloadExcelWorkbook, printStatementHTML } from './export';
import type { PitJurisdictionConfig } from '../config/pitJurisdictions';
import type {
  BusinessDetailsInput,
  BusinessProfitReconciliation,
  EmploymentDetailsInput,
  PitComputationInput,
  PitComputationResult,
} from './pitEngine';

export interface PitPackageExportOptions {
  jurisdiction: PitJurisdictionConfig;
  input: PitComputationInput;
  result: PitComputationResult;
  taxpayerProfile: {
    fullName: string;
    dateOfBirth?: string;
    nin?: string;
    lga?: string;
    businessName?: string;
    cacNumber?: string;
    taxId: string;
    residentialAddress: string;
    email: string;
    phone: string;
  };
  employmentDetails?: Partial<EmploymentDetailsInput>;
  businessDetails?: Partial<BusinessDetailsInput>;
  gapFlags?: string[];
  complianceAdvisories?: string[];
  attestedByTaxpayer?: boolean;
}

const fmtNaira = (n: number) =>
  `₦${(Number(n) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function downloadPitFilingWorkbook(opts: PitPackageExportOptions) {
  const {
    jurisdiction,
    input,
    result,
    taxpayerProfile,
    employmentDetails,
    businessDetails,
    gapFlags = [],
    complianceAdvisories = [],
    attestedByTaxpayer = false,
  } = opts;
  const isBusinessName = input.classification === 'business_name';
  const bizRec: BusinessProfitReconciliation = result.businessReconciliation;

  const profileRows: (string | number)[][] = [
    ['ROVA PERSONAL INCOME TAX SELF-FILING PACKAGE', ''],
    ['Legal Authority Notice', 'Section 13 Nigeria Tax Administration Act (NTAA) 2025 — Income from all sources, personal relief & tax computation'],
    ['Generated At', new Date().toISOString()],
    ['State of Residence', jurisdiction.stateLabel],
    ['Local Government Area (LGA)', taxpayerProfile.lga || 'N/A'],
    ['Tax Authority', jurisdiction.authorityName],
    ['Official Portal', jurisdiction.portalUrl],
    ['Applicable Form', result.preparedReturnSummary.formName],
    ['Statutory Deadline', result.preparedReturnSummary.statutoryDeadline],
    ['Tax Year', result.taxYear],
    ['Governing Legislation', result.regimeLabel],
    ['Taxpayer Journey', isBusinessName ? 'Individual Owning CAC-Registered Business Name' : 'Individual Taxpayer'],
    ['Full Legal Name', taxpayerProfile.fullName || 'N/A'],
    ['Date of Birth', taxpayerProfile.dateOfBirth || 'N/A'],
    ['NIN', taxpayerProfile.nin || 'N/A'],
    [jurisdiction.individualTaxIdRequirement.idName, taxpayerProfile.taxId || 'Pending Registration (NRS / State IRS)'],
    ['Residential Address', taxpayerProfile.residentialAddress || 'N/A'],
    ['Email', taxpayerProfile.email || 'N/A'],
    ['Phone', taxpayerProfile.phone || 'N/A'],
    ...(isBusinessName
      ? [
          ['', ''],
          ['BUSINESS NAME DETAILS', ''],
          ['Registered Business Name', businessDetails?.registeredBusinessName || taxpayerProfile.businessName || 'N/A'],
          ['CAC Registration Number', businessDetails?.cacRegistrationNumber || taxpayerProfile.cacNumber || 'N/A'],
          ['Business Tax ID', businessDetails?.businessTaxId || 'Same as proprietor / Pending'],
          ['Date of Registration', businessDetails?.dateOfRegistration || 'N/A'],
          ['Business Address', businessDetails?.businessAddress || 'N/A'],
          ['State of Operation', businessDetails?.stateOfOperation || jurisdiction.stateLabel],
          ['Nature of Business', businessDetails?.natureOfBusiness || 'N/A'],
          ['Currently Operating', businessDetails?.currentlyOperating === false ? 'No' : 'Yes'],
        ]
      : [
          ['', ''],
          ['EMPLOYER DETAILS (IF EMPLOYED)', ''],
          ['Employer Name', employmentDetails?.employerName || 'N/A'],
          ['Employer Address', employmentDetails?.employerAddress || 'N/A'],
          ['Employer Tax ID', employmentDetails?.employerTaxId || 'N/A'],
        ]),
  ];

  const sheets: { sheetName: string; rows: (string | number | null | undefined)[][] }[] = [
    { sheetName: '1_Taxpayer_Profile', rows: profileRows },
  ];

  if (isBusinessName) {
    const bizRows: (string | number)[][] = [
      ['SALES & EXPENSE RECONCILIATION / STATEMENT OF ACCOUNTS', 'Amount (NGN)', 'Notes'],
      ['Total Annual Sales / Turnover', bizRec.totalAnnualSales, ''],
      ['Less: Cost of Goods Sold (COGS)', -bizRec.costOfGoodsSold, 'Direct product/service cost'],
      ['Gross Profit', bizRec.grossProfit, ''],
      ['Operating Expenses', -bizRec.operatingExpenses, ''],
      ['Staff Salaries', -bizRec.staffSalaries, ''],
      ['Business Rent', -bizRec.businessRent, ''],
      ['Transport', -bizRec.transport, ''],
      ['Utilities', -bizRec.utilities, ''],
      ['Other Business Expenses', -bizRec.otherBusinessExpenses, ''],
      ['Total Allowable Operating Expenses', -bizRec.totalAllowableOperatingExpenses, ''],
      ['Net Business Profit (carried to PIT)', bizRec.netBusinessProfit, bizRec.businessLossCarriedForward > 0 ? `Loss ${fmtNaira(bizRec.businessLossCarriedForward)} carried forward` : ''],
      ['Equipment Purchases (Capital Expenditure)', bizRec.equipmentPurchasesNotExpensed, 'Tracked for Capital Allowance (not expensed 100%)'],
      ['Section 13 NTAA 2025 Taxpayer Attestation', attestedByTaxpayer ? 'Attested by Taxpayer' : 'Pending Attestation', 'Required where audited FS are not attached'],
      ['', '', ''],
      ['RECONSTRUCTION GAPS FLAGGED FOR REVIEW', '', ''],
      ...(gapFlags.length > 0 ? gapFlags.map((g, idx) => [`Gap ${idx + 1}`, g, '']) : [['Status', 'No major document/account gaps detected', '']]),
      ['', '', ''],
      ['ADDITIONAL COMPLIANCE FLAGS (SEPARATE FROM PIT)', '', ''],
      ...(complianceAdvisories.length > 0
        ? complianceAdvisories.map((c, idx) => [`Flag ${idx + 1}`, c, 'Not added to proprietor PIT'])
        : [['Status', 'No additional PAYE/WHT/VAT compliance flags triggered', '']]),
    ];
    sheets.push({ sheetName: '2_Business_Profit_Recon', rows: bizRows });
  }

  const computationRows: (string | number)[][] = [
    ['FORM A TAX COMPUTATION & PAYE RECONCILIATION', 'Amount (NGN)', 'Notes'],
    ['Salary & Wages', input.income.salaryAndWages, 'Employment income'],
    ['Bonuses & Allowances', input.income.bonusesAndAllowances, 'Employment allowances'],
    ['Other Employment Benefits / BIK', input.income.benefitsInKind, 'Taxable employment benefits'],
    ['Total Employment Income', result.employmentIncomeTotal, ''],
    ['Net Business Profit (Business Name / Trade)', result.businessNetProfit, ''],
    ['Rental Income', input.income.rentalIncome, ''],
    ['Freelance / Business Side Income', input.income.freelanceAndOtherTaxableIncome, ''],
    ['Commissions & Investment / Other Taxable Income', result.otherTaxableIncomeTotal - input.income.rentalIncome - input.income.freelanceAndOtherTaxableIncome, ''],
    ['Total Assessable Income (All Sources)', result.totalAssessableIncome, 'Section 13 NTAA 2025 Gross Income'],
    ['', '', ''],
    ['TAX RELIEF ASSESSMENT', '', ''],
    ['Employee Pension Contribution (PFA)', input.deductions.pensionContribution, 'Tax-exempt'],
    ['National Housing Fund (NHF)', input.deductions.nhfContribution, 'Tax-exempt'],
    ['NHIS / Health Insurance', input.deductions.nhisContribution, 'Tax-exempt'],
    ['Life Assurance Premium', input.deductions.lifeAssurancePremium, 'Tax-exempt'],
    ['Other Recognised Deductions', input.deductions.otherRecognisedDeductions || 0, ''],
    ['Consolidated Relief Allowance (PITA <= 2025)', result.consolidatedReliefAllowance, result.regimeId === 'PITA_2011_FA2020' ? 'max(200k, 1%) + 20%' : 'Abolished in 2026+'],
    ['Rent Relief (NTA 2025 >= 2026)', result.rentRelief, result.regimeId === 'NTA_2025' ? 'min(20% rent paid, 500k)' : 'Not applicable pre-2026'],
    ['Total Reliefs & Deductions', result.totalReliefsAndDeductions, ''],
    ['Chargeable (Taxable) Income', result.chargeableIncome, ''],
    ['', '', ''],
    ['PROGRESSIVE TAX BAND COMPUTATION', 'Taxable in Band (NGN)', 'Tax Liability (NGN)'],
    ...result.bandBreakdown.map((b) => [
      `${b.label} @ ${(b.rate * 100).toFixed(0)}%`,
      b.taxableInBand,
      b.taxInBand,
    ]),
    ['Gross Annual Tax Liability', '', result.grossAnnualTax],
    ['Less: Employer PAYE Already Deducted', '', result.payeAlreadyRemitted],
    ['Less: WHT Credits Applied', '', result.whtCreditsApplied],
    ['PAYE Reconciliation Status', result.payeReconciliationStatus, ''],
    ['Balance Payable to State IRS', '', result.netTaxPayable],
    ['Overpayment / Carry-Forward Credit', '', result.taxRefundOrCarryForwardCredit],
  ];
  sheets.push({ sheetName: isBusinessName ? '3_PIT_Tax_Computation' : '2_PIT_Tax_Computation', rows: computationRows });

  const checklistRows: (string | number)[][] = [
    ['STATE PORTAL SELF-FILING GUIDE', jurisdiction.authorityCode],
    ['Portal URL', jurisdiction.portalUrl],
    ['Federal Individual Registration Route (if needed)', 'https://selfservice.nrs.gov.ng'],
    ['Form Path', jurisdiction.returnTemplates[0]?.portalPath || 'Form A'],
    ['', ''],
    ['STEP-BY-STEP PORTAL FILING PROCEDURE', ''],
    ...jurisdiction.filingProcedureSteps.map((s, idx) => [`Step ${idx + 1}`, s]),
    ['', ''],
    ['REQUIRED SUPPORTING DOCUMENTS', ''],
    ...(isBusinessName
      ? jurisdiction.requiredSupportingDocuments.business_name
      : jurisdiction.requiredSupportingDocuments.individual
    ).map((doc, idx) => [`Doc ${idx + 1}`, doc]),
  ];
  sheets.push({ sheetName: isBusinessName ? '4_Portal_Instructions' : '3_Portal_Instructions', rows: checklistRows });

  const safeName = (taxpayerProfile.fullName || 'taxpayer').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  downloadExcelWorkbook(`ROVA_PIT_${jurisdiction.authorityCode}_${result.taxYear}_${safeName}.xlsx`, sheets);
}

export function printPitFilingSummary(opts: PitPackageExportOptions) {
  const {
    jurisdiction,
    input,
    result,
    taxpayerProfile,
    businessDetails,
    gapFlags = [],
    complianceAdvisories = [],
    attestedByTaxpayer = false,
  } = opts;
  const isBusinessName = input.classification === 'business_name';
  const bizRec = result.businessReconciliation;
  const docs = isBusinessName
    ? jurisdiction.requiredSupportingDocuments.business_name
    : jurisdiction.requiredSupportingDocuments.individual;

  const businessSectionHtml = isBusinessName
    ? `
      <h3 style="margin-top:16px;">Sales &amp; Expense Reconciliation / Statement of Accounts (Section 13 NTAA 2025)</h3>
      <p><strong>Business Name:</strong> ${businessDetails?.registeredBusinessName || taxpayerProfile.businessName || 'N/A'} (${businessDetails?.cacRegistrationNumber || taxpayerProfile.cacNumber || 'CAC Pending'})</p>
      <table>
        <thead><tr><th>Account Line</th><th style="text-align:right;">Amount (NGN)</th></tr></thead>
        <tbody>
          <tr><td>Total Annual Sales</td><td style="text-align:right;">${fmtNaira(bizRec.totalAnnualSales)}</td></tr>
          <tr><td>Less: Cost of Goods Sold (COGS)</td><td style="text-align:right;">(${fmtNaira(bizRec.costOfGoodsSold)})</td></tr>
          <tr><td><strong>Gross Profit</strong></td><td style="text-align:right;"><strong>${fmtNaira(bizRec.grossProfit)}</strong></td></tr>
          <tr><td>Operating Expenses, Staff Salaries, Rent, Transport, Utilities &amp; Other</td><td style="text-align:right;">(${fmtNaira(bizRec.totalAllowableOperatingExpenses)})</td></tr>
          <tr><td><strong>Net Business Profit Carried to PIT</strong></td><td style="text-align:right;"><strong>${fmtNaira(bizRec.netBusinessProfit)}</strong></td></tr>
          <tr><td>Equipment Purchases (Capital Expenditure — excluded from direct expense)</td><td style="text-align:right;">${fmtNaira(bizRec.equipmentPurchasesNotExpensed)}</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;margin-top:6px;"><strong>Attestation:</strong> ${attestedByTaxpayer ? 'Attested by taxpayer under Section 13 NTAA 2025' : 'Pending taxpayer attestation'}.</p>
      ${gapFlags.length > 0 ? `<p style="font-size:12px;"><strong>Flagged Reconstruction Gaps:</strong> ${gapFlags.join(' ')}</p>` : ''}
      ${complianceAdvisories.length > 0 ? `<p style="font-size:12px;"><strong>Separate Compliance Notes (Not added to PIT):</strong> ${complianceAdvisories.join(' ')}</p>` : ''}
    `
    : '';

  const html = `
    <div style="font-size: 13px; line-height: 1.5;">
      <p><strong>Authority:</strong> ${jurisdiction.authorityName} (${jurisdiction.portalUrl})<br/>
      <strong>Applicable Return:</strong> ${result.preparedReturnSummary.formName}<br/>
      <strong>Tax Year:</strong> ${result.taxYear} &nbsp;|&nbsp; <strong>Regime:</strong> ${result.regimeLabel}<br/>
      <strong>Taxpayer:</strong> ${taxpayerProfile.fullName || 'N/A'} &nbsp;|&nbsp; <strong>NIN:</strong> ${taxpayerProfile.nin || 'N/A'}<br/>
      <strong>${jurisdiction.individualTaxIdRequirement.idName}:</strong> ${taxpayerProfile.taxId || 'Pending (see selfservice.nrs.gov.ng or state portal)'}</p>

      ${businessSectionHtml}

      <h3 style="margin-top:16px;">Personal &amp; Total Income Summary + Tax Relief Assessment</h3>
      <table>
        <thead><tr><th>Line Item</th><th style="text-align:right;">Amount (NGN)</th></tr></thead>
        <tbody>
          <tr><td>Employment Income (Salary, Allowances, Benefits)</td><td style="text-align:right;">${fmtNaira(result.employmentIncomeTotal)}</td></tr>
          <tr><td>Business Net Profit</td><td style="text-align:right;">${fmtNaira(result.businessNetProfit)}</td></tr>
          <tr><td>Rental, Freelance, Investment, Commissions &amp; Other Income</td><td style="text-align:right;">${fmtNaira(result.otherTaxableIncomeTotal)}</td></tr>
          <tr><td><strong>Total Assessable Income (All Sources)</strong></td><td style="text-align:right;"><strong>${fmtNaira(result.totalAssessableIncome)}</strong></td></tr>
          <tr><td>Statutory Deductions (Pension, NHF, NHIS, Life Insurance, Other)</td><td style="text-align:right;">(${fmtNaira(result.statutoryExemptDeductionsTotal)})</td></tr>
          ${result.consolidatedReliefAllowance > 0 ? `<tr><td>Consolidated Relief Allowance (PITA)</td><td style="text-align:right;">(${fmtNaira(result.consolidatedReliefAllowance)})</td></tr>` : ''}
          ${result.rentRelief > 0 ? `<tr><td>Rent Relief (NTA 2025)</td><td style="text-align:right;">(${fmtNaira(result.rentRelief)})</td></tr>` : ''}
          <tr><td><strong>Chargeable Taxable Income</strong></td><td style="text-align:right;"><strong>${fmtNaira(result.chargeableIncome)}</strong></td></tr>
        </tbody>
      </table>

      <h3 style="margin-top:16px;">Tax Computation &amp; PAYE Reconciliation</h3>
      <table>
        <thead><tr><th>Band</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Taxable Slice</th><th style="text-align:right;">Tax</th></tr></thead>
        <tbody>
          ${result.bandBreakdown
            .map(
              (b) =>
                `<tr><td>${b.label}</td><td style="text-align:right;">${(b.rate * 100).toFixed(0)}%</td><td style="text-align:right;">${fmtNaira(b.taxableInBand)}</td><td style="text-align:right;">${fmtNaira(b.taxInBand)}</td></tr>`,
            )
            .join('')}
          <tr><td colspan="3"><strong>Gross Annual Tax Liability</strong></td><td style="text-align:right;"><strong>${fmtNaira(result.grossAnnualTax)}</strong></td></tr>
          <tr><td colspan="3">Less: Employer PAYE Deducted (${result.payeReconciliationStatus}) &amp; WHT Credits</td><td style="text-align:right;">(${fmtNaira(result.payeAlreadyRemitted + result.whtCreditsApplied)})</td></tr>
          <tr><td colspan="3"><strong>Balance Payable to ${jurisdiction.authorityCode}</strong></td><td style="text-align:right;"><strong>${fmtNaira(result.netTaxPayable)}</strong></td></tr>
        </tbody>
      </table>

      <h3 style="margin-top:16px;">Filing Instructions &amp; Required Supporting Documents</h3>
      <ul>${docs.map((d) => `<li>${d}</li>`).join('')}</ul>
    </div>
  `;

  printStatementHTML(
    `Personal Income Tax Return Package — ${jurisdiction.authorityCode}`,
    `Tax Year ${result.taxYear} • ${result.regimeLabel}`,
    taxpayerProfile.fullName || taxpayerProfile.businessName || 'ROVA Taxpayer',
    html,
  );
}
