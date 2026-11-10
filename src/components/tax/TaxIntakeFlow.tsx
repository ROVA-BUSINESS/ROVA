import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  Sparkles,
  Plus,
  Trash2,
  Building2,
  FileText,
  Receipt,
  Landmark,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  supabase,
  type Account,
  type Bill,
  type CoaOpeningBalance,
  type Employee,
  type FinancialStatementProfile,
  type FixedAssetRecord,
  type InventoryItem,
  type Invoice,
  type StatutoryAssetClass,
  type Transaction,
  type WhtCreditNoteRecord,
} from '../../lib/supabase';
import {
  computeFinancialStatementsModel,
  mapTransactionToIntakeEntry,
  type FinancialStatementModel,
  type IntakeAccountingEntry,
} from '../../lib/financialStatementEngine';
import { STANDARD_NIGERIA_COA, COA_BY_CODE } from '../../lib/standardCoa';
import {
  convertEvidenceToAccountingEntries,
  loadTaxWorkspaceData,
  parseBankStatementEvidence,
  parseReceiptEvidence,
  parseUploadedFinancialStatement,
  saveFixedAssetsList,
  saveFsProfile,
  saveIntakeSession,
  saveOpeningBalancesList,
  saveWhtCreditNotesList,
  type AiConversionReport,
  type DocumentIdentificationSummary,
  type RawEvidenceRow,
} from '../../lib/taxIntakeService';
import { mapExtractedFsJsonToCitState, mapFinancialStatementsToCitState } from '../../lib/fsToCitMapper';
import { generateFinancialStatementsWorkbookBytes } from '../../lib/financialWorkbookExport';
import { runTaxSavingsFinder } from '../../lib/taxSavingsFinder';
import { TaxSavingsFinderPanel } from './TaxSavingsFinderPanel';
import type { RovaTaxState, Sector } from '../../types/rovaTaxFlow';

const SECTORS: Sector[] = [
  'WHOLESALE AND RETAIL TRADE',
  'MANUFACTURING',
  'PROFESSIONAL SCIENTIFIC AND TECHNICAL ACTIVITIES',
  'COMMUNICATION & INFORMATION',
  'TRANSPORTATION AND HAULAGE',
  'CONSTRUCTION',
  'AGRICULTURE FORESTRY & FISHING',
  'ACCOMMODATION AND FOOD SERVICE ACTIVITIES',
  'REAL ESTATE ACTIVITIES',
  'EDUCATION',
  'ADMINISTRATIVE AND SUPPORT ACTIVITIES',
  'BANKS & OTHER FINANCIAL ACTIVITIES',
  'OIL AND GAS',
  'ART ENTERTAINMENT AND RECREATION',
  'DIGITAL AND VIRTUAL ASSETS',
  'Others',
];

const ASSET_CLASSES: StatutoryAssetClass[] = [
  'Computer & IT Infrastructure',
  'Office Furniture & Equipment',
  'Commercial Motor Vehicles',
  'Plant & Heavy Machinery',
  'Leasehold Land & Buildings',
];

interface TaxIntakeFlowProps {
  onCompleteToWizard: (hydratedState: RovaTaxState, fsModel?: FinancialStatementModel) => void;
  onSkipToManualWizard: () => void;
}

