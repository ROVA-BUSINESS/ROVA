import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  HelpCircle,
  Landmark,
  Printer,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { ReceiptUploader } from '../../components/ui/ReceiptUploader';
import {
  PitDocumentChecklist,
  type PitRequiredDocSpec,
  type PitUploadedDocItem,
} from '../../components/tax/PitDocumentChecklist';
import {
  PIT_JURISDICTION_LIST,
  PIT_JURISDICTIONS,
  type PitStateCode,
  type TaxpayerClassification,
} from '../../config/pitJurisdictions';
import {
  assessBusinessReconstructionGaps,
  buildComplianceAdvisories,
  computePitReturn,
  deriveBusinessSummaryFromTransactions,
  reconcileBusinessFinancials,
  type BusinessComplianceObligationsInput,
  type BusinessDetailsInput,
  type BusinessFinancialsInput,
  type EmploymentDetailsInput,
  type IndividualActivityType,
  type PersonalOnboardingProfile,
  type PitDeductionsInput,
  type PitIncomeInput,
} from '../../lib/pitEngine';
import { downloadPitFilingWorkbook, printPitFilingSummary } from '../../lib/pitPackageExport';

const INDIVIDUAL_ACTIVITIES: Array<{ id: IndividualActivityType; label: string; hint: string }> = [
  { id: 'employed', label: 'Employed (I work for a company)', hint: 'You earn a salary, allowances, or employer benefits.' },
  { id: 'self_employed', label: 'Self-employed / freelancer', hint: 'Consulting, gig work, or personal trade.' },
  { id: 'rental', label: 'I earn rental income', hint: 'Rent collected from residential or commercial property.' },
  { id: 'investment', label: 'I earn investment income', hint: 'Interest, dividends, or investment returns.' },
  { id: 'multiple_sources', label: 'I earn income from multiple sources', hint: 'E.g. salary plus side income or investments.' },
  { id: 'other', label: 'Other', hint: 'Commissions, honoraria, or other personal earnings.' },
];

const INDIVIDUAL_DOC_SPECS: PitRequiredDocSpec[] = [
  { docKey: 'nin_id', label: 'NIN or Identification Details', hint: 'NIN slip, Passport, Driver Licence, or Voter Card' },
  { docKey: 'tax_id', label: 'Tax ID (if available)', hint: 'LIRS Payer ID, KIRS TIN, JTB TIN, or RIVTIN' },
  { docKey: 'annual_income_statement', label: 'Annual Income Statement', hint: 'Employer annual earnings certificate or schedule' },
  { docKey: 'payslips', label: 'Payslips', hint: 'Monthly or annual payslip copies' },
  { docKey: 'paye_evidence', label: 'PAYE Evidence', hint: 'Employer PAYE remittance schedule or tax card' },
  { docKey: 'bank_statements', label: 'Bank Statements (where relevant)', hint: 'Personal statements showing rental/freelance inflows' },
  { docKey: 'deduction_evidence', label: 'Evidence of Eligible Deductions', hint: 'PFA pension, rent receipts, NHF, NHIS, life assurance' },
  { docKey: 'previous_returns', label: 'Previous Tax Returns (if available)', hint: 'Prior year Form A or TCC' },
];

const BUSINESS_DOC_SPECS: PitRequiredDocSpec[] = [
  { docKey: 'cac_certificate', label: 'CAC Certificate', hint: 'CAC Business Name Registration Certificate' },
  { docKey: 'cac_details', label: 'CAC Registration Details', hint: 'CAC status report / BN application summary' },
  { docKey: 'bank_statements', label: 'Business Bank Statements', hint: 'Full year bank statements for business accounts' },
  { docKey: 'sales_records', label: 'Sales Records', hint: 'POS, cashbook, or annual sales log' },
  { docKey: 'purchase_records', label: 'Purchase Records', hint: 'Inventory / stock & raw material purchase records' },
  { docKey: 'expense_receipts', label: 'Expense Receipts', hint: 'Rent, transport, utility, and operational receipts' },
  { docKey: 'customer_invoices', label: 'Customer Invoices', hint: 'Issued sales/service invoices' },
  { docKey: 'supplier_invoices', label: 'Supplier Invoices', hint: 'Bills & vendor invoices received' },
  { docKey: 'financial_statements', label: 'Existing Financial Statements (if available)', hint: 'Signed accounts if already prepared' },
  { docKey: 'previous_returns', label: 'Previous Tax Returns (if available)', hint: 'Prior Form A or Direct Assessment notices' },
];

