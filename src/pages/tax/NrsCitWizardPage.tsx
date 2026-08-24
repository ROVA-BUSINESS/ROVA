
import { useState } from 'react';
import { ArrowLeft, ArrowRight, AlertTriangle, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRovaTaxFlow } from './useRovaTaxFlow';
import { AssetEntryCard } from '../../components/tax/AssetEntryCard';
import { ChipSelect } from '../../components/tax/ChipSelect';
import { ChipSelectAmount } from '../../components/tax/ChipSelectAmount';
import { GateBlock } from '../../components/tax/GateBlock';
import { LiveLedgerSidebar } from '../../components/tax/LiveLedgerSidebar';
import type { Sector } from '../../types/rovaTaxFlow';

const STAGES = [
  { id: 'fixed_assets', label: 'Capital allowance', title: 'Fixed assets' },
  { id: 'mne_cfc', label: 'Group structure', title: 'MNE / CFC check' },
  { id: 'year', label: 'Filing period', title: 'Year of assessment' },
  { id: 'sector', label: 'Classification', title: 'Business sector' },
  { id: 'revenue', label: 'Added — confirmed', title: 'Revenue' },
  { id: 'cost_of_sales', label: 'Direct cost', title: 'Cost of sales' },
  { id: 'pnl', label: 'Computed', title: 'Profit or Loss' },
  { id: 'sfp', label: 'Balance sheet', title: 'Statement of Financial Position' },
  { id: 'adjustment', label: 'Add-backs & deductions', title: 'Profit adjustment' },
  { id: 'admin', label: 'Select any applicable', title: 'Administrative expense' },
  { id: 'done', label: 'Review & sign', title: 'Done' }
];

const SECTORS: Sector[] = [
  'MANUFACTURING', 'AGRICULTURE FORESTRY & FISHING', 'MINING & QUARRY', 'ELECTRICITY',
  'WATER SUPPLY SEWERAGE & WASTE MANAGEMENT', 'CONSTRUCTION', 'WHOLESALE AND RETAIL TRADE',
  'TRANSPORTATION AND HAULAGE', 'ACCOMMODATION AND FOOD SERVICE ACTIVITIES', 'COMMUNICATION & INFORMATION',
  'BANKS & OTHER FINANCIAL ACTIVITIES', 'INSURANCE ACTIVITIES', 'REAL ESTATE ACTIVITIES',
  'PROFESSIONAL SCIENTIFIC AND TECHNICAL ACTIVITIES', 'ADMINISTRATIVE AND SUPPORT ACTIVITIES',
  'EDUCATION', 'OIL AND GAS', 'NGOs NFPOs RELIGIOUS INSTITUTIONS', 'ART ENTERTAINMENT AND RECREATION',
  'DIGITAL AND VIRTUAL ASSETS', 'Others'
];