export function TaxIntakeFlow({ onCompleteToWizard, onSkipToManualWizard }: TaxIntakeFlowProps) {
  const { user, profile: authProfile } = useAuth();
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'questionnaire' | 'branch_a' | 'branch_b_collect' | 'branch_b_review'>('questionnaire');
  const [fiscalYear, setFiscalYear] = useState<number>(currentYear);
  const [hasPreparedFs, setHasPreparedFs] = useState<boolean | null>(null);

  // Rova bookkeeping records
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [includeRovaBooks, setIncludeRovaBooks] = useState(true);

  // Structured FS & Tax records
  const [fsProfile, setFsProfile] = useState<FinancialStatementProfile | null>(null);
  const [openingBalances, setOpeningBalances] = useState<CoaOpeningBalance[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAssetRecord[]>([]);
  const [whtNotes, setWhtNotes] = useState<WhtCreditNoteRecord[]>([]);

  // Branch A state
  const [fsUploading, setFsUploading] = useState(false);
  const [branchAExtracted, setBranchAExtracted] = useState<any>(null);
  const [branchAFileName, setBranchAFileName] = useState<string>('');
  const [branchAError, setBranchAError] = useState<string>('');

  // Branch B state
  const [rawEvidence, setRawEvidence] = useState<RawEvidenceRow[]>([]);
  const [documentSummaries, setDocumentSummaries] = useState<DocumentIdentificationSummary[]>([]);
  const [intakeEntries, setIntakeEntries] = useState<IntakeAccountingEntry[]>([]);
  const [aiReport, setAiReport] = useState<Omit<AiConversionReport, 'entries'> | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [confirmedForGeneration, setConfirmedForGeneration] = useState(false);
  const [branchAConfirmed, setBranchAConfirmed] = useState(false);
  const [parsingFiles, setParsingFiles] = useState(false);
  const [convertingAi, setConvertingAi] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showAssetsPanel, setShowAssetsPanel] = useState(false);
  const [showWhtPanel, setShowWhtPanel] = useState(false);
  const [showOpeningPanel, setShowOpeningPanel] = useState(false);

  // Quick add forms
  const [newAsset, setNewAsset] = useState({
    description: '',
    asset_class: 'Computer & IT Infrastructure' as StatutoryAssetClass,
    date_acquired: `${currentYear}-01-15`,
    historical_cost: '',
  });
  const [newWht, setNewWht] = useState({
    client_name: '',
    credit_note_no: '',
    deduction_date: `${currentYear}-06-01`,
    gross_amount: '',
    wht_rate: '0.05',
  });
  const [openingEquityInput, setOpeningEquityInput] = useState({
    shareCapital: '',
    retainedEarnings: '',
    openingCash: '',
  });

  useEffect(() => {
    if (user) loadAll();
  }, [user, fiscalYear]);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    try {
      const [wsData, txRes, accRes, invRes, billRes, itemRes, empRes] = await Promise.all([
        loadTaxWorkspaceData(user.id, fiscalYear),
        supabase.from('transactions').select('*, category:categories(*), account:accounts(*)').eq('user_id', user.id).order('date', { ascending: true }),
        supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('invoices').select('*').eq('user_id', user.id),
        supabase.from('bills').select('*').eq('user_id', user.id),
        supabase.from('inventory_items').select('*').eq('user_id', user.id),
        supabase.from('employees').select('*').eq('user_id', user.id),
      ]);

      const mergedProfile: FinancialStatementProfile = {
        ...wsData.profile,
        company_legal_name: wsData.profile.company_legal_name || authProfile?.business_name || authProfile?.full_name || '',
        rc_number: wsData.profile.rc_number || authProfile?.rc_bn_number || '',
        nature_of_business: wsData.profile.nature_of_business || authProfile?.business_type || '',
        sector: wsData.profile.sector || 'WHOLESALE AND RETAIL TRADE',
      };

      setFsProfile(mergedProfile);
      setOpeningBalances(wsData.openingBalances);
      setFixedAssets(wsData.fixedAssets);
      setWhtNotes(wsData.whtCreditNotes);
      setTransactions(txRes.data || []);
      setAccounts(accRes.data || []);
      setInvoices(invRes.data || []);
      setBills(billRes.data || []);
      setInventoryItems(itemRes.data || []);
      setEmployees(empRes.data || []);

      if (wsData.intakeSession?.extracted_entries?.length) {
        setIntakeEntries(wsData.intakeSession.extracted_entries);
      }
    } finally {
      setLoading(false);
    }
  }

  const periodTransactions = useMemo(
    () => transactions.filter((t) => new Date(t.date).getFullYear() === fiscalYear),
    [transactions, fiscalYear]
  );

  // Live Financial Statements model (updates dynamically as entries / assets / WHT change)
  const fsModel = useMemo<FinancialStatementModel | null>(() => {
    if (!fsProfile) return null;
    return computeFinancialStatementsModel({
      profile: fsProfile,
      openingBalances,
      transactions: includeRovaBooks ? (periodTransactions as any) : [],
      intakeEntries,
      bankAccounts: accounts,
      fixedAssets,
      whtCreditNotes: whtNotes,
      invoices,
      bills,
      inventoryItems,
    });
  }, [fsProfile, openingBalances, includeRovaBooks, periodTransactions, intakeEntries, accounts, fixedAssets, whtNotes, invoices, bills, inventoryItems]);

  const taxSavingsReport = useMemo(() => {
    return runTaxSavingsFinder({
      transactions: includeRovaBooks ? periodTransactions : [],
      intakeEntries,
      invoices,
      employees,
      fixedAssets,
      whtCreditNotes: whtNotes,
      fsModel,
      sector: fsProfile?.sector,
      turnover: branchAExtracted ? Number(branchAExtracted.revenue || 0) : undefined,
      grossFixedAssets: branchAExtracted ? Number(branchAExtracted.balanceSheet?.ppe || 0) : undefined,
      professionalServicesFlag: fsProfile?.professional_services_flag,
    });
  }, [includeRovaBooks, periodTransactions, intakeEntries, invoices, employees, fixedAssets, whtNotes, fsModel, fsProfile, branchAExtracted]);

  async function handleQuestionnaireNext() {
    if (!fsProfile || hasPreparedFs === null) return;
    await saveFsProfile(fsProfile);
    if (hasPreparedFs) {
      setStep('branch_a');
    } else {
      setStep('branch_b_collect');
    }
  }

  // ── Branch A Handlers ──────────────────────────────────────────────────────
  async function handleUploadFsFile(file: File) {
    setFsUploading(true);
    setBranchAError('');
    setBranchAFileName(file.name);
    setBranchAConfirmed(false);
    try {
      const extracted = await parseUploadedFinancialStatement(file, fiscalYear, customInstructions);
      setBranchAExtracted(extracted);
    } catch (err: any) {
      setBranchAError(err?.message || 'Could not parse uploaded financial statement. You can still load from Rova books or enter manually.');
    } finally {
      setFsUploading(false);
    }
  }

  function handleProceedBranchAFromUpload() {
    if (!fsProfile || !branchAExtracted || !branchAConfirmed) return;
    const hydrated = mapExtractedFsJsonToCitState(branchAExtracted, fsProfile);
    onCompleteToWizard(hydrated, fsModel || undefined);
  }

  function handleProceedFromModel() {
    if (!fsModel) return;
    const hydrated = mapFinancialStatementsToCitState(fsModel);
    onCompleteToWizard(hydrated, fsModel);
  }

  // ── Branch B Handlers ──────────────────────────────────────────────────────
  async function handleBankStatementFiles(files: FileList | null) {
    if (!files || files.length === 0 || !user) return;
    setParsingFiles(true);
    setStatusMessage('Stage 1–3: Identifying and verifying bank statement(s)...');
    try {
      const collected: RawEvidenceRow[] = [];
      const docInfos: DocumentIdentificationSummary[] = [];
      for (const file of Array.from(files)) {
        const { rows, documentInfo } = await parseBankStatementEvidence(file, user.id);
        collected.push(...rows);
        docInfos.push(documentInfo);
      }
      setRawEvidence((prev) => [...prev, ...collected]);
      setDocumentSummaries((prev) => [...prev, ...docInfos]);
      setConfirmedForGeneration(false);
      setStatusMessage(`Stage 1–3 complete: Extracted ${collected.length} transaction row(s) from ${docInfos.length} bank statement(s).`);
    } catch (err: any) {
      setStatusMessage(`Bank statement parse notice: ${err?.message || 'Please check file format'}`);
    } finally {
      setParsingFiles(false);
    }
  }

  async function handleReceiptFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setParsingFiles(true);
    setStatusMessage('Stage 1–2: Running OCR on receipt / invoice image(s)...');
    try {
      const collected: RawEvidenceRow[] = [];
      const docInfos: DocumentIdentificationSummary[] = [];
      for (const file of Array.from(files)) {
        const row = await parseReceiptEvidence(file);
        collected.push(row);
        docInfos.push({
          fileName: file.name,
          documentType: 'Receipt / Invoice',
          reportingPeriod: row.date,
          rowCount: 1,
          openingBalance: null,
          closingBalance: null,
          totalCredits: row.direction === 'income' ? row.amount : 0,
          totalDebits: row.direction === 'expense' ? row.amount : 0,
          reconciles: null,
          discrepancyAmount: 0,
          warnings: row.amount <= 0 ? ['Could not read total amount cleanly — please verify or clarify.'] : [],
        });
      }
      setRawEvidence((prev) => [...prev, ...collected]);
      setDocumentSummaries((prev) => [...prev, ...docInfos]);
      setConfirmedForGeneration(false);
      setStatusMessage(`Extracted ${collected.length} receipt / invoice record(s).`);
    } catch (err: any) {
      setStatusMessage(`OCR notice: ${err?.message || 'Some images could not be read cleanly'}`);
    } finally {
      setParsingFiles(false);
    }
  }

  async function handleConvertToEntries(overrideAnswers?: Record<string, string>) {
    if (!fsProfile || !user) return;
    setConvertingAi(true);
    setConfirmedForGeneration(false);
    setStatusMessage('Stages 4–9: DeepSeek AI is auditing and converting your records into double-entry accounting entries...');
    try {
      const report = await convertEvidenceToAccountingEntries(
        rawEvidence,
        `${fsProfile.company_legal_name} (${fsProfile.nature_of_business || fsProfile.sector})`,
        '1020',
        {
          customInstructions,
          clarificationAnswers: overrideAnswers ?? clarificationAnswers,
          documentSummaries,
        }
      );

      const { entries, usedFallback, ...auditMeta } = report;
      setAiReport({ ...auditMeta, usedFallback });

      // Include Rova live transactions mapped to COA if enabled and not already converted
      const rovaMapped = includeRovaBooks
        ? periodTransactions.map((tx) => mapTransactionToIntakeEntry(tx as any))
        : [];
      const combined = [...rovaMapped, ...entries];
      setIntakeEntries(entries);

      // Auto-register any Fixed Asset candidates discovered by DeepSeek
      const assetCandidates = entries.filter((e) => e.isFixedAssetCandidate && e.amount > 0);
      if (assetCandidates.length > 0) {
        const newFarItems: FixedAssetRecord[] = assetCandidates.map((c, idx) => ({
          id: `fa_ai_${Date.now()}_${idx}`,
          user_id: user.id,
          asset_code: `FA-${String(fixedAssets.length + idx + 1).padStart(3, '0')}`,
          description: c.description,
          asset_class: c.assetClass || 'Computer & IT Infrastructure',
          date_acquired: c.date,
          historical_cost: c.amount,
          prior_accum_depr: 0,
          opening_twdv: 0,
          status: 'Active',
        }));
        const updatedAssets = [...fixedAssets, ...newFarItems];
        setFixedAssets(updatedAssets);
        await saveFixedAssetsList(user.id, fiscalYear, updatedAssets);
      }

      await saveIntakeSession({
        user_id: user.id,
        fiscal_year: fiscalYear,
        has_prepared_fs: false,
        intake_status: 'reviewing_entries',
        uploaded_files: rawEvidence.map((r) => ({ id: r.id, file: r.sourceFileName, source: r.source })),
        extracted_entries: entries,
        suspense_resolutions: {},
        checklist_status: {},
        wizard_state: {},
        fs_snapshot: {},
      });

      const suspenseCount = combined.filter((e) => e.debitCode === '9999' || e.creditCode === '9999').length;
      setStatusMessage(
        `Converted ${entries.length} uploaded record(s)${usedFallback ? ' (local rules fallback)' : ' via DeepSeek AI'}. ${
          suspenseCount > 0 ? `${suspenseCount} item(s) placed in Account 9999 (Unclassified).` : 'All items classified!'
        }`
      );
      setStep('branch_b_review');
    } finally {
      setConvertingAi(false);
    }
  }

  function handleReclassifyEntry(entryId: string, newCoaCode: string) {
    const coaDef = COA_BY_CODE[newCoaCode];
    if (!coaDef) return;
    setIntakeEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry;
        const isSuspense = newCoaCode === '9999';
        return {
          ...entry,
          debitCode: entry.direction === 'expense' ? newCoaCode : entry.debitCode === '9999' ? '1020' : entry.debitCode,
          creditCode: entry.direction === 'income' ? newCoaCode : entry.creditCode === '9999' ? '1020' : entry.creditCode,
          nrsSection: coaDef.nrsSection || 'none',
          nrsLabel: coaDef.nrsDefaultLabel || entry.nrsLabel,
          taxTreatment: isSuspense ? 'suspense' : newCoaCode.startsWith('15') ? 'capital' : 'allowable',
          resolutionStatus: isSuspense ? 'Unresolved' : 'Resolved',
          clarificationQuestion: isSuspense ? entry.clarificationQuestion : null,
        };
      })
    );
  }

  async function handleAddFixedAsset() {
    if (!user || !newAsset.description || !newAsset.historical_cost) return;
    const item: FixedAssetRecord = {
      id: `fa_${Date.now()}`,
      user_id: user.id,
      asset_code: `FA-${String(fixedAssets.length + 1).padStart(3, '0')}`,
      description: newAsset.description,
      asset_class: newAsset.asset_class,
      date_acquired: newAsset.date_acquired,
      historical_cost: Number(newAsset.historical_cost) || 0,
      prior_accum_depr: 0,
      opening_twdv: 0,
      status: 'Active',
    };
    const next = [...fixedAssets, item];
    setFixedAssets(next);
    await saveFixedAssetsList(user.id, fiscalYear, next);
    setNewAsset({ description: '', asset_class: 'Computer & IT Infrastructure', date_acquired: `${fiscalYear}-01-15`, historical_cost: '' });
  }

  async function handleAddWhtNote() {
    if (!user || !newWht.client_name || !newWht.gross_amount) return;
    const gross = Number(newWht.gross_amount) || 0;
    const rate = Number(newWht.wht_rate) || 0.05;
    const deducted = Math.round(gross * rate * 100) / 100;
    const item: WhtCreditNoteRecord = {
      id: `wht_${Date.now()}`,
      user_id: user.id,
      fiscal_year: fiscalYear,
      client_name: newWht.client_name,
      credit_note_no: newWht.credit_note_no || `WHT-${whtNotes.length + 1}`,
      deduction_date: newWht.deduction_date,
      nature_of_supply: rate === 0.1 ? 'Professional / Technical Services' : 'Supplies / Contracts',
      gross_amount: gross,
      wht_rate: rate,
      wht_deducted: deducted,
      verification_status: 'Pending Verification',
      amount_utilized: deducted,
    };
    const next = [...whtNotes, item];
    setWhtNotes(next);
    await saveWhtCreditNotesList(user.id, fiscalYear, next);
    setNewWht({ client_name: '', credit_note_no: '', deduction_date: `${fiscalYear}-06-01`, gross_amount: '', wht_rate: '0.05' });
  }

  async function handleSaveOpeningBalances() {
    if (!user) return;
    const sc = Number(openingEquityInput.shareCapital) || 0;
    const re = Number(openingEquityInput.retainedEarnings) || 0;
    const cash = Number(openingEquityInput.openingCash) || (sc + re);
    const list: CoaOpeningBalance[] = [
      { user_id: user.id, fiscal_year: fiscalYear, account_code: '1020', opening_debit: cash, opening_credit: 0 },
      { user_id: user.id, fiscal_year: fiscalYear, account_code: '3010', opening_debit: 0, opening_credit: sc },
      { user_id: user.id, fiscal_year: fiscalYear, account_code: '3020', opening_debit: 0, opening_credit: re },
    ].filter((b) => b.opening_debit > 0 || b.opening_credit > 0);
    setOpeningBalances(list);
    await saveOpeningBalancesList(user.id, fiscalYear, list);
    setShowOpeningPanel(false);
  }

  async function handleDownloadFinancialWorkbook() {
    if (!fsModel) return;
    const bytes = await generateFinancialStatementsWorkbookBytes(fsModel);
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ROVA_Financial_Statements_${fiscalYear}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadDeepSeekJson() {
    if (!fsModel) return;
    const payload = {
      fiscalYear,
      profile: fsModel.profile,
      documentIdentification: documentSummaries,
      classifiedEntries: intakeEntries,
      financialStatements: {
        incomeStatement: fsModel.incomeStatement,
        balanceSheet: fsModel.balanceSheet,
        changesInEquity: fsModel.changesInEquity,
        cashFlowIndirect: fsModel.cashFlowIndirect,
      },
      taxComputation: fsModel.taxComputation,
      auditChecks: fsModel.auditChecks,
      aiQualityControl: aiReport,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ROVA_DeepSeek_FS_${fiscalYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !fsProfile) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading ROVA books & tax workspace...
      </div>
    );
  }

  const passCount = fsModel?.auditChecks.filter((c) => c.status === 'PASS').length || 0;

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Intake Progress Banner */}
      <div
        style={{
          padding: '18px 22px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            NRS CIT Smart Tax Prep (NTA 2025)
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 2px', color: 'var(--text-primary)' }}>
            {step === 'questionnaire' && 'Step 1: Quick Tax Filing Questionnaire'}
            {step === 'branch_a' && 'Step 2A: Import or Load Your Financial Statements'}
            {step === 'branch_b_collect' && 'Step 2B: Collect Business Records, Bank Statements & Receipts'}
            {step === 'branch_b_review' && 'Step 3: Review Financial Statements & Auto-Fill CIT Wizard'}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            {step === 'questionnaire' && 'Answer a few short questions so Rova prepares your Financial Statements and NRS CIT return automatically.'}
            {step === 'branch_a' && 'Upload your prepared Financial Statement or use Rova live books to pre-fill the NRS CIT Wizard.'}
            {step === 'branch_b_collect' && 'Upload bank statements, receipts, or invoices — DeepSeek AI converts them into balanced accounting entries.'}
            {step === 'branch_b_review' && 'Review any unclassified (9999) items, verify the 11 audit controls, and proceed to the NRS CIT Wizard.'}
          </p>
        </div>
        <button
          onClick={onSkipToManualWizard}
          style={{
            padding: '8px 14px',
            background: 'var(--bg-base)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Skip to Blank CIT Wizard
        </button>
      </div>

      {/* ── STEP 1: SHORT QUESTIONNAIRE ───────────────────────────────────────── */}
      {step === 'questionnaire' && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Company Legal Name
              </label>
              <input
                value={fsProfile.company_legal_name}
                onChange={(e) => setFsProfile({ ...fsProfile, company_legal_name: e.target.value })}
                placeholder="e.g. Rova Ventures Ltd"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                CAC RC Number
              </label>
              <input
                value={fsProfile.rc_number}
                onChange={(e) => setFsProfile({ ...fsProfile, rc_number: e.target.value })}
                placeholder="e.g. RC 1234567"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                NRS Tax Identification Number (TIN)
              </label>
              <input
                value={fsProfile.tin}
                onChange={(e) => setFsProfile({ ...fsProfile, tin: e.target.value })}
                placeholder="e.g. 12345678-0001"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Assessment / Fiscal Year
              </label>
              <select
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
              >
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Primary Business Sector
              </label>
              <select
                value={fsProfile.sector}
                onChange={(e) => setFsProfile({ ...fsProfile, sector: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Do you provide Professional / Technical Consulting Services?
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'No (Standard Trade / SME)', val: false },
                  { label: 'Yes (Professional Firm)', val: true },
                ].map((opt) => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => setFsProfile({ ...fsProfile, professional_services_flag: opt.val })}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${fsProfile.professional_services_flag === opt.val ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                      background: fsProfile.professional_services_flag === opt.val ? 'var(--accent-dim)' : 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Core Routing Question */}
          <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: 20 }}>
            <label style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Do you already have a prepared Financial Statement for {fiscalYear}?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <button
                type="button"
                onClick={() => setHasPreparedFs(true)}
                style={{
                  textAlign: 'left',
                  padding: 18,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${hasPreparedFs === true ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                  background: hasPreparedFs === true ? 'var(--accent-dim)' : 'var(--bg-base)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>
                  <FileSpreadsheet size={18} color="var(--accent-light)" />
                  Yes, I have Financial Statements
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Upload your Financial Statements (Excel, CSV, PDF, or Image) or load directly from your Rova Books to jump straight to the CIT Wizard.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setHasPreparedFs(false)}
                style={{
                  textAlign: 'left',
                  padding: 18,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${hasPreparedFs === false ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                  background: hasPreparedFs === false ? 'var(--accent-dim)' : 'var(--bg-base)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>
                  <Sparkles size={18} color="var(--accent-light)" />
                  No, prepare them from my records
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Upload bank statements, receipts, and invoices. DeepSeek AI converts them into accounting entries, fills the Financial Statements, and feeds the CIT Wizard.
                </p>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              disabled={hasPreparedFs === null}
              onClick={handleQuestionnaireNext}
              style={{
                padding: '11px 24px',
                background: hasPreparedFs === null ? 'var(--bg-border)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: 14,
                cursor: hasPreparedFs === null ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── BRANCH A: HAS FINANCIAL STATEMENTS ────────────────────────────────── */}
      {step === 'branch_a' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {/* Card 1: Upload FS or DeepSeek JSON */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Upload size={20} color="var(--accent-light)" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Upload Financial Statement or JSON</h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Upload Excel (`.xlsx`), CSV, PDF, Image, or a **DeepSeek JSON** file. Rova extracts &amp; verifies the figures before filling the CIT template.
            </p>
            <label
              style={{
                border: '2px dashed var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                padding: 20,
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--bg-base)',
              }}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.json"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleUploadFsFile(e.target.files[0])}
              />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {fsUploading ? 'Extracting Financial Statements via DeepSeek...' : branchAFileName || 'Click to choose Financial Statement or JSON'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>XLSX, CSV, PDF, PNG, JPG, JSON</div>
            </label>
            {branchAError && <div style={{ fontSize: 12, color: 'var(--error)' }}>{branchAError}</div>}
            {branchAExtracted && (
              <div style={{ padding: 12, background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <strong style={{ color: 'var(--accent-light)' }}>Pre-Generation Summary</strong>
                <div>Revenue: <strong>₦{Number(branchAExtracted.revenue || 0).toLocaleString()}</strong> · PPE: <strong>₦{Number(branchAExtracted.balanceSheet?.ppe || 0).toLocaleString()}</strong></div>
                <div>Net Assets/Equity: <strong>₦{(Number(branchAExtracted.balanceSheet?.shareCapital || 0) + Number(branchAExtracted.balanceSheet?.retainedEarnings || 0)).toLocaleString()}</strong></div>
                {Array.isArray(branchAExtracted.questionsForUser) && branchAExtracted.questionsForUser.length > 0 && (
                  <div style={{ color: 'var(--warning)' }}>
                    <strong>AI Questions:</strong> {branchAExtracted.questionsForUser.join(' · ')}
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={branchAConfirmed} onChange={(e) => setBranchAConfirmed(e.target.checked)} />
                  I confirm this summary is accurate to fill the CIT Wizard
                </label>
              </div>
            )}
            <button
              type="button"
              disabled={!branchAExtracted || fsUploading || !branchAConfirmed}
              onClick={handleProceedBranchAFromUpload}
              style={{
                marginTop: 'auto',
                padding: '10px 18px',
                background: branchAExtracted && branchAConfirmed ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))' : 'var(--bg-border)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: 13,
                cursor: branchAExtracted && branchAConfirmed ? 'pointer' : 'not-allowed',
              }}
            >
              Confirm &amp; Auto-Fill CIT Wizard →
            </button>
          </div>

          {/* Card 2: Load from ROVA Books */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Building2 size={20} color="var(--success)" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Use ROVA Live Financial Statements</h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Found <strong>{periodTransactions.length}</strong> bookkeeping transaction(s) in {fiscalYear}. Review the summary below before generating files or entering the CIT Wizard.
            </p>
            {fsModel && (
              <div style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Revenue:</span><strong>₦{fsModel.incomeStatement.revenue.toLocaleString()}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Profit Before Tax:</span><strong>₦{fsModel.incomeStatement.profitBeforeTax.toLocaleString()}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total Assets:</span><strong>₦{fsModel.balanceSheet.totalAssets.toLocaleString()}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Audit Integrity:</span><strong>{passCount}/11 PASS</strong></div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={confirmedForGeneration} onChange={(e) => setConfirmedForGeneration(e.target.checked)} />
                  I confirm this summary to generate documents
                </label>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <button
                type="button"
                disabled={!confirmedForGeneration}
                onClick={handleDownloadFinancialWorkbook}
                style={{ padding: '10px 14px', background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: confirmedForGeneration ? 'pointer' : 'not-allowed', opacity: confirmedForGeneration ? 1 : 0.5 }}
              >
                Download FS (.xlsx)
              </button>
              <button
                type="button"
                disabled={!confirmedForGeneration}
                onClick={handleProceedFromModel}
                style={{
                  flex: 1,
                  padding: '10px 18px',
                  background: confirmedForGeneration ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))' : 'var(--bg-border)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: confirmedForGeneration ? 'pointer' : 'not-allowed',
                }}
              >
                Confirm &amp; Auto-Fill CIT Wizard →
              </button>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <TaxSavingsFinderPanel
              report={taxSavingsReport}
              onApplyConfirmed={(confirmedIds) => {
                setStatusMessage(`Applied ${confirmedIds.length} confirmed exemption/deduction item(s) — remember to review with your accountant before filing.`);
              }}
            />
          </div>
        </div>
      )}

      {/* ── BRANCH B: COLLECT EVIDENCE & RAW RECORDS ──────────────────────────── */}
      {step === 'branch_b_collect' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* 1. Rova Live Books */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                  <FileText size={16} color="var(--accent-light)" /> Rova Bookkeeping Records
                </span>
                <input type="checkbox" checked={includeRovaBooks} onChange={(e) => setIncludeRovaBooks(e.target.checked)} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {periodTransactions.length} transactions, {invoices.length} invoices, {bills.length} bills, {accounts.length} bank accounts for {fiscalYear}.
              </p>
            </div>

            {/* 2. Bank Statements Upload */}
            <label style={{ background: 'var(--bg-elevated)', border: '2px dashed var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 20, cursor: 'pointer', display: 'block' }}>
              <input
                type="file"
                multiple
                accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={(e) => handleBankStatementFiles(e.target.files)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                <Landmark size={16} color="var(--success)" /> Upload Bank Statements
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                CSV, Excel (.xlsx), PDF, or Image statements.
              </p>
            </label>

            {/* 3. Receipts & Invoices Upload */}
            <label style={{ background: 'var(--bg-elevated)', border: '2px dashed var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 20, cursor: 'pointer', display: 'block' }}>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={(e) => handleReceiptFiles(e.target.files)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                <Receipt size={16} color="var(--warning)" /> Upload Receipts / Invoices
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                Images (JPG/PNG) or PDFs — extracted via OCR + DeepSeek.
              </p>
            </label>
          </div>

          {/* Optional Quick Statutory Prompts: Fixed Assets, WHT Credits, Opening Balances */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowAssetsPanel((v) => !v)}
              style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + Fixed Assets ({fixedAssets.length})
            </button>
            <button
              type="button"
              onClick={() => setShowWhtPanel((v) => !v)}
              style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + WHT Credit Notes ({whtNotes.length})
            </button>
            <button
              type="button"
              onClick={() => setShowOpeningPanel((v) => !v)}
              style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + Opening Balances ({openingBalances.length})
            </button>
          </div>

          {showAssetsPanel && (
            <div style={{ padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong style={{ fontSize: 13 }}>Fixed Assets Register (Section 4.1)</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 8 }}>
                <input placeholder="Asset description (e.g. MacBook Pro)" value={newAsset.description} onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                <select value={newAsset.asset_class} onChange={(e) => setNewAsset({ ...newAsset, asset_class: e.target.value as StatutoryAssetClass })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                  {ASSET_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="date" value={newAsset.date_acquired} onChange={(e) => setNewAsset({ ...newAsset, date_acquired: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                <input type="number" placeholder="Cost (₦)" value={newAsset.historical_cost} onChange={(e) => setNewAsset({ ...newAsset, historical_cost: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                <button type="button" onClick={handleAddFixedAsset} style={{ padding: '8px 12px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}><Plus size={14} /></button>
              </div>
              {fixedAssets.map((a) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 8px', background: 'var(--bg-base)', borderRadius: 6 }}>
                  <span>{a.asset_code} · {a.description} ({a.asset_class})</span>
                  <span>₦{Number(a.historical_cost).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {showWhtPanel && (
            <div style={{ padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong style={{ fontSize: 13 }}>WHT Credit Notes Claimed (Section 8.2)</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8 }}>
                <input placeholder="Client / Deducting Entity" value={newWht.client_name} onChange={(e) => setNewWht({ ...newWht, client_name: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                <input placeholder="Credit Note No." value={newWht.credit_note_no} onChange={(e) => setNewWht({ ...newWht, credit_note_no: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                <input type="number" placeholder="Gross Amount (₦)" value={newWht.gross_amount} onChange={(e) => setNewWht({ ...newWht, gross_amount: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                <select value={newWht.wht_rate} onChange={(e) => setNewWht({ ...newWht, wht_rate: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                  <option value="0.05">5% (Supplies)</option>
                  <option value="0.1">10% (Services)</option>
                </select>
                <button type="button" onClick={handleAddWhtNote} style={{ padding: '8px 12px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}><Plus size={14} /></button>
              </div>
              {whtNotes.map((w) => (
                <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 8px', background: 'var(--bg-base)', borderRadius: 6 }}>
                  <span>{w.client_name} ({w.credit_note_no})</span>
                  <span>WHT Deducted: ₦{Number(w.wht_deducted).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {showOpeningPanel && (
            <div style={{ padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong style={{ fontSize: 13 }}>Opening Balances (Prior Year Carry-Over)</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8 }}>
                <input type="number" placeholder="Opening Share Capital (₦)" value={openingEquityInput.shareCapital} onChange={(e) => setOpeningEquityInput({ ...openingEquityInput, shareCapital: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                <input type="number" placeholder="Opening Retained Earnings (₦)" value={openingEquityInput.retainedEarnings} onChange={(e) => setOpeningEquityInput({ ...openingEquityInput, retainedEarnings: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                <input type="number" placeholder="Opening Bank Cash (₦)" value={openingEquityInput.openingCash} onChange={(e) => setOpeningEquityInput({ ...openingEquityInput, openingCash: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                <button type="button" onClick={handleSaveOpeningBalances} style={{ padding: '8px 14px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Save</button>
              </div>
            </div>
          )}

          {/* Special Filing Instructions for DeepSeek AI (Optional) */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
              Special Filing Instructions for ROVA AI (Optional)
            </label>
            <textarea
              rows={2}
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder='e.g. "All transfers to ABC Logistics are Freight/COGS (5030). Personal transfers from John should go to Director Loan (2520)."'
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          {statusMessage && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
              {statusMessage}
            </div>
          )}

          {/* Stage 1-3 Document Identification & Reconciliation */}
          {documentSummaries.length > 0 && (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                Stage 1–3 Document Identification &amp; Reconciliation ({documentSummaries.length} document(s))
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {documentSummaries.map((doc, idx) => (
                  <div key={`${doc.fileName}_${idx}`} style={{ padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 6, fontSize: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <strong>{doc.fileName}</strong> · {doc.documentType} ({doc.rowCount} row(s){doc.reportingPeriod ? `, ${doc.reportingPeriod}` : ''})
                      {doc.warnings.length > 0 && <div style={{ color: 'var(--warning)', fontSize: 11 }}>{doc.warnings.join(' · ')}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ color: 'var(--success)' }}>Credits: ₦{doc.totalCredits.toLocaleString()}</span>
                      <span style={{ color: 'var(--error)' }}>Debits: ₦{doc.totalDebits.toLocaleString()}</span>
                      {doc.reconciles !== null && (
                        <span style={{ fontWeight: 700, color: doc.reconciles ? 'var(--success)' : 'var(--warning)' }}>
                          {doc.reconciles ? 'Reconciled' : `Diff: ₦${doc.discrepancyAmount.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Evidence Preview Table */}
          {rawEvidence.length > 0 && (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                Uploaded Evidence Queue ({rawEvidence.length} records)
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rawEvidence.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-base)', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.date} · {r.description}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: r.direction === 'income' ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                        {r.direction === 'income' ? '+' : '-'}₦{r.amount.toLocaleString()}
                      </span>
                      <button type="button" onClick={() => setRawEvidence((prev) => prev.filter((x) => x.id !== r.id))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" onClick={() => setStep('questionnaire')} style={{ padding: '10px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
              ← Back
            </button>
            <button
              type="button"
              disabled={parsingFiles || convertingAi || (rawEvidence.length === 0 && periodTransactions.length === 0)}
              onClick={() => handleConvertToEntries()}
              style={{
                padding: '11px 22px',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Sparkles size={16} />
              {convertingAi ? 'Auditing & Converting with DeepSeek AI...' : 'Analyze, Classify & Show Pre-Generation Summary →'}
            </button>
          </div>
        </div>
      )}

      {/* ── BRANCH B REVIEW: CLARIFICATION QUESTIONS + PRE-GENERATION SUMMARY & CONFIRMATION ── */}
      {step === 'branch_b_review' && fsModel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Clarification Questions & Account 9999 Panel */}
          {(fsModel.suspenseLog.length > 0 || (aiReport?.questionsForUser && aiReport.questionsForUser.length > 0)) && (
            <div style={{ padding: 18, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--warning)' }}>
                  <AlertTriangle size={18} />
                  Clarification Needed ({fsModel.suspenseLog.length} Unclassified in Account 9999)
                </div>
                {Object.keys(clarificationAnswers).length > 0 && rawEvidence.length > 0 && (
                  <button
                    type="button"
                    disabled={convertingAi}
                    onClick={() => handleConvertToEntries(clarificationAnswers)}
                    style={{ padding: '6px 12px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {convertingAi ? 'Re-classifying...' : 'Apply Answers & Re-verify with DeepSeek'}
                  </button>
                )}
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                Where classification was uncertain, transactions were safely placed in Account 9999 (excluded from revenue, expenses &amp; tax deductions). Answer below or pick the exact account:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fsModel.suspenseLog.map((item) => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{item.date} · {item.description} — ₦{item.amount.toLocaleString()}</div>
                        {item.clarificationQuestion && <div style={{ color: 'var(--warning)', fontSize: 11, marginTop: 2 }}>{item.clarificationQuestion}</div>}
                      </div>
                      <select
                        defaultValue="9999"
                        onChange={(e) => handleReclassifyEntry(item.id, e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 12 }}
                      >
                        <option value="9999">Keep in 9999 (Unclassified)</option>
                        {STANDARD_NIGERIA_COA.filter((a) => a.code !== '9999').map((a) => (
                          <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder="Or type an explanation for DeepSeek AI (e.g. 'Diesel purchase for office generator')"
                      value={clarificationAnswers[item.id] || ''}
                      onChange={(e) => setClarificationAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 12 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rova Tax Savings Finder (NTA 2025 Exemptions & Deductions) */}
          <TaxSavingsFinderPanel
            report={taxSavingsReport}
            onApplyConfirmed={(confirmedIds) => {
              setStatusMessage(`Confirmed ${confirmedIds.length} eligible exemption/deduction item(s) for review with your accountant.`);
            }}
          />

          {/* Stage 6-10 Pre-Generation Summary & Quality Control Report */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Pre-Generation Summary &amp; Quality Control Review (Stages 6–10)
            </div>

            {/* Summary Financial Statements & NTA 2025 Tax Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ padding: 14, background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Turnover (P&amp;L)</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>₦{fsModel.incomeStatement.revenue.toLocaleString()}</div>
              </div>
              <div style={{ padding: 14, background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Profit Before Tax</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>₦{fsModel.incomeStatement.profitBeforeTax.toLocaleString()}</div>
              </div>
              <div style={{ padding: 14, background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Assets / Closing Cash</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>₦{fsModel.balanceSheet.totalAssets.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cash: ₦{fsModel.balanceSheet.cashAndCashEquivalents.toLocaleString()}</div>
              </div>
              <div style={{ padding: 14, background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>NTA 2025 Net Tax Payable</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: 'var(--accent-light)' }}>
                  ₦{fsModel.taxComputation.netCurrentTaxPayable.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {fsModel.taxComputation.qualifiesSmallCompanyExemption ? 'Small Company (0% CIT)' : 'Standard (27.5% CIT + 4% Dev Levy)'}
                </div>
              </div>
            </div>

            {/* AI Quality Control Findings (Duplicates, Missing Info, Adjustments) */}
            {aiReport && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, fontSize: 12 }}>
                {aiReport.qualityControlSummary && (
                  <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--bg-border)' }}>
                    <strong>Quality Control Reviews A &amp; B:</strong>
                    <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{aiReport.qualityControlSummary.extractionReview}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{aiReport.qualityControlSummary.accountingReview}</div>
                  </div>
                )}
                {(aiReport.missingDocuments.length > 0 || aiReport.duplicatesDetected.length > 0 || aiReport.adjustmentsIdentified.length > 0) && (
                  <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--bg-border)' }}>
                    {aiReport.adjustmentsIdentified.length > 0 && <div><strong>Adjustments:</strong> {aiReport.adjustmentsIdentified.join('; ')}</div>}
                    {aiReport.missingDocuments.length > 0 && <div style={{ color: 'var(--warning)', marginTop: 4 }}><strong>Missing Info:</strong> {aiReport.missingDocuments.join('; ')}</div>}
                    {aiReport.duplicatesDetected.length > 0 && <div style={{ color: 'var(--warning)', marginTop: 4 }}><strong>Potential Duplicates:</strong> {aiReport.duplicatesDetected.join('; ')}</div>}
                  </div>
                )}
              </div>
            )}

            {/* 11 Audit Integrity Checks (CHK-01..CHK-11) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 }}>
                <ShieldCheck size={16} color="var(--success)" /> Mathematical &amp; Integrity Checks ({passCount}/11 PASS)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 8 }}>
              {fsModel.auditChecks.map((chk) => (
                <div key={chk.testNo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg-base)', borderRadius: 6, fontSize: 12 }}>
                  <span><strong>{chk.testNo}:</strong> {chk.testName}</span>
                  <span style={{ fontWeight: 700, color: chk.status === 'PASS' ? 'var(--success)' : 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> {chk.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Confirmation Gate before any document is generated */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: confirmedForGeneration ? 'var(--success-dim)' : 'var(--bg-base)', border: `1px solid ${confirmedForGeneration ? 'var(--success)' : 'var(--accent-border)'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={confirmedForGeneration}
                onChange={(e) => setConfirmedForGeneration(e.target.checked)}
              />
              I confirm this Pre-Generation Summary is accurate and authorize Rova to generate the Financial Statements, JSON, and NRS CIT Template.
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" onClick={() => setStep('branch_b_collect')} style={{ padding: '10px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
              ← Add More Records
            </button>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={!confirmedForGeneration}
                onClick={handleDownloadDeepSeekJson}
                style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: confirmedForGeneration ? 'pointer' : 'not-allowed', opacity: confirmedForGeneration ? 1 : 0.45 }}
              >
                Download DeepSeek JSON
              </button>
              <button
                type="button"
                disabled={!confirmedForGeneration}
                onClick={handleDownloadFinancialWorkbook}
                style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: confirmedForGeneration ? 'pointer' : 'not-allowed', opacity: confirmedForGeneration ? 1 : 0.45, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <FileSpreadsheet size={14} /> Download Financial Statements (.xlsx)
              </button>
              <button
                type="button"
                disabled={!confirmedForGeneration}
                onClick={handleProceedFromModel}
                style={{
                  padding: '12px 24px',
                  background: confirmedForGeneration ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))' : 'var(--bg-border)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: confirmedForGeneration ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                Auto-Fill NRS CIT Filing Wizard &amp; Generate Tax Template <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