const fmtNaira = (n: number) =>
  `₦${(Number(n) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--bg-border)',
  color: 'var(--text-primary)',
  fontSize: '13px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '6px',
};

export default function PitWizardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialStateParam = searchParams.get('state') as PitStateCode | null;
  const initialYearParam = Number(searchParams.get('year')) || 2025;

  // Screen 0 vs active conditional journey step
  const [started, setStarted] = useState(false);
  const [classification, setClassification] = useState<TaxpayerClassification>('individual');
  const [taxYear, setTaxYear] = useState<number>(initialYearParam === 2026 ? 2026 : 2025);
  const [step, setStep] = useState<number>(1);

  const [personal, setPersonal] = useState<PersonalOnboardingProfile>({
    fullName: '',
    dateOfBirth: '',
    phone: '',
    email: '',
    nin: '',
    taxId: '',
    hasNoTaxId: false,
    residentialAddress: '',
    stateOfResidence: initialStateParam && PIT_JURISDICTIONS[initialStateParam] ? initialStateParam : 'LAGOS',
    lga: '',
    taxYear: initialYearParam === 2026 ? 2026 : 2025,
  });

  // Journey A: Individual states
  const [activities, setActivities] = useState<IndividualActivityType[]>(['employed']);
  const [employment, setEmployment] = useState<EmploymentDetailsInput>({
    employerName: '',
    employerAddress: '',
    employerTaxId: '',
    annualSalary: 0,
    bonusesAndAllowances: 0,
    pensionDeductions: 0,
    payeDeducted: 0,
    otherEmploymentBenefits: 0,
  });
  const [otherIndividualIncome, setOtherIndividualIncome] = useState({
    rentalIncome: 0,
    freelanceIncome: 0,
    investmentIncome: 0,
    frankedDividendsExempt: 0,
    commissions: 0,
    businessIncome: 0,
    otherIncome: 0,
    whtCredits: 0,
  });

  // Journey B: Business Name states
  const [businessDetails, setBusinessDetails] = useState<BusinessDetailsInput>({
    registeredBusinessName: '',
    cacRegistrationNumber: '',
    businessTaxId: '',
    dateOfRegistration: '',
    businessAddress: '',
    stateOfOperation: 'Lagos State',
    natureOfBusiness: '',
    currentlyOperating: true,
  });
  const [businessFinancials, setBusinessFinancials] = useState<BusinessFinancialsInput>({
    totalAnnualSales: 0,
    costOfGoodsSold: 0,
    operatingExpenses: 0,
    staffSalaries: 0,
    businessRent: 0,
    transport: 0,
    utilities: 0,
    equipmentPurchases: 0,
    otherBusinessExpenses: 0,
    otherIncomeOutsideBusiness: 0,
  });
  const [obligations, setObligations] = useState<BusinessComplianceObligationsInput>({
    hasEmployees: false,
    deductsPaye: false,
    paysContractorsWht: false,
    vatRegistered: false,
    multipleBusinessLocations: false,
  });

  // Shared Personal Reliefs & Docs & Submission
  const [deductions, setDeductions] = useState<PitDeductionsInput>({
    pensionContribution: 0,
    nhfContribution: 0,
    nhisContribution: 0,
    lifeAssurancePremium: 0,
    otherRecognisedDeductions: 0,
    annualRentPaid: 0,
    isHomeowner: false,
    hasRentReceipts: false,
  });
  const [docs, setDocs] = useState<PitUploadedDocItem[]>([]);
  const [attestedStatementOfAccounts, setAttestedStatementOfAccounts] = useState(false);
  const [verifiedByTaxpayer, setVerifiedByTaxpayer] = useState(false);
  const [acknowledgementRef, setAcknowledgementRef] = useState('');
  const [acknowledgementUrl, setAcknowledgementUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [booksHint, setBooksHint] = useState<string | null>(null);

  useEffect(() => {
    if (!profile && !user) return;
    setPersonal((prev) => ({
      ...prev,
      fullName: prev.fullName || profile?.full_name || '',
      email: prev.email || user?.email || '',
      phone: prev.phone || profile?.phone || '',
      residentialAddress: prev.residentialAddress || profile?.address || '',
    }));
    setBusinessDetails((prev) => ({
      ...prev,
      registeredBusinessName: prev.registeredBusinessName || profile?.business_name || '',
    }));
  }, [profile, user]);

  // Keep personal.taxYear & stateOfOperation synced neatly
  const stateCode = personal.stateOfResidence;
  const jurisdiction = PIT_JURISDICTIONS[stateCode];

  const isEmployed =
    classification === 'individual' &&
    (activities.includes('employed') || activities.includes('multiple_sources'));

  // Load saved draft when state/year changes after start
  useEffect(() => {
    if (!user || !started) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('pit_filings')
        .select('*')
        .eq('user_id', user.id)
        .eq('tax_year', taxYear)
        .eq('state_code', stateCode)
        .maybeSingle();

      if (!active || !data) return;
      const prof = (data.taxpayer_profile || {}) as Record<string, any>;
      if (prof.personal) setPersonal((p) => ({ ...p, ...prof.personal }));
      if (Array.isArray(prof.activities)) setActivities(prof.activities);
      if (prof.employment) setEmployment((e) => ({ ...e, ...prof.employment }));
      if (prof.businessDetails) setBusinessDetails((b) => ({ ...b, ...prof.businessDetails }));
      if (prof.obligations) setObligations((o) => ({ ...o, ...prof.obligations }));
      if (prof.otherIndividualIncome) setOtherIndividualIncome((o) => ({ ...o, ...prof.otherIndividualIncome }));
      if (prof.businessFinancials) setBusinessFinancials((b) => ({ ...b, ...prof.businessFinancials }));
      if (data.deductions_data && Object.keys(data.deductions_data).length > 0) {
        setDeductions((d) => ({ ...d, ...(data.deductions_data as Partial<PitDeductionsInput>) }));
      }
      if (Array.isArray(data.supporting_docs)) {
        setDocs(data.supporting_docs as PitUploadedDocItem[]);
      }
      setVerifiedByTaxpayer(Boolean(data.verified_by_taxpayer));
      setAcknowledgementRef(data.acknowledgement_ref || '');
      setAcknowledgementUrl(data.acknowledgement_url || '');
      setStatusMessage(`Loaded saved ${data.status} PIT draft for ${data.authority_code} (${taxYear}).`);
    })();
    return () => {
      active = false;
    };
  }, [user, started, taxYear, stateCode]);

  const engineInputIncome: PitIncomeInput = useMemo(() => {
    if (classification === 'business_name') {
      const rec = reconcileBusinessFinancials(businessFinancials);
      return {
        salaryAndWages: 0,
        bonusesAndAllowances: 0,
        benefitsInKind: 0,
        businessNameGrossRevenue: rec.totalAnnualSales,
        businessNameAllowableExpenses: rec.costOfGoodsSold + rec.totalAllowableOperatingExpenses,
        rentalIncome: 0,
        freelanceAndOtherTaxableIncome: businessFinancials.otherIncomeOutsideBusiness,
        taxExemptOrFinalWhtIncome: 0,
        payeAlreadyRemitted: 0,
        whtCreditNotes: 0,
      };
    }

    return {
      salaryAndWages: isEmployed ? employment.annualSalary : 0,
      bonusesAndAllowances: isEmployed ? employment.bonusesAndAllowances : 0,
      benefitsInKind: isEmployed ? employment.otherEmploymentBenefits : 0,
      businessNameGrossRevenue: 0,
      businessNameAllowableExpenses: 0,
      rentalIncome: otherIndividualIncome.rentalIncome,
      freelanceAndOtherTaxableIncome:
        otherIndividualIncome.freelanceIncome + otherIndividualIncome.businessIncome,
      investmentTaxableIncome: otherIndividualIncome.investmentIncome,
      commissionsIncome: otherIndividualIncome.commissions,
      otherTaxableIncome: otherIndividualIncome.otherIncome,
      taxExemptOrFinalWhtIncome: otherIndividualIncome.frankedDividendsExempt,
      payeAlreadyRemitted: isEmployed ? employment.payeDeducted : 0,
      whtCreditNotes: otherIndividualIncome.whtCredits,
    };
  }, [classification, businessFinancials, isEmployed, employment, otherIndividualIncome]);

  const effectiveDeductions: PitDeductionsInput = useMemo(() => {
    const empPension = isEmployed ? employment.pensionDeductions : 0;
    return {
      ...deductions,
      pensionContribution: Math.max(deductions.pensionContribution, empPension),
    };
  }, [deductions, isEmployed, employment.pensionDeductions]);

  const computation = useMemo(
    () =>
      computePitReturn({
        taxYear,
        classification,
        stateCode,
        income: engineInputIncome,
        deductions: effectiveDeductions,
        businessFinancials: classification === 'business_name' ? businessFinancials : undefined,
      }),
    [taxYear, classification, stateCode, engineInputIncome, effectiveDeductions, businessFinancials],
  );

  const bizGapFlags = useMemo(
    () =>
      classification === 'business_name'
        ? assessBusinessReconstructionGaps({
            financials: businessFinancials,
            uploadedDocKeys: docs.map((d) => d.docKey),
          })
        : [],
    [classification, businessFinancials, docs],
  );

  const complianceAdvisories = useMemo(
    () => (classification === 'business_name' ? buildComplianceAdvisories(obligations) : []),
    [classification, obligations],
  );

  const handleImportFromBooks = async () => {
    if (!user) return;
    setBooksHint(`Reading ${taxYear} transactions from your ROVA ledger...`);
    const { data, error } = await supabase
      .from('transactions')
      .select('date, type, amount, description')
      .eq('user_id', user.id)
      .gte('date', `${taxYear}-01-01`)
      .lte('date', `${taxYear}-12-31`);

    if (error) {
      setBooksHint(`Could not read ledger transactions: ${error.message}`);
      return;
    }
    const summary = deriveBusinessSummaryFromTransactions(data || [], taxYear);
    setBusinessFinancials((prev) => ({
      ...prev,
      totalAnnualSales: summary.businessRevenue,
      operatingExpenses: summary.allowableBusinessExpenses,
    }));
    setBooksHint(
      `Reconstructed from ${summary.matchedCount} ${taxYear} ROVA entries: Total Sales ${fmtNaira(summary.businessRevenue)}, Operating Expenses ${fmtNaira(summary.allowableBusinessExpenses)}. Review or split Rent/Salaries/Utilities below.`,
    );
  };

  const toggleActivity = (id: IndividualActivityType) => {
    setActivities((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const saveFiling = async (targetStatus: 'draft' | 'ready_for_submission' | 'submitted' | 'acknowledged') => {
    if (!user) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const payload = {
        user_id: user.id,
        tax_year: taxYear,
        taxpayer_classification: classification,
        state_code: stateCode,
        authority_code: jurisdiction.authorityCode,
        tax_id_value: personal.taxId,
        taxpayer_profile: {
          personal,
          activities,
          employment,
          otherIndividualIncome,
          businessDetails,
          businessFinancials,
          obligations,
          attestedStatementOfAccounts,
        },
        income_data: engineInputIncome,
        deductions_data: effectiveDeductions,
        supporting_docs: docs,
        computation_result: computation,
        status: targetStatus,
        verified_by_taxpayer: verifiedByTaxpayer,
        acknowledgement_ref: acknowledgementRef,
        acknowledgement_url: acknowledgementUrl,
        submitted_at: targetStatus === 'submitted' || targetStatus === 'acknowledged' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('pit_filings')
        .upsert(payload, { onConflict: 'user_id,tax_year,state_code' });

      if (error) throw error;

      if (targetStatus === 'submitted' || targetStatus === 'acknowledged') {
        await supabase.from('tax_records').insert({
          user_id: user.id,
          period_start: `${taxYear}-01-01`,
          period_end: `${taxYear}-12-31`,
          tax_type: 'PIT',
          gross_income: computation.totalAssessableIncome,
          deductions: computation.totalReliefsAndDeductions,
          taxable_income: computation.chargeableIncome,
          calculated_tax: computation.grossAnnualTax,
          paid_tax: computation.payeAlreadyRemitted + computation.whtCreditsApplied,
          status: 'filed',
          due_date: `${taxYear + 1}-03-31`,
          notes: `${jurisdiction.authorityCode} PIT Self-Filing (${classification === 'business_name' ? 'CAC Business Name' : 'Individual'}) — Ref: ${acknowledgementRef || 'Recorded in ROVA'}`,
        });
      }

      setStatusMessage(
        targetStatus === 'acknowledged'
          ? `Submission acknowledgement saved for ${jurisdiction.authorityCode} (${taxYear}).`
          : `Saved ${targetStatus.replace(/_/g, ' ')} PIT return for ${jurisdiction.authorityCode} (${taxYear}).`,
      );
    } catch (err: any) {
      setStatusMessage(`Save failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const numInput = (val: number, onChange: (n: number) => void) => (
    <input
      type="number"
      min={0}
      step="0.01"
      value={val || ''}
      placeholder="0.00"
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      style={fieldStyle}
    />
  );

  const exportOpts = {
    jurisdiction,
    input: {
      taxYear,
      classification,
      stateCode,
      income: engineInputIncome,
      deductions: effectiveDeductions,
      businessFinancials: classification === 'business_name' ? businessFinancials : undefined,
    },
    result: computation,
    taxpayerProfile: {
      fullName: personal.fullName,
      dateOfBirth: personal.dateOfBirth,
      nin: personal.nin,
      lga: personal.lga,
      businessName: businessDetails.registeredBusinessName,
      cacNumber: businessDetails.cacRegistrationNumber,
      taxId: personal.taxId,
      residentialAddress: personal.residentialAddress,
      email: personal.email,
      phone: personal.phone,
    },
    employmentDetails: employment,
    businessDetails,
    gapFlags: bizGapFlags,
    complianceAdvisories,
    attestedByTaxpayer: attestedStatementOfAccounts,
  };

  // SCREEN 0: "Let's get you tax-ready."
  if (!started) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate('/app/tax')}>
            Back to Tax Hub
          </Button>
        </div>

        <Card style={{ padding: 28 }}>
          <Badge variant="info">Personal Income Tax • Lagos (LIRS), Kano (KIRS), Abuja (FCT-IRS), Rivers (RIRS)</Badge>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 12, color: 'var(--text-primary)' }}>
            Let&apos;s get you tax-ready.
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6, marginBottom: 24 }}>
            First, tell us a little about yourself. This helps us prepare the right tax filing process.
          </p>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Which best describes you?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              <button
                type="button"
                onClick={() => setClassification('individual')}
                style={{
                  textAlign: 'left',
                  padding: 18,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${classification === 'individual' ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                  background: classification === 'individual' ? 'var(--accent-dim)' : 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  <User size={18} />
                  I am an individual
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  I earn a salary, freelance income or other personal income.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setClassification('business_name')}
                style={{
                  textAlign: 'left',
                  padding: 18,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${classification === 'business_name' ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                  background: classification === 'business_name' ? 'var(--accent-dim)' : 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  <Building2 size={18} />
                  I own a registered business name
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  I operate a sole proprietorship registered with CAC.
                </div>
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Which year do you want to file?</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[2025, 2026].map((yr) => {
                const active = taxYear === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => {
                      setTaxYear(yr);
                      setPersonal((p) => ({ ...p, taxYear: yr }));
                    }}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${active ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                      background: active ? 'var(--accent-dim)' : 'var(--bg-surface)',
                      color: active ? 'var(--accent-light)' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: 'pointer',
                    }}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
              {taxYear >= 2026
                ? 'Uses the Nigeria Tax Act 2025 rules (first ₦800,000 at 0% + Rent Relief up to ₦500,000).'
                : 'Uses PITA rules (Consolidated Relief Allowance + 7%–24% progressive bands).'}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Button
              variant="primary"
              size="lg"
              icon={<ArrowRight size={16} />}
              onClick={() => {
                setStarted(true);
                setStep(1);
              }}
            >
              Continue
            </Button>

            <button
              type="button"
              onClick={() => navigate('/app/tax/cit/new')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Own a Limited Liability Company (LTD/PLC)? File NRS CIT instead
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // Stepper definitions differ by conditional journey!
  const individualSteps = [
    { id: 1, label: '1. Personal Info' },
    { id: 2, label: '2. What You Do' },
    ...(isEmployed ? [{ id: 3, label: '3. Employment' }] : []),
    { id: 4, label: isEmployed ? '4. Other Income' : '3. Other Income' },
    { id: 5, label: isEmployed ? '5. Reliefs' : '4. Reliefs' },
    { id: 6, label: isEmployed ? '6. Docs & File' : '5. Docs & File' },
  ];

  const businessSteps = [
    { id: 1, label: '1. Personal Info' },
    { id: 2, label: '2. Business Info' },
    { id: 3, label: '3. Financials' },
    { id: 4, label: '4. Business Docs' },
    { id: 5, label: '5. Obligations & File' },
  ];

  const activeSteps = classification === 'individual' ? individualSteps : businessSteps;

  const renderPersonalInfoStep = () => (
    <Card>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Step 1: Personal information</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Tell us who is filing and which state you lived in during {taxYear}. We use plain details first—no tax jargon required.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Full legal name *</label>
          <input value={personal.fullName} onChange={(e) => setPersonal((p) => ({ ...p, fullName: e.target.value }))} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Date of birth</label>
          <input type="date" value={personal.dateOfBirth} onChange={(e) => setPersonal((p) => ({ ...p, dateOfBirth: e.target.value }))} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Phone number *</label>
          <input value={personal.phone} onChange={(e) => setPersonal((p) => ({ ...p, phone: e.target.value }))} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Email address *</label>
          <input type="email" value={personal.email} onChange={(e) => setPersonal((p) => ({ ...p, email: e.target.value }))} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>NIN (National Identification Number)</label>
          <input value={personal.nin} onChange={(e) => setPersonal((p) => ({ ...p, nin: e.target.value }))} placeholder="11-digit NIN" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Tax Identification Number (if available)</label>
          <input
            disabled={personal.hasNoTaxId}
            value={personal.taxId}
            onChange={(e) => setPersonal((p) => ({ ...p, taxId: e.target.value }))}
            placeholder={jurisdiction.individualTaxIdRequirement.idFormatHint}
            style={{ ...fieldStyle, opacity: personal.hasNoTaxId ? 0.5 : 1 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={personal.hasNoTaxId}
              onChange={(e) => setPersonal((p) => ({ ...p, hasNoTaxId: e.target.checked, taxId: e.target.checked ? '' : p.taxId }))}
            />
            I don&apos;t have a Tax ID yet (show registration help)
          </label>
        </div>
        <div>
          <label style={labelStyle}>State of residence ({jurisdiction.authorityCode}) *</label>
          <select
            value={personal.stateOfResidence}
            onChange={(e) => setPersonal((p) => ({ ...p, stateOfResidence: e.target.value as PitStateCode }))}
            style={fieldStyle}
          >
            {PIT_JURISDICTION_LIST.map((j) => (
              <option key={j.stateCode} value={j.stateCode}>
                {j.stateLabel} ({j.authorityCode})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Local Government Area (LGA)</label>
          <input value={personal.lga} onChange={(e) => setPersonal((p) => ({ ...p, lga: e.target.value }))} placeholder="e.g. Ikeja, Municipal, Kano Municipal, Port Harcourt" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Tax year to file</label>
          <select
            value={taxYear}
            onChange={(e) => {
              const yr = Number(e.target.value);
              setTaxYear(yr);
              setPersonal((p) => ({ ...p, taxYear: yr }));
            }}
            style={fieldStyle}
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Residential address *</label>
          <input value={personal.residentialAddress} onChange={(e) => setPersonal((p) => ({ ...p, residentialAddress: e.target.value }))} style={fieldStyle} />
        </div>
      </div>

      {personal.hasNoTaxId && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 'var(--radius-md)',
            background: 'var(--info-dim)',
            border: '1px solid rgba(59,130,246,0.3)',
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <HelpCircle size={16} /> Tax ID Registration Assistance (You Can Still Prepare Your Return Now)
          </div>
          <p style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
            You can continue preparing your ROVA return now and obtain your Tax ID before submitting:
          </p>
          <ul style={{ margin: '0 0 10px 18px', color: 'var(--text-primary)' }}>
            <li>
              <strong>Federal Individual Route:</strong> Register online via{' '}
              <a href="https://selfservice.nrs.gov.ng" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)' }}>
                selfservice.nrs.gov.ng <ExternalLink size={12} />
              </a>
            </li>
            {jurisdiction.individualTaxIdRequirement.registrationProcess.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="secondary" onClick={() => setStarted(false)}>
          Change Journey
        </Button>
        <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => setStep(2)}>
          Continue
        </Button>
      </div>
    </Card>
  );

  const renderTaxSummaryAndFilingCard = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Badge variant="info">
              {jurisdiction.authorityName} • Section 13 NTAA 2025
            </Badge>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
              {classification === 'business_name'
                ? 'Your Personal & Business Name PIT Filing Package'
                : 'Your Personal Income Tax (PIT) Return Package'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {computation.regimeLabel} • Covers income from all sources, personal reliefs, and {jurisdiction.authorityCode} filing steps.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" icon={<FileSpreadsheet size={16} />} onClick={() => downloadPitFilingWorkbook(exportOpts)}>
              Download Package (.xlsx)
            </Button>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => printPitFilingSummary(exportOpts)}>
              Print / PDF Summary
            </Button>
            <a
              href={jurisdiction.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-primary)',
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Open {jurisdiction.authorityCode} Portal <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 16 }}>
        <Card>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
            {classification === 'business_name'
              ? 'Personal & Business Income Summary + Profit Computation'
              : 'Personal Income Summary, PAYE Reconciliation & Reliefs'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
            {classification === 'business_name' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Annual Sales</span>
                  <span>{fmtNaira(computation.businessReconciliation.totalAnnualSales)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Less: Cost of Goods Sold (COGS)</span>
                  <span>({fmtNaira(computation.businessReconciliation.costOfGoodsSold)})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Less: Allowable Business Expenses</span>
                  <span>({fmtNaira(computation.businessReconciliation.totalAllowableOperatingExpenses)})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Net Business Profit</span>
                  <span>{fmtNaira(computation.businessNetProfit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Other Income Outside Business</span>
                  <span>{fmtNaira(computation.otherTaxableIncomeTotal)}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Employment Income</span>
                  <span>{fmtNaira(computation.employmentIncomeTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Other Taxable Income</span>
                  <span>{fmtNaira(computation.otherTaxableIncomeTotal)}</span>
                </div>
              </>
            )}

            <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total Assessable Income</span>
              <span>{fmtNaira(computation.totalAssessableIncome)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Reliefs &amp; Deductions</span>
              <span>({fmtNaira(computation.totalReliefsAndDeductions)})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Chargeable Income</span>
              <span>{fmtNaira(computation.chargeableIncome)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gross Annual Tax</span>
              <span>{fmtNaira(computation.grossAnnualTax)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                PAYE Deducted / WHT Credits ({computation.payeReconciliationStatus.replace('_', ' ')})
              </span>
              <span>({fmtNaira(computation.payeAlreadyRemitted + computation.whtCreditsApplied)})</span>
            </div>
            <div
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-dim)',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
              }}
            >
              <span>Balance Payable ({jurisdiction.authorityCode})</span>
              <span style={{ color: 'var(--accent-light)' }}>{fmtNaira(computation.netTaxPayable)}</span>
            </div>
          </div>

          <h4 style={{ fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 6 }}>
            {jurisdiction.authorityCode} Self-Filing Instructions
          </h4>
          <ol style={{ margin: '0 0 0 18px', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {jurisdiction.filingProcedureSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>

        <Card>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={17} /> Review, Attestation &amp; Submission Acknowledgement
          </h3>

          {classification === 'business_name' && (
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 12,
                padding: 10,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                marginBottom: 12,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={attestedStatementOfAccounts}
                onChange={(e) => setAttestedStatementOfAccounts(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                <strong>Section 13 NTAA 2025 Attestation:</strong> I attest that this reconstructed Statement of Accounts / financial summary accurately reflects my business income and expenses.
              </span>
            </label>
          )}

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, marginBottom: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={verifiedByTaxpayer}
              onChange={(e) => setVerifiedByTaxpayer(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              I have reviewed all income, reliefs, and Form A figures and approve them for direct self-submission on{' '}
              <strong>{jurisdiction.portalUrl}</strong>.
            </span>
          </label>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Portal Submission Reference / Assessment Number</label>
            <input
              value={acknowledgementRef}
              onChange={(e) => setAcknowledgementRef(e.target.value)}
              placeholder={`e.g. ${jurisdiction.authorityCode}-${taxYear}-REF`}
              style={fieldStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Upload Submission Acknowledgement / Payment Receipt</label>
            <ReceiptUploader value={acknowledgementUrl} onChange={setAcknowledgementUrl} label="Upload Acknowledgement (PDF, JPG, PNG)" />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" disabled={saving} onClick={() => saveFiling('draft')}>
              Save Draft
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={!verifiedByTaxpayer || (classification === 'business_name' && !attestedStatementOfAccounts)}
              icon={<CheckCircle2 size={16} />}
              onClick={() => saveFiling(acknowledgementUrl || acknowledgementRef ? 'acknowledged' : 'submitted')}
            >
              {acknowledgementUrl || acknowledgementRef ? 'Save Acknowledgement' : 'Confirm Submission'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate('/app/tax')}>
            Back to Tax Hub
          </Button>
          <h1 style={{ fontSize: 21, fontWeight: 700, marginTop: 4 }}>
            {classification === 'business_name'
              ? 'Business-Name Owner PIT Onboarding'
              : 'Individual Taxpayer PIT Onboarding'}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Filing Year: <strong>{taxYear}</strong> • Authority: <strong>{jurisdiction.authorityCode}</strong> ({jurisdiction.stateLabel})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={() => navigate('/app/tax/pit/admin')}>
            Jurisdiction Admin
          </Button>
          <Badge variant="purple">
            <Landmark size={12} style={{ marginRight: 4 }} /> {jurisdiction.authorityCode}
          </Badge>
        </div>
      </div>

      {/* Conditional Stepper */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {activeSteps.map((s) => {
          const active = step === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              style={{
                flex: '1 1 130px',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                background: active ? 'var(--accent-dim)' : 'var(--bg-card)',
                color: active ? 'var(--accent-light)' : step > s.id ? 'var(--success)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {statusMessage && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--info-dim)', fontSize: 13 }}>
          {statusMessage}
        </div>
      )}

      {/* ==================== JOURNEY A: INDIVIDUAL ==================== */}
      {classification === 'individual' && (
        <>
          {step === 1 && renderPersonalInfoStep()}

          {step === 2 && (
            <Card>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Step 2: What do you do?</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Select all income sources that applied to you in {taxYear}. ROVA will skip irrelevant questions automatically.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
                {INDIVIDUAL_ACTIVITIES.map((act) => {
                  const selected = activities.includes(act.id);
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => toggleActivity(act.id)}
                      style={{
                        textAlign: 'left',
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${selected ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                        background: selected ? 'var(--accent-dim)' : 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{act.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{act.hint}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => setStep(isEmployed ? 3 : 4)}>
                  Continue
                </Button>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Step 3: Employment information</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Enter figures from your {taxYear} annual payslip summary or employer&apos;s income statement.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Employer&apos;s name</label>
                  <input value={employment.employerName} onChange={(e) => setEmployment((p) => ({ ...p, employerName: e.target.value }))} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Employer&apos;s Tax ID (if available)</label>
                  <input value={employment.employerTaxId} onChange={(e) => setEmployment((p) => ({ ...p, employerTaxId: e.target.value }))} style={fieldStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Employer&apos;s address</label>
                  <input value={employment.employerAddress} onChange={(e) => setEmployment((p) => ({ ...p, employerAddress: e.target.value }))} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Annual salary (NGN)</label>
                  {numInput(employment.annualSalary, (v) => setEmployment((p) => ({ ...p, annualSalary: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Bonuses and allowances (NGN)</label>
                  {numInput(employment.bonusesAndAllowances, (v) => setEmployment((p) => ({ ...p, bonusesAndAllowances: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Pension deductions (employee PFA)</label>
                  {numInput(employment.pensionDeductions, (v) => setEmployment((p) => ({ ...p, pensionDeductions: v })))}
                </div>
                <div>
                  <label style={labelStyle}>PAYE already deducted by employer</label>
                  {numInput(employment.payeDeducted, (v) => setEmployment((p) => ({ ...p, payeDeducted: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Other employment benefits (NGN)</label>
                  {numInput(employment.otherEmploymentBenefits, (v) => setEmployment((p) => ({ ...p, otherEmploymentBenefits: v })))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>Annual payslip summary or employer&apos;s income statement (upload later or attach in Step 6)</label>
                <ReceiptUploader
                  value={docs.find((d) => d.docKey === 'annual_income_statement')?.url || ''}
                  onChange={(url) =>
                    setDocs((prev) => [
                      ...prev.filter((d) => d.docKey !== 'annual_income_statement'),
                      { docKey: 'annual_income_statement', label: 'Annual Income Statement / Payslip Summary', url },
                    ])
                  }
                  label="Upload Annual Payslip / Employer Income Statement"
                />
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => setStep(4)}>
                  Continue to Other Income
                </Button>
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Other income</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Enter any additional income earned during {taxYear}. Leave unused lines at 0.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Rental income</label>
                  {numInput(otherIndividualIncome.rentalIncome, (v) => setOtherIndividualIncome((p) => ({ ...p, rentalIncome: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Freelance income</label>
                  {numInput(otherIndividualIncome.freelanceIncome, (v) => setOtherIndividualIncome((p) => ({ ...p, freelanceIncome: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Taxable investment income</label>
                  {numInput(otherIndividualIncome.investmentIncome, (v) => setOtherIndividualIncome((p) => ({ ...p, investmentIncome: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Franked dividends / Final-WHT income (excluded)</label>
                  {numInput(otherIndividualIncome.frankedDividendsExempt, (v) => setOtherIndividualIncome((p) => ({ ...p, frankedDividendsExempt: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Commissions</label>
                  {numInput(otherIndividualIncome.commissions, (v) => setOtherIndividualIncome((p) => ({ ...p, commissions: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Side business / trade income</label>
                  {numInput(otherIndividualIncome.businessIncome, (v) => setOtherIndividualIncome((p) => ({ ...p, businessIncome: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Other taxable income</label>
                  {numInput(otherIndividualIncome.otherIncome, (v) => setOtherIndividualIncome((p) => ({ ...p, otherIncome: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Withholding Tax (WHT) credit notes</label>
                  {numInput(otherIndividualIncome.whtCredits, (v) => setOtherIndividualIncome((p) => ({ ...p, whtCredits: v })))}
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep(isEmployed ? 3 : 2)}>
                  Back
                </Button>
                <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => setStep(5)}>
                  Continue to Tax Reliefs
                </Button>
              </div>
            </Card>
          )}

          {step === 5 && (
            <Card>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Tax reliefs and deductions</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Enter legally recognised reliefs paid in {taxYear}. Evidence may be required by {jurisdiction.authorityCode}.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Pension contributions (total annual PFA)</label>
                  {numInput(effectiveDeductions.pensionContribution, (v) => setDeductions((d) => ({ ...d, pensionContribution: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Rent paid ({taxYear >= 2026 ? 'eligible for 20% Rent Relief up to ₦500k' : 'recorded for schedule'})</label>
                  {numInput(deductions.annualRentPaid, (v) => setDeductions((d) => ({ ...d, annualRentPaid: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Life insurance premiums</label>
                  {numInput(deductions.lifeAssurancePremium, (v) => setDeductions((d) => ({ ...d, lifeAssurancePremium: v })))}
                </div>
                <div>
                  <label style={labelStyle}>National Housing Fund (NHF) contributions</label>
                  {numInput(deductions.nhfContribution, (v) => setDeductions((d) => ({ ...d, nhfContribution: v })))}
                </div>
                <div>
                  <label style={labelStyle}>NHIS contributions</label>
                  {numInput(deductions.nhisContribution, (v) => setDeductions((d) => ({ ...d, nhisContribution: v })))}
                </div>
                <div>
                  <label style={labelStyle}>Other legally recognised deductions</label>
                  {numInput(deductions.otherRecognisedDeductions || 0, (v) => setDeductions((d) => ({ ...d, otherRecognisedDeductions: v })))}
                </div>
              </div>

              {deductions.annualRentPaid > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={deductions.isHomeowner} onChange={(e) => setDeductions((d) => ({ ...d, isHomeowner: e.target.checked }))} />
                    I own my home (not a tenant)
                  </label>
                  {!deductions.isHomeowner && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={deductions.hasRentReceipts} onChange={(e) => setDeductions((d) => ({ ...d, hasRentReceipts: e.target.checked }))} />
                      I have rent receipts / tenancy proof
                    </label>
                  )}
                </div>
              )}

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep(4)}>
                  Back
                </Button>
                <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => setStep(6)}>
                  Continue to Upload Documents &amp; Return
                </Button>
              </div>
            </Card>
          )}

          {step === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Upload documents</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Attach any available documents below for your personal tax file and {jurisdiction.authorityCode} verification.
                </p>
                <PitDocumentChecklist
                  specs={INDIVIDUAL_DOC_SPECS}
                  docs={docs}
                  onAddDoc={(d) => setDocs((prev) => [...prev, d])}
                  onRemoveDoc={(idx) => setDocs((prev) => prev.filter((_, i) => i !== idx))}
                />
              </Card>

              {renderTaxSummaryAndFilingCard()}
            </div>
          )}
        </>
      )}

      {/* ==================== JOURNEY B: BUSINESS NAME ==================== */}
      {classification === 'business_name' && (
        <>
          {step === 1 && renderPersonalInfoStep()}

          {step === 2 && (
            <Card>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Step 2: Business information</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Your business is a CAC-registered Business Name, so you still file Personal Income Tax (Direct Assessment) rather than Corporate Income Tax.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Registered business name *</label>
                  <input value={businessDetails.registeredBusinessName} onChange={(e) => setBusinessDetails((b) => ({ ...b, registeredBusinessName: e.target.value }))} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>CAC registration number (BN) *</label>
                  <input value={businessDetails.cacRegistrationNumber} onChange={(e) => setBusinessDetails((b) => ({ ...b, cacRegistrationNumber: e.target.value }))} placeholder="e.g. BN 1234567" style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Business Tax ID (if available)</label>
                  <input value={businessDetails.businessTaxId} onChange={(e) => setBusinessDetails((b) => ({ ...b, businessTaxId: e.target.value }))} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date of registration</label>
                  <input type="date" value={businessDetails.dateOfRegistration} onChange={(e) => setBusinessDetails((b) => ({ ...b, dateOfRegistration: e.target.value }))} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>State of operation</label>
                  <input value={businessDetails.stateOfOperation} onChange={(e) => setBusinessDetails((b) => ({ ...b, stateOfOperation: e.target.value }))} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nature of business</label>
                  <input value={businessDetails.natureOfBusiness} onChange={(e) => setBusinessDetails((b) => ({ ...b, natureOfBusiness: e.target.value }))} placeholder="e.g. Retail trading, Design consulting" style={fieldStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Business address</label>
                  <input value={businessDetails.businessAddress} onChange={(e) => setBusinessDetails((b) => ({ ...b, businessAddress: e.target.value }))} style={fieldStyle} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={businessDetails.currentlyOperating}
                  onChange={(e) => setBusinessDetails((b) => ({ ...b, currentlyOperating: e.target.checked }))}
                />
                The business is currently operating
              </label>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => setStep(3)}>
                  Continue to Business Financials
                </Button>
              </div>
            </Card>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 700 }}>Step 3: Business financial information ({taxYear})</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      No prepared financial statements? Enter your sales and expense totals or import them from your ROVA ledger.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" icon={<Sparkles size={14} />} onClick={handleImportFromBooks}>
                    Reconstruct from ROVA Books
                  </Button>
                </div>

                {booksHint && (
                  <div style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--accent-dim)', color: 'var(--accent-light)', fontSize: 12, marginBottom: 14 }}>
                    {booksHint}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Total annual sales (NGN)</label>
                    {numInput(businessFinancials.totalAnnualSales, (v) => setBusinessFinancials((b) => ({ ...b, totalAnnualSales: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Cost of goods sold (NGN)</label>
                    {numInput(businessFinancials.costOfGoodsSold, (v) => setBusinessFinancials((b) => ({ ...b, costOfGoodsSold: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Operating expenses (NGN)</label>
                    {numInput(businessFinancials.operatingExpenses, (v) => setBusinessFinancials((b) => ({ ...b, operatingExpenses: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Staff salaries (NGN)</label>
                    {numInput(businessFinancials.staffSalaries, (v) => setBusinessFinancials((b) => ({ ...b, staffSalaries: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Business rent (NGN)</label>
                    {numInput(businessFinancials.businessRent, (v) => setBusinessFinancials((b) => ({ ...b, businessRent: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Transport (NGN)</label>
                    {numInput(businessFinancials.transport, (v) => setBusinessFinancials((b) => ({ ...b, transport: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Utilities (NGN)</label>
                    {numInput(businessFinancials.utilities, (v) => setBusinessFinancials((b) => ({ ...b, utilities: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Equipment purchases (capital item)</label>
                    {numInput(businessFinancials.equipmentPurchases, (v) => setBusinessFinancials((b) => ({ ...b, equipmentPurchases: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Other business expenses (NGN)</label>
                    {numInput(businessFinancials.otherBusinessExpenses, (v) => setBusinessFinancials((b) => ({ ...b, otherBusinessExpenses: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Other income outside the business</label>
                    {numInput(businessFinancials.otherIncomeOutsideBusiness, (v) => setBusinessFinancials((b) => ({ ...b, otherIncomeOutsideBusiness: v })))}
                  </div>
                </div>
              </Card>

              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Personal Tax Reliefs (Optional)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Personal pension contribution (PFA)</label>
                    {numInput(deductions.pensionContribution, (v) => setDeductions((d) => ({ ...d, pensionContribution: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Residential rent paid</label>
                    {numInput(deductions.annualRentPaid, (v) => setDeductions((d) => ({ ...d, annualRentPaid: v })))}
                  </div>
                  <div>
                    <label style={labelStyle}>Life insurance / NHF / NHIS</label>
                    {numInput(deductions.lifeAssurancePremium, (v) => setDeductions((d) => ({ ...d, lifeAssurancePremium: v })))}
                  </div>
                </div>
                {deductions.annualRentPaid > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 10 }}>
                    <input type="checkbox" checked={deductions.hasRentReceipts} onChange={(e) => setDeductions((d) => ({ ...d, hasRentReceipts: e.target.checked }))} />
                    I hold residential rent receipts (required for NTA 2025 Rent Relief from 2026)
                  </label>
                )}

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                  <Button variant="secondary" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => setStep(4)}>
                    Continue to Business Documents
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Step 4: Business documents</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Upload your CAC records, bank statements, and invoices. Where financial statements are missing, ROVA reconstructs your Statement of Accounts and flags gaps below.
                </p>

                <PitDocumentChecklist
                  specs={BUSINESS_DOC_SPECS}
                  docs={docs}
                  onAddDoc={(d) => setDocs((prev) => [...prev, d])}
                  onRemoveDoc={(idx) => setDocs((prev) => prev.filter((_, i) => i !== idx))}
                />
              </Card>

              <Card style={{ border: '1px solid rgba(245,158,11,0.35)', background: 'var(--warning-dim)' }}>
                <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <AlertTriangle size={16} /> Reconstructed Statement of Accounts &amp; Gap Review (Section 13 NTAA 2025)
                </div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  Reconstructed Sales: <strong>{fmtNaira(computation.businessReconciliation.totalAnnualSales)}</strong> •
                  COGS &amp; Expenses:{' '}
                  <strong>
                    {fmtNaira(
                      computation.businessReconciliation.costOfGoodsSold +
                        computation.businessReconciliation.totalAllowableOperatingExpenses,
                    )}
                  </strong>{' '}
                  • Computed Business Profit: <strong>{fmtNaira(computation.businessNetProfit)}</strong>
                </div>
                {bizGapFlags.length > 0 && (
                  <ul style={{ margin: '0 0 0 18px', fontSize: 12 }}>
                    {bizGapFlags.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                )}
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
                  <Button variant="secondary" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => setStep(5)}>
                    Continue to Employees &amp; Submission
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Step 5: Employees and additional obligations</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  These answers flag extra business compliance duties (PAYE, WHT, VAT) so nothing catches you off guard. They are{' '}
                  <strong>never added</strong> to your personal PIT calculation.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
                  {[
                    { key: 'hasEmployees' as const, label: 'Do you have employees?' },
                    { key: 'deductsPaye' as const, label: 'Do you deduct PAYE from staff salaries?' },
                    { key: 'paysContractorsWht' as const, label: 'Do you pay contractors or suppliers requiring withholding tax (WHT)?' },
                    { key: 'vatRegistered' as const, label: 'Are you registered for VAT?' },
                    { key: 'multipleBusinessLocations' as const, label: 'Do you have multiple business locations?' },
                  ].map((q) => (
                    <label
                      key={q.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: 12,
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--bg-border)',
                        background: 'var(--bg-surface)',
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={obligations[q.key]}
                        onChange={(e) => setObligations((o) => ({ ...o, [q.key]: e.target.checked }))}
                      />
                      <span>{q.label}</span>
                    </label>
                  ))}
                </div>

                {complianceAdvisories.length > 0 && (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--info-dim)', fontSize: 12 }}>
                    <strong>Compliance Advisories (Tracked Separately from Personal PIT):</strong>
                    <ul style={{ margin: '6px 0 0 18px' }}>
                      {complianceAdvisories.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>

              {renderTaxSummaryAndFilingCard()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