export default function NrsCitWizardPage() {
  const navigate = useNavigate();
  const { state, computed, updateState } = useRovaTaxFlow();
  const [currentStep, setCurrentStep] = useState(0);

  const stage = STAGES[currentStep];

  const handleNext = () => {
    if (currentStep < STAGES.length - 1) {
      setCurrentStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const mneCfcFlagged = state.mneCfc.isMNE === true || state.mneCfc.isCFC === true;

  const renderStepContent = () => {
    switch (stage.id) {
      case 'fixed_assets':
        return (
          <div>
            <div style={{ marginBottom: 16 }}>
              {state.assets.map((asset, idx) => {
                const calc = computed.assetCalcs[idx];
                return (
                  <AssetEntryCard
                    key={asset.id}
                    asset={asset}
                    salvageValue={calc?.salvageValue || 0}
                    annualDepreciation={calc?.annualDepreciation || 0}
                    onChange={(updated) => {
                      const newAssets = [...state.assets];
                      newAssets[idx] = updated;
                      updateState(prev => ({ ...prev, assets: newAssets }));
                    }}
                    onRemove={() => {
                      updateState(prev => ({ ...prev, assets: prev.assets.filter(a => a.id !== asset.id) }));
                    }}
                  />
                );
              })}
            </div>
            <button
              onClick={() => {
                updateState(prev => ({
                  ...prev,
                  assets: [...prev.assets, { id: Date.now().toString(), dateFirstUsed: '', cost: 0, description: '', category: '' }]
                }));
              }}
              style={{
                padding: '10px 16px', background: 'var(--bg-elevated)', border: '1px dashed var(--bg-border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: 600,
                cursor: 'pointer', width: '100%'
              }}
            >
              + Add another asset
            </button>
            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total capital allowance: </span>
              <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>₦{computed.totalCapitalAllowance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          </div>
        );

      case 'mne_cfc':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 12 }}>Are you part of a Multinational Enterprise (MNE) Group?</label>
              <ChipSelect
                isMulti={false}
                options={['Yes', 'No']}
                selectedOptions={state.mneCfc.isMNE === true ? ['Yes'] : state.mneCfc.isMNE === false ? ['No'] : []}
                onChange={([val]) => updateState(prev => ({ ...prev, mneCfc: { ...prev.mneCfc, isMNE: val === 'Yes' } }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 12 }}>Is any of your constituent entities a Controlled Foreign Company (CFC)?</label>
              <ChipSelect
                isMulti={false}
                options={['Yes', 'No']}
                selectedOptions={state.mneCfc.isCFC === true ? ['Yes'] : state.mneCfc.isCFC === false ? ['No'] : []}
                onChange={([val]) => updateState(prev => ({ ...prev, mneCfc: { ...prev.mneCfc, isCFC: val === 'Yes' } }))}
              />
            </div>
            {mneCfcFlagged && (
              <div style={{ padding: 16, background: 'var(--error-dim)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', color: 'var(--error)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 8 }}>
                  <AlertTriangle size={18} /> Please consult a tax professional
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                  This filing path doesn't cover CFC / MNE cases. It is highly recommended that you reach out to a tax professional to complete your filing.
                </p>
              </div>
            )}
          </div>
        );

      case 'year':
        return (
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 12 }}>Year of assessment</label>
            <input
              type="text"
              placeholder="e.g. 2026"
              value={state.yearOfAssessment}
              onChange={e => updateState(prev => ({ ...prev, yearOfAssessment: e.target.value }))}
              style={{
                width: '100%', maxWidth: 300, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)'
              }}
            />
          </div>
        );

      case 'sector':
        return (
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 12 }}>Business sector</label>
            <ChipSelect
              isMulti={false}
              options={SECTORS}
              selectedOptions={state.sector ? [state.sector] : []}
              onChange={([val]) => updateState(prev => ({ ...prev, sector: (val as Sector) || '' }))}
            />
          </div>
        );

      case 'revenue':
        return (
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 12 }}>What was your total revenue for the year?</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>₦</span>
              <input
                type="number"
                placeholder="0.00"
                value={state.revenue === null ? '' : state.revenue}
                onChange={e => updateState(prev => ({ ...prev, revenue: e.target.value ? Number(e.target.value) : null }))}
                style={{
                  width: '100%', maxWidth: 300, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>
        );

      case 'cost_of_sales':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <GateBlock title="Opening inventory" isOpen>
              <ChipSelectAmount
                options={['Raw materials', 'Work in progress', 'Finished goods']}
                value={state.costOfSales.openingInventory}
                onChange={val => updateState(prev => ({ ...prev, costOfSales: { ...prev.costOfSales, openingInventory: val } }))}
              />
            </GateBlock>
            <GateBlock title="Purchases (raw materials / finished goods)">
              <ChipSelectAmount
                options={['Local Purchases', 'Import Purchases']}
                value={state.costOfSales.purchases}
                onChange={val => updateState(prev => ({ ...prev, costOfSales: { ...prev.costOfSales, purchases: val } }))}
              />
            </GateBlock>
            <GateBlock title="Other direct cost">
              <ChipSelectAmount
                options={['Direct wages', 'Direct expenses', 'Other Direct costs']}
                value={state.costOfSales.otherDirectCost}
                onChange={val => updateState(prev => ({ ...prev, costOfSales: { ...prev.costOfSales, otherDirectCost: val } }))}
              />
            </GateBlock>
            <GateBlock title="Factory overheads">
              <ChipSelectAmount
                options={['Factory Rent', 'Factory Rates', 'Fuel and Power', 'Indirect Wages', 'Other Factory Overheads']}
                value={state.costOfSales.factoryOverheads}
                onChange={val => updateState(prev => ({ ...prev, costOfSales: { ...prev.costOfSales, factoryOverheads: val } }))}
              />
            </GateBlock>
            <GateBlock title="Closing inventory">
              <ChipSelectAmount
                options={['Raw materials', 'Work In Progress', 'Finished goods']}
                value={state.costOfSales.closingInventory}
                onChange={val => updateState(prev => ({ ...prev, costOfSales: { ...prev.costOfSales, closingInventory: val } }))}
              />
            </GateBlock>
          </div>
        );

      case 'pnl':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 12, background: 'var(--accent-dim)', color: 'var(--accent-light)', fontSize: 13, borderRadius: 'var(--radius-md)' }}>
              <HelpCircle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              Profit before and after tax are the same figure under the Tax Act 2025.
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', padding: '16px 24px' }}>
              <PnlRow label="Revenue" value={computed.revenue} />
              <PnlRow label="Direct Cost" value={computed.directCost} isNegative />
              <hr style={{ borderTop: '1px solid var(--bg-border)', borderBottom: 'none', margin: '8px 0' }} />
              <PnlRow label="Gross Profit" value={computed.grossProfit} bold />
              <PnlRow label="Administrative expenses" value={computed.adminExpensesTotal} isNegative />
              <hr style={{ borderTop: '1px solid var(--bg-border)', borderBottom: 'none', margin: '8px 0' }} />
              <PnlRow label="Operating Income" value={computed.operatingIncome} bold />
              <PnlRow label="Finance Cost" value={computed.financeCost} isNegative />
              <hr style={{ borderTop: '1px solid var(--bg-border)', borderBottom: 'none', margin: '8px 0' }} />
              <PnlRow label="Operating Profit Before Tax" value={computed.opbt} bold />
              <PnlRow label="Taxation" value={computed.taxation} isNegative />
              <hr style={{ borderTop: '1px solid var(--bg-border)', borderBottom: 'none', margin: '8px 0' }} />
              <PnlRow label="Profit After Tax" value={computed.profitAfterTax} bold />
              <PnlRow label="Other Comprehensive Income" value={computed.oci} />
              <hr style={{ borderTop: '1px solid var(--bg-border)', borderBottom: 'none', margin: '8px 0' }} />
              <PnlRow label="Profit For The Year" value={computed.profitForYear} bold />
            </div>
          </div>
        );

      case 'sfp':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 12 }}>Properties, Plants and Equipment</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>₦</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={state.sfp.propertiesPlantsEquipment === null ? '' : state.sfp.propertiesPlantsEquipment}
                  onChange={e => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, propertiesPlantsEquipment: e.target.value ? Number(e.target.value) : null } }))}
                  style={{
                    width: '100%', maxWidth: 300, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>
            
            <GateBlock title="Investments">
              <ChipSelectAmount
                options={['Investment in securities', 'Investment in stock and bonds', 'Investment in Properties', 'Investment in Associate & Joint Ventures', 'Investment in Subsidiaries', 'Investment in finance lease', 'Investment in staff loan', 'Investment in digital assets', 'Investment in Commodities', 'Others']}
                value={state.sfp.investments}
                onChange={val => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, investments: val } }))}
              />
            </GateBlock>

            <GateBlock title="Intangible assets">
              <ChipSelectAmount
                options={['Goodwill', 'Patent', 'Trademarks', 'Terminal and service concession rights', 'Brands', 'Customer relationships', 'Right of use', 'Copyrights', 'Others']}
                value={state.sfp.intangibleAssets}
                onChange={val => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, intangibleAssets: val } }))}
              />
            </GateBlock>

            <GateBlock title="Other non-current assets">
              <ChipSelectAmount
                options={['Lease-hold Land', 'Lease-hold Building', 'Building and Real estate lease', 'Other leases', 'Non-Current Assets Held for Sale', 'Contract assets', 'Deferred tax asset', 'Other financial assets', 'Others']}
                value={state.sfp.otherNonCurrentAssets}
                onChange={val => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, otherNonCurrentAssets: val } }))}
              />
            </GateBlock>

            <GateBlock title="Other current assets">
              <ChipSelectAmount
                options={['Other Receivables', 'Trade receivables', 'Withholding tax receivables', 'Prepaid Expenses', 'Goods in transit', 'Others']}
                value={state.sfp.otherCurrentAssets}
                onChange={val => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, otherCurrentAssets: val } }))}
              />
            </GateBlock>

            <GateBlock title="Cash and cash equivalents">
              <ChipSelectAmount
                options={['Cash in hand', 'Cash at Bank', 'marketable securities', 'Others']}
                value={state.sfp.cashAndEquivalents}
                onChange={val => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, cashAndEquivalents: val } }))}
              />
            </GateBlock>

            <GateBlock title="Other current liabilities">
              <ChipSelectAmount
                options={['Other payables', 'Financial liabilities', 'Accruals', 'Unearned income (advance from customers)', 'Interest payable', 'Short-term debt', 'Provisions', 'Dividend payable', 'Others']}
                value={state.sfp.otherCurrentLiabilities}
                onChange={val => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, otherCurrentLiabilities: val } }))}
              />
            </GateBlock>

            <GateBlock title="Non-current liabilities">
              <ChipSelectAmount
                options={['Long Term Debt', 'Long term Borrowings', 'Pension and Employee Benefit obligation', 'Deferred Tax Liabilities', 'Lease liabilities', 'Others']}
                value={state.sfp.nonCurrentLiabilities}
                onChange={val => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, nonCurrentLiabilities: val } }))}
              />
            </GateBlock>

            <GateBlock title="Other reserves">
              <ChipSelectAmount
                options={['Contingency reserve', 'Cumulative Translation Adjustment', 'Share based payment reserve', 'Reserve for bonus issue', 'Capital reserve', 'Others']}
                value={state.sfp.otherReserves}
                onChange={val => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, otherReserves: val } }))}
              />
            </GateBlock>

            <GateBlock title="Trade Payables & current tax liabilities">
              <ChipSelectAmount
                options={['Trade Payables', 'Current tax liabilities']}
                value={state.sfp.tradePayablesAndCurrentTax}
                onChange={val => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, tradePayablesAndCurrentTax: val } }))}
              />
            </GateBlock>

            <GateBlock title="Equity">
              <ChipSelectAmount
                options={['Issued Share Capital', 'Share premium', 'Revaluation reserve', 'Statutory reserve', 'Non-controlling interest']}
                value={state.sfp.equity}
                onChange={val => updateState(prev => ({ ...prev, sfp: { ...prev.sfp, equity: val } }))}
              />
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                Retained earnings carried forward is derived from Q6 [Profit or Loss] — not re-entered. 
                (₦{computed.profitForYear.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </div>
            </GateBlock>
          </div>
        );

      case 'adjustment':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 12 }}>Do you have any add backs?</label>
              <ChipSelect
                isMulti={false}
                options={['Yes', 'No']}
                selectedOptions={state.profitAdjustment.hasAddbacks === true ? ['Yes'] : state.profitAdjustment.hasAddbacks === false ? ['No'] : []}
                onChange={([val]) => updateState(prev => ({ ...prev, profitAdjustment: { ...prev.profitAdjustment, hasAddbacks: val === 'Yes' } }))}
              />
              {state.profitAdjustment.hasAddbacks && (
                <div style={{ marginTop: 16 }}>
                  <ChipSelectAmount
                    searchable
                    options={['Depreciation', 'Expenses Related To Exempt Income', 'Donations (To The Extent Not Allowed)', 'Unrealised Foreign Exchange Loss', 'Loss On Disposal Of Fixed Assets', 'Entertainment Expenses (To The Extent Not Allowed)', 'Capital Repaid/Withdrawn', 'Expenses of Capital Nature', 'Expenditure on assets not used for the purpose of trade', 'Sum recoverable under an insurance or contract of indemnity', 'Taxes on Profit or Incomes', 'Payment to any unapproved retirement fund or scheme under the Pension Reform Act', 'Any sum reserved out of profits subject to the provisions of section 20(1)(h) of this Act', 'Any payment to a related party that contravenes the Transfer Pricing Regulations', 'Any expense incurred in deriving an income that is exempt from income tax', 'Any expense allowable as a deduction in determining chargeable gains', 'Penalty or fine imposed under any law', 'Expenses liable to VAT or import duties but not charged or paid', 'Compensating payments in regulated securities lending that qualify as dividends or interest under this Act', 'Others']}
                    value={state.profitAdjustment.addbacks}
                    onChange={val => updateState(prev => ({ ...prev, profitAdjustment: { ...prev.profitAdjustment, addbacks: val } }))}
                  />
                </div>
              )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)' }} />

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 12 }}>Do you have any deductions?</label>
              <ChipSelect
                isMulti={false}
                options={['Yes', 'No']}
                selectedOptions={state.profitAdjustment.hasDeductions === true ? ['Yes'] : state.profitAdjustment.hasDeductions === false ? ['No'] : []}
                onChange={([val]) => updateState(prev => ({ ...prev, profitAdjustment: { ...prev.profitAdjustment, hasDeductions: val === 'Yes' } }))}
              />
              {state.profitAdjustment.hasDeductions && (
                <div style={{ marginTop: 16 }}>
                  <ChipSelectAmount
                    options={['Deduct Non Taxable Items', 'Profit From Sales Of Fixed Assets', 'Frank Investment Income', 'Unrealised Gains', 'Others']}
                    value={state.profitAdjustment.deductions}
                    onChange={val => updateState(prev => ({ ...prev, profitAdjustment: { ...prev.profitAdjustment, deductions: val } }))}
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 'admin':
        return (
          <div>
            <ChipSelectAmount
              searchable
              options={['Salary and Wages', 'Employee Benefit Expenses', 'Staff Allowances', 'Pension and Gratuity', 'Other staff & related Cost', 'depreciation', 'Government and regulatory costs', 'Advertisement & Promotion', 'Bad Debt written off', 'Bank charges', 'Interest Expense', 'Audit fees', 'Entertainment expenses', 'Fuel expenses', 'Generator expenses', 'Internet Cost', 'Rent & Rates', 'Repairs and Maintenance', 'Security expenses', 'Selling & Distribution Expenses', 'Service Charge', 'Public Relation', 'Permits', 'Telephone', 'Training and Development', 'Transport of supplies', 'Utilities', 'Website Design & Maintenance', 'Software maintenance', 'Cleaning & Janitory Services', 'Freight & Transport Expenses', 'Subscription & Dues', 'Stationeries expenses', 'other professional fees', 'Fines', 'penalties', 'Electricity & Power', 'PMS', 'Health safety and environmental expenses', 'Licences & leases charges', 'Other statutory charges & levies', 'AGO-Diesel', 'Travel Expenses', 'Others']}
              value={state.adminExpense}
              onChange={val => updateState(prev => ({ ...prev, adminExpense: val }))}
            />
          </div>
        );

      case 'done':
        return (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Review & Submit</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32 }}>
              Please ensure all ledger values reflect your business's true state for the {state.yearOfAssessment} filing period. 
              Submitting will record this in the ROVA app.
            </p>
            <button
              onClick={() => {
                alert("Tax filed successfully in ROVA! (Note: backend integration to tax authority API is planned for a future update).");
                navigate('/app/tax');
              }}
              style={{
                padding: '12px 32px', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
                color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.25)'
              }}
            >
              Sign and submit
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button
          onClick={() => navigate('/app/tax')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          <ArrowLeft size={16} /> Exit to Tax Hub
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>NRS Company Income Tax (CIT) Filing Wizard</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>ROVA unified tax filing flow</p>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--accent-light)', marginBottom: 8 }}>
            <span>Step {currentStep + 1} of {STAGES.length}: {stage.label}</span>
            <span>{Math.round(((currentStep + 1) / STAGES.length) * 100)}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((currentStep + 1) / STAGES.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-light))', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        
        {/* Main Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: 32, minHeight: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px 0', color: 'var(--text-primary)' }}>{stage.title}</h2>
            {renderStepContent()}
          </div>
          
          {/* Bottom Nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button
              onClick={handlePrev}
              style={{
                padding: '10px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                cursor: currentStep > 0 ? 'pointer' : 'not-allowed', opacity: currentStep > 0 ? 1 : 0.5,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}
              disabled={currentStep === 0}
            >
              <ArrowLeft size={16} /> Previous
            </button>

            {currentStep < STAGES.length - 1 && (
              <button
                onClick={handleNext}
                disabled={mneCfcFlagged && currentStep === 1}
                style={{
                  padding: '10px 24px', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
                  border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, color: '#fff',
                  cursor: (mneCfcFlagged && currentStep === 1) ? 'not-allowed' : 'pointer',
                  opacity: (mneCfcFlagged && currentStep === 1) ? 0.5 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: 6
                }}
              >
                Continue <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar LEDGER */}
        <LiveLedgerSidebar computed={computed} mneCfcFlagged={mneCfcFlagged} />

      </div>
    </div>
  );
}

function PnlRow({ label, value, isNegative, bold }: { label: string, value: number, isNegative?: boolean, bold?: boolean }) {
  const formatted = `₦${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: bold ? 'var(--text-primary)' : (isNegative && value > 0 ? 'var(--error)' : 'var(--text-primary)') }}>
        {isNegative && value > 0 ? `-${formatted}` : formatted}
      </span>
    </div>
  );
}
