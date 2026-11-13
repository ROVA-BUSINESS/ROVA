import React, { useState } from 'react';
import {
  Upload,
  Code,
  Layers,
  Play,
  Shield,
  CheckCircle,
  Globe,
  Eye,
  Lock,
  RefreshCw,
  Search,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import {
  parsePortalHtml,
  type ParsedPortalSnapshot,
  type ParsedElement,
} from '../../lib/taxStudio/htmlParser';
import {
  OFFICIAL_TAX_AUTHORITIES,
  type TaxAuthorityWorkflowConfig,
  type WorkflowStep,
  type ElementActionType,
} from '../../lib/taxStudio/workflowTypes';

export default function AutomationStudioPage() {
  const [selectedAuthority, setSelectedAuthority] = useState<TaxAuthorityWorkflowConfig>(
    OFFICIAL_TAX_AUTHORITIES[0] // Default to LIRS
  );
  const [activeTab, setActiveTab] = useState<'inspector' | 'workflows' | 'runner'>('inspector');
  const [, setUploadedHtml] = useState<string>('');
  const [parsedSnapshot, setParsedSnapshot] = useState<ParsedPortalSnapshot | null>(null);
  const [selectedElement, setSelectedElement] = useState<ParsedElement | null>(null);
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowStep[]>(selectedAuthority.steps);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Handle HTML File Upload
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setUploadedHtml(content);
        const parsed = parsePortalHtml(content);
        setParsedSnapshot(parsed);
        if (parsed.allElements.length > 0) {
          setSelectedElement(parsed.allElements[0]);
        }
      }
    };
    reader.readAsText(file);
  }

  // Handle Direct Paste / Sample HTML Load
  function loadSampleLirsHtml() {
    const sampleLirs = `
      <!DOCTYPE html>
      <html>
      <head><title>LIRS eTax - Lagos State Internal Revenue Service</title></head>
      <body>
        <div class="login-container">
          <h2>eTax Lagos Taxpayer Portal</h2>
          <form id="lirs_login_form" action="/auth/login" method="POST">
            <label for="payer_id">Lagos Payer ID / Email</label>
            <input type="text" id="payer_id" name="payer_id" placeholder="e.g. N-1234567" required />

            <label for="password">Password</label>
            <input type="password" id="password" name="password" required />

            <button type="submit" id="btn_login" class="btn btn-primary">Login with eTax</button>
          </form>

          <form id="lirs_direct_assessment" action="/assessment/save" method="POST">
            <h3>Direct Assessment Annual Return</h3>
            <label for="taxpayer_tin">Tax Identification Number (TIN)</label>
            <input type="text" id="taxpayer_tin" name="tin" placeholder="2345678901" required />

            <label for="gross_income">Annual Gross Income (₦)</label>
            <input type="number" id="gross_income" name="gross_income" placeholder="0.00" required />

            <label for="bvn_verify">BVN Verification</label>
            <input type="text" id="bvn_verify" name="bvn" placeholder="11-digit BVN" maxlength="11" required />

            <label for="otp_token">SMS Verification Code (OTP)</label>
            <input type="text" id="otp_token" name="otp" placeholder="6-digit OTP" maxlength="6" required />

            <button type="button" id="btn_file_return" class="btn btn-success">Submit Tax Declaration</button>
          </form>
        </div>
      </body>
      </html>
    `;
    setUploadedHtml(sampleLirs);
    const parsed = parsePortalHtml(sampleLirs);
    setParsedSnapshot(parsed);
    if (parsed.allElements.length > 0) {
      setSelectedElement(parsed.allElements[0]);
    }
  }

  // Filter elements
  const filteredElements = (parsedSnapshot?.allElements || []).filter((el) => {
    const matchesSearch =
      (el.label || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (el.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (el.elementId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (el.selectorPrimary || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (filterAction === 'ALL') return matchesSearch;
    if (filterAction === 'SENSITIVE') return matchesSearch && el.isSensitiveGuess;
    return matchesSearch && el.actionRecommendation === filterAction;
  });

  // Test Simulation
  async function runSimulatedWorkflow() {
    setIsSimulating(true);
    setTestLog([]);
    const logs: string[] = [];

    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setTestLog([...logs]);
    };

    addLog(`🚀 Starting simulated test for: ${selectedAuthority.name}`);
    addLog(`🌐 Navigating to ${selectedAuthority.portalUrl}...`);
    await new Promise((r) => setTimeout(r, 600));

    for (const step of activeWorkflow) {
      addLog(`👉 Step ${step.order}: ${step.title}`);
      if (step.action === 'CUSTOMER_FILL') {
        addLog(`  ⚠️ SENSITIVE HANDOFF PAUSE: Prompting customer for ${step.handoffType || 'credentials'}`);
        addLog(`  🛡️ Value entered securely by customer directly into isolated session.`);
      } else if (step.action === 'CUSTOMER_APPROVAL') {
        addLog(`  ✋ FINAL APPROVAL REQUIRED: Awaiting customer authorization click.`);
      } else if (step.action === 'AI_FILL') {
        addLog(`  🤖 AI Field Populate: ${step.selector} -> bound to [${step.fieldBinding}]`);
      } else if (step.action === 'AI_CLICK') {
        addLog(`  🖱️ AI Element Click: ${step.selector}`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    addLog(`✅ Workflow completed successfully. Zero validation errors.`);
    setIsSimulating(false);
  }

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 16px 80px' }}>
      {/* Studio Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Code size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Rova Tax Automation Studio
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Inspect portal HTML, configure AI interaction boundaries, and verify Nigerian tax filing workflows.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant={activeTab === 'inspector' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('inspector')}
          >
            <Eye size={16} style={{ marginRight: 6 }} /> HTML Inspector
          </Button>
          <Button
            variant={activeTab === 'workflows' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('workflows')}
          >
            <Layers size={16} style={{ marginRight: 6 }} /> Workflows ({activeWorkflow.length})
          </Button>
          <Button
            variant={activeTab === 'runner' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('runner')}
          >
            <Play size={16} style={{ marginRight: 6 }} /> Test Runner
          </Button>
        </div>
      </div>

      {/* Tax Authority Selector Bar */}
      <Card style={{ padding: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={18} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Target Authority:
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {OFFICIAL_TAX_AUTHORITIES.map((auth) => (
                <button
                  key={auth.code}
                  onClick={() => {
                    setSelectedAuthority(auth);
                    setActiveWorkflow(auth.steps);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selectedAuthority.code === auth.code ? 'var(--accent)' : 'var(--bg-border)',
                    background:
                      selectedAuthority.code === auth.code ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                    color: selectedAuthority.code === auth.code ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {auth.code} ({auth.taxType})
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge variant="info">{selectedAuthority.taxType}</Badge>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{selectedAuthority.portalUrl}</span>
          </div>
        </div>
      </Card>

      {/* TAB 1: HTML INSPECTOR */}
      {activeTab === 'inspector' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left Column: Upload & Detected DOM Elements */}
          <div>
            <Card style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Portal HTML Reference</h3>
                <Button size="sm" variant="secondary" onClick={loadSampleLirsHtml}>
                  Load Sample LIRS HTML
                </Button>
              </div>

              <div
                style={{
                  border: '2px dashed var(--bg-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 20,
                  textAlign: 'center',
                  background: 'var(--bg-elevated)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="file"
                  id="html-file-upload"
                  accept=".html,.htm"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="html-file-upload" style={{ cursor: 'pointer' }}>
                  <Upload size={28} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>
                    Upload Saved Chrome HTML ({selectedAuthority.code})
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Save page as HTML from browser and drop here to parse elements
                  </p>
                </label>
              </div>

              {parsedSnapshot && (
                <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>Forms: <strong>{parsedSnapshot.forms.length}</strong></span>
                  <span>Input Elements: <strong>{parsedSnapshot.allElements.length}</strong></span>
                  <span>Buttons: <strong>{parsedSnapshot.standaloneButtons.length}</strong></span>
                </div>
              )}
            </Card>

            {/* Elements Explorer */}
            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                  Identified Portal Elements ({filteredElements.length})
                </h3>
              </div>

              {/* Filters & Search */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Search selector, label, id..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 30px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--bg-border)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  />
                </div>

                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--bg-border)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                >
                  <option value="ALL">All Actions</option>
                  <option value="AI_FILL">AI Fills</option>
                  <option value="CUSTOMER_FILL">Customer Sensitive</option>
                  <option value="CUSTOMER_APPROVAL">Customer Approval</option>
                  <option value="SENSITIVE">Flagged Sensitive</option>
                </select>
              </div>

              {/* Elements List */}
              <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredElements.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 13 }}>
                    No elements match the criteria or no HTML uploaded yet.
                  </p>
                ) : (
                  filteredElements.map((el) => {
                    const isSelected = selectedElement?.id === el.id;
                    return (
                      <div
                        key={el.id}
                        onClick={() => setSelectedElement(el)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--bg-border)',
                          background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-elevated)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {el.label || el.name || el.elementId || el.tagName}
                            </span>
                            {el.isSensitiveGuess && (
                              <Badge variant="error" style={{ fontSize: 10, padding: '1px 6px' }}>
                                <Lock size={10} style={{ marginRight: 3 }} /> Sensitive
                              </Badge>
                            )}
                            {el.required && (
                              <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>*Required</span>
                            )}
                          </div>
                          <code
                            style={{
                              fontSize: 11,
                              color: 'var(--text-tertiary)',
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: 2,
                            }}
                          >
                            {el.selectorPrimary}
                          </code>
                        </div>

                        <Badge
                          variant={
                            el.actionRecommendation === 'CUSTOMER_FILL'
                              ? 'warning'
                              : el.actionRecommendation === 'CUSTOMER_APPROVAL'
                              ? 'info'
                              : 'success'
                          }
                          style={{ fontSize: 10 }}
                        >
                          {el.actionRecommendation}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Visual Element Action Configuration */}
          <div>
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Configure Interaction Rule</h3>
                {selectedElement && (
                  <Badge variant={selectedElement.isSensitiveGuess ? 'error' : 'info'}>
                    {selectedElement.tagName.toUpperCase()}
                  </Badge>
                )}
              </div>

              {!selectedElement ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                  Select an identified element on the left to configure AI behavior.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Element Label / Purpose
                    </label>
                    <Input
                      value={selectedElement.label || selectedElement.name || selectedElement.elementId}
                      readOnly
                      style={{ marginTop: 4, background: 'var(--bg-elevated)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Primary CSS Selector
                    </label>
                    <code
                      style={{
                        display: 'block',
                        padding: '8px 12px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 12,
                        marginTop: 4,
                        border: '1px solid var(--bg-border)',
                      }}
                    >
                      {selectedElement.selectorPrimary}
                    </code>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      AI Action Rule
                    </label>
                    <select
                      value={selectedElement.actionRecommendation}
                      onChange={(e) =>
                        setSelectedElement({
                          ...selectedElement,
                          actionRecommendation: e.target.value as ElementActionType,
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--bg-border)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        marginTop: 4,
                        fontWeight: 600,
                      }}
                    >
                      <option value="AI_FILL">AI Fills Automatically (from Rova records)</option>
                      <option value="CUSTOMER_FILL">Customer Fills Manually (Sensitive Handoff)</option>
                      <option value="AI_CLICK">AI Clicks (Navigation / Next)</option>
                      <option value="CUSTOMER_APPROVAL">Customer Approval Required (Before Final Click)</option>
                      <option value="SKIP">Skip Element</option>
                      <option value="ASK_CUSTOMER">Ask Customer for Additional Info</option>
                      <option value="PAUSE">Pause Automation</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Data Field Binding
                    </label>
                    <select
                      value={selectedElement.suggestedBinding || 'none'}
                      onChange={(e) =>
                        setSelectedElement({
                          ...selectedElement,
                          suggestedBinding: e.target.value,
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--bg-border)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        marginTop: 4,
                      }}
                    >
                      <option value="none">-- Select Binding --</option>
                      <optgroup label="Taxpayer Identifiers">
                        <option value="taxpayer.tin">Taxpayer TIN</option>
                        <option value="taxpayer.payer_id">Lagos Payer ID</option>
                        <option value="taxpayer.riv_tin">Rivers State RIV-TIN</option>
                        <option value="company.rc_number">CAC RC / Business Number</option>
                      </optgroup>
                      <optgroup label="Calculated Figures (Deterministic Engine)">
                        <option value="computation.gross_revenue">Annual Gross Revenue / Turnover</option>
                        <option value="computation.taxable_income">Chargeable / Assessable Profit</option>
                        <option value="computation.consolidated_relief">Consolidated Relief Allowance (CRA)</option>
                        <option value="computation.capital_allowance">Capital Allowance</option>
                        <option value="computation.tax_payable">Final Tax Payable</option>
                      </optgroup>
                      <optgroup label="Sensitive Handoffs">
                        <option value="customer.bvn">Customer BVN (Direct Hand-off)</option>
                        <option value="customer.nin">Customer NIN (Direct Hand-off)</option>
                        <option value="session.password">Portal Password (Direct Hand-off)</option>
                        <option value="session.otp">2FA SMS/Email OTP (Direct Hand-off)</option>
                      </optgroup>
                    </select>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-elevated)',
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--bg-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Sensitive Information Guard</span>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Never log or transmit via AI model. Prompt customer in isolated session.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedElement.isSensitiveGuess}
                      onChange={(e) =>
                        setSelectedElement({
                          ...selectedElement,
                          isSensitiveGuess: e.target.checked,
                          actionRecommendation: e.target.checked ? 'CUSTOMER_FILL' : selectedElement.actionRecommendation,
                        })
                      }
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>

                  <Button
                    variant="primary"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      // Add as step to workflow
                      const newStep: WorkflowStep = {
                        stepId: `step_${selectedElement.id}`,
                        order: activeWorkflow.length + 1,
                        title: selectedElement.label || selectedElement.selectorPrimary,
                        description: `Execute ${selectedElement.actionRecommendation} on ${selectedElement.selectorPrimary}`,
                        action: selectedElement.actionRecommendation,
                        selector: selectedElement.selectorPrimary,
                        fieldBinding: selectedElement.suggestedBinding,
                        isSensitive: selectedElement.isSensitiveGuess,
                        requiresHandoff:
                          selectedElement.actionRecommendation === 'CUSTOMER_FILL' ||
                          selectedElement.actionRecommendation === 'CUSTOMER_APPROVAL',
                        handoffType: selectedElement.isSensitiveGuess ? 'PASSWORD' : 'APPROVAL',
                      };
                      setActiveWorkflow([...activeWorkflow, newStep]);
                      alert('Step added to current workflow!');
                    }}
                  >
                    <CheckCircle size={16} style={{ marginRight: 6 }} /> Add Element to Filing Workflow
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: WORKFLOW BUILDER */}
      {activeTab === 'workflows' && (
        <div>
          <Card style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  Active Filing Workflow: {selectedAuthority.name}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  Sequence of deterministic browser actions and sensitive customer handoff checkpoints.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" variant="secondary" onClick={() => setActiveWorkflow(selectedAuthority.steps)}>
                  Reset to Authority Defaults
                </Button>
                <Button size="sm" variant="primary" onClick={() => alert('Workflow configuration saved!')}>
                  Save Workflow Version
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeWorkflow.map((step, idx) => (
                <div
                  key={step.stepId}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--bg-border)',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {step.order}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{step.title}</span>
                        {step.isSensitive && (
                          <Badge variant="error" style={{ fontSize: 10 }}>
                            <Lock size={10} style={{ marginRight: 3 }} /> Sensitive Handoff
                          </Badge>
                        )}
                        {step.action === 'CUSTOMER_APPROVAL' && (
                          <Badge variant="warning" style={{ fontSize: 10 }}>
                            <Shield size={10} style={{ marginRight: 3 }} /> Final Approval Gate
                          </Badge>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Selector: <code>{step.selector}</code>
                        {step.fieldBinding && (
                          <span style={{ marginLeft: 8, color: 'var(--accent)' }}>
                            → Bound to [{step.fieldBinding}]
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge variant="info">{step.action}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const updated = activeWorkflow.filter((_, sIdx) => sIdx !== idx);
                        setActiveWorkflow(updated.map((s, i) => ({ ...s, order: i + 1 })));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: TEST RUNNER */}
      {activeTab === 'runner' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
          {/* Simulated Browser Viewport */}
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={18} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Live Browser Screencast (WebSocket Stream)</span>
              </div>
              <Badge variant={isSimulating ? 'success' : 'info'}>
                {isSimulating ? 'Session Active' : 'Ready'}
              </Badge>
            </div>

            <div
              style={{
                height: 380,
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--bg-border)',
                background: '#090d16',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 32,
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  gap: 6,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: 11, marginLeft: 10, color: 'rgba(255, 255, 255, 0.6)' }}>
                  {selectedAuthority.portalUrl}
                </span>
              </div>

              {isSimulating ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <RefreshCw size={36} className="spin" style={{ color: 'var(--accent)', marginBottom: 12 }} />
                  <p style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Executing Workflow Steps...</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                    Streaming DOM frames via isolated WebSocket container.
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Play size={40} style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 12 }} />
                  <p style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                    Automated Test Session Idle
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                    Click "Run Test Simulation" below to execute the sequence step-by-step.
                  </p>
                  <Button variant="primary" size="sm" onClick={runSimulatedWorkflow} style={{ marginTop: 8 }}>
                    Start Test Simulation
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Execution Log */}
          <Card style={{ padding: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Execution Audit Log</h3>
            <div
              style={{
                height: 380,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-elevated)',
                padding: 12,
                fontFamily: 'monospace',
                fontSize: 12,
                overflowY: 'auto',
                border: '1px solid var(--bg-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {testLog.length === 0 ? (
                <span style={{ color: 'var(--text-tertiary)' }}>No execution logs yet.</span>
              ) : (
                testLog.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      color: log.includes('⚠️')
                        ? '#f59e0b'
                        : log.includes('✅')
                        ? '#10b981'
                        : log.includes('👉')
                        ? 'var(--accent)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
