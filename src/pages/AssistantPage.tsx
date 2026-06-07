import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, RefreshCw, AlertTriangle, Info, CheckCircle,
  Zap, Bell, ChevronRight, Package, Users, FileText, X,
  MessageCircle, HelpCircle, TrendingUp,
} from 'lucide-react';
import { supabase, type Transaction, type Account } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateInsights, type Insight } from '../lib/aiEngine';
import {
  classifyTransaction,
  chatWithAssistant,
  fetchPendingClarifications,
  resolveClarification,
  dismissClarification,
  applyPayrollIntent,
  type PendingClarification,
  type ChatAction,
} from '../lib/deepseekClient';
import Card from '../components/ui/Card';
import { useMobile } from '../hooks/useMobile';
import { createInvoice } from '../lib/invoiceService';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
  isTyping?: boolean;
};

// ── Severity styles ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<
  Insight['severity'],
  { bg: string; border: string; icon: React.ElementType; color: string }
> = {
  info: { bg: 'var(--info-dim)', border: 'rgba(59,130,246,0.2)', icon: Info, color: 'var(--info)' },
  warning: { bg: 'var(--warning-dim)', border: 'rgba(245,158,11,0.2)', icon: AlertTriangle, color: 'var(--warning)' },
  critical: { bg: 'var(--error-dim)', border: 'rgba(239,68,68,0.2)', icon: AlertTriangle, color: 'var(--error)' },
  positive: { bg: 'var(--success-dim)', border: 'rgba(34,197,94,0.2)', icon: CheckCircle, color: 'var(--success)' },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  create_invoice: FileText,
  add_inventory: Package,
  record_payroll: Users,
  clarify_transaction: HelpCircle,
  view_report: TrendingUp,
};

const ACTION_COLORS: Record<string, string> = {
  create_invoice: '#6366f1',
  add_inventory: '#10b981',
  record_payroll: '#f59e0b',
  clarify_transaction: '#3b82f6',
  view_report: '#8b5cf6',
};

const STARTERS = [
  'How much did I make this month?',
  'What am I overspending on?',
  'Give me a financial summary',
  'I want to create an invoice',
  'Can I afford to hire someone?',
  "What's my profit margin?",
];

// ── Clarification card ────────────────────────────────────────────────────────

function ClarificationCard({
  item,
  onResolve,
  onDismiss,
}: {
  item: PendingClarification;
  onResolve: (id: string, answer: string, notifId: string | null) => Promise<void>;
  onDismiss: (id: string, notifId: string | null) => Promise<void>;
}) {
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleResolve() {
    if (!answer.trim()) return;
    setSaving(true);
    await onResolve(item.id, answer.trim(), item.notification_id);
    setSaving(false);
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: 'fadeIn 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
              background: 'rgba(245,158,11,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <HelpCircle size={14} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              {item.ai_question}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Transaction: &ldquo;{item.original_description}&rdquo;
              {item.suggested_amount ? ` • ₦${item.suggested_amount.toLocaleString()}` : ''}
            </div>
          </div>
        </div>
        <button
          onClick={() => onDismiss(item.id, item.notification_id)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
        >
          <X size={13} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleResolve()}
          placeholder="Type your answer…"
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-md)', fontSize: 12,
            background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
            color: 'var(--text-primary)', outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent-primary)')}
          onBlur={e => (e.target.style.borderColor = 'var(--bg-border)')}
        />
        <button
          onClick={handleResolve}
          disabled={!answer.trim() || saving}
          style={{
            padding: '7px 12px', borderRadius: 'var(--radius-md)', fontSize: 12,
            background: answer.trim() && !saving ? '#f59e0b' : 'var(--bg-card)',
            color: answer.trim() && !saving ? 'white' : 'var(--text-muted)',
            border: '1px solid var(--bg-border)', cursor: 'pointer', fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          {saving ? '…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionButton({
  action,
  onAction,
}: {
  action: ChatAction;
  onAction: (action: ChatAction) => void;
}) {
  const Icon = ACTION_ICONS[action.type] ?? ChevronRight;
  const color = ACTION_COLORS[action.type] ?? 'var(--accent-primary)';

  return (
    <button
      onClick={() => onAction(action)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 'var(--radius-full)',
        background: `${color}18`, border: `1px solid ${color}40`,
        color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.15s', marginTop: 4,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}30`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}18`; }}
    >
      <Icon size={12} />
      {action.label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const { user, isStaff } = useAuth();
  const isMobile = useMobile(1024);
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [clarifications, setClarifications] = useState<PendingClarification[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm ROVA — your AI-powered business assistant. I've analysed your transactions and I'm ready to help. Ask me anything about your finances, or use one of the quick questions below.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) { loadData(); loadClarifications(); }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadData() {
    setLoading(true);
    const [txRes, accRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*), account:accounts(*)')
        .eq('user_id', user!.id)
        .order('date', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true),
    ]);
    const txs = txRes.data || [];
    const accs = accRes.data || [];
    setTransactions(txs);
    setAccounts(accs);
    setInsights(generateInsights(txs, accs));
    setLoading(false);
  }

  async function loadClarifications() {
    try {
      const items = await fetchPendingClarifications(user!.id);
      setClarifications(items);
    } catch {
      // silently ignore if table doesn't exist yet
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadData(), loadClarifications()]);
    setRefreshing(false);
  }

  // ── Handle clarification resolve ────────────────────────────────────────────

  async function handleResolve(id: string, answer: string, notifId: string | null) {
    await resolveClarification(id, notifId);
    setClarifications(prev => prev.filter(c => c.id !== id));

    // Echo the resolution into the chat
    const clarification = clarifications.find(c => c.id === id);
    if (clarification) {
      const userMsg: ChatMessage = {
        id: `u-resolve-${Date.now()}`,
        role: 'user',
        content: answer,
        timestamp: new Date(),
      };
      const assistantMsg: ChatMessage = {
        id: `a-resolve-${Date.now()}`,
        role: 'assistant',
        content: `Got it! I've updated the transaction "${clarification.original_description}" to: **${answer}**. The description and classification have been saved.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg, assistantMsg]);

      console.log('ROVA: Resolving clarification:', clarification);
      if (clarification.transaction_id) {
        // Update the transaction description in the database with the user's answer
        supabase
          .from('transactions')
          .update({
            description: answer,
            notes: `Clarified via ROVA AI. Original: "${clarification.original_description}"`,
          })
          .eq('id', clarification.transaction_id)
          .then(({ error: updateErr }) => {
            if (updateErr) {
              console.error("ROVA: Failed to update transaction description:", updateErr);
              alert(`Error updating transaction description: ${updateErr.message}`);
            } else {
              console.log("ROVA: Successfully updated transaction description in DB to:", answer);
              // Update local state so the UI reflects the change immediately
              setTransactions(prev =>
                prev.map(t =>
                  t.id === clarification.transaction_id
                    ? { ...t, description: answer, notes: `Clarified via ROVA AI. Original: "${clarification.original_description}"` }
                    : t
                )
              );

              classifyTransaction(
                {
                  id: clarification.transaction_id || undefined,
                  description: answer,
                  amount: clarification.suggested_amount || undefined,
                  type: clarification.suggested_intent === 'income' ? 'income' : 'expense',
                },
                user!.id,
                'full'
              ).then((result) => {
                console.log("ROVA: Successfully re-classified transaction:", result);
              }).catch(err => {
                console.error("ROVA: Failed to re-classify after clarification:", err);
              });
            }
          });
      } else {
        console.warn('ROVA: No transaction_id associated with clarification:', clarification);
        alert('Warning: No transaction ID associated with this clarification card.');
      }
    } else {
      console.warn('ROVA: Clarification card not found in local state for ID:', id);
    }
  }

  async function handleDismiss(id: string, notifId: string | null) {
    await dismissClarification(id, notifId);
    setClarifications(prev => prev.filter(c => c.id !== id));
  }

  // ── Helpers: Direct DB creation from AI actions ──────────────────────────────

  async function addInventoryFromAI(payload: any) {
    const loadingId = `inventory-loading-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: loadingId, role: 'assistant',
      content: `⏳ Saving inventory item **${payload.name}**…`,
      timestamp: new Date(),
    }]);
    setTyping(true);

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          user_id: user!.id,
          name: payload.name,
          sku: payload.sku || `SKU-${Date.now()}`,
          category: payload.category || 'General',
          unit: payload.unit || 'unit',
          cost_price: Number(payload.cost_price) || 0,
          selling_price: Number(payload.selling_price) || 0,
          current_stock: Number(payload.current_stock) || 0,
          reorder_level: Number(payload.reorder_level) || 0,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
        id: `inventory-ok-${Date.now()}`, role: 'assistant',
        content: `✅ Inventory item **${payload.name}** has been added successfully!\n\n` +
          `• SKU: \`${data.sku}\`\n` +
          `• Cost Price: ₦${data.cost_price.toLocaleString()}\n` +
          `• Selling Price: ₦${data.selling_price.toLocaleString()}\n` +
          `• Current Stock: ${data.current_stock} ${data.unit}`,
        timestamp: new Date(),
        actions: [{ type: 'view_report', label: '📦 View Inventory', payload: { page: 'inventory' } }],
      }));
    } catch (err: any) {
      console.error("Failed to add inventory item:", err);
      setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
        id: `inventory-err-${Date.now()}`, role: 'assistant',
        content: `❌ Failed to save inventory item: ${err.message || err}`,
        timestamp: new Date(),
      }));
    } finally {
      setTyping(false);
    }
  }

  async function addEmployeeFromAI(payload: any) {
    const loadingId = `employee-loading-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: loadingId, role: 'assistant',
      content: `⏳ Adding employee **${payload.full_name}**…`,
      timestamp: new Date(),
    }]);
    setTyping(true);

    try {
      const { data, error } = await supabase
        .from('employees')
        .insert({
          user_id: user!.id,
          full_name: payload.full_name,
          email: payload.email || '',
          phone: payload.phone || '',
          role: payload.role || '',
          department: payload.department || '',
          employment_type: payload.employment_type || 'full_time',
          start_date: payload.start_date || new Date().toISOString().split('T')[0],
          gross_salary: Number(payload.gross_salary) || 0,
          paye_rate: Number(payload.paye_rate) ?? 7.5,
          pension_rate: Number(payload.pension_rate) ?? 8.0,
          bank_name: payload.bank_name || '',
          bank_account: payload.bank_account || '',
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
        id: `employee-ok-${Date.now()}`, role: 'assistant',
        content: `✅ Employee **${payload.full_name}** has been successfully registered!\n\n` +
          `• Role: ${data.role || 'Not specified'}\n` +
          `• Gross Salary: ₦${data.gross_salary.toLocaleString()}\n` +
          `• Start Date: ${data.start_date}\n` +
          `• Bank Account: ${data.bank_name} - ${data.bank_account || 'Not specified'}`,
        timestamp: new Date(),
        actions: [{ type: 'view_report', label: '👤 View Employees', payload: { page: 'payroll' } }],
      }));
    } catch (err: any) {
      console.error("Failed to add employee:", err);
      setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
        id: `employee-err-${Date.now()}`, role: 'assistant',
        content: `❌ Failed to add employee: ${err.message || err}`,
        timestamp: new Date(),
      }));
    } finally {
      setTyping(false);
    }
  }

  // ── Helper: Process Payroll ─────────────────────────────────────────────────

  async function processPayrollFromAI(employeeName: string, grossAmount: number) {
    const loadingId = `payroll-loading-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: loadingId, role: 'assistant',
      content: `⏳ Processing salary for **${employeeName}**…`,
      timestamp: new Date(),
    }]);

    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const periodLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    try {
      const { data: tx, error: txErr } = await supabase.from('transactions').insert({
        user_id: user!.id,
        amount: grossAmount,
        type: 'expense',
        description: `Salary — ${employeeName} (${periodLabel})`,
        date: periodEnd,
        notes: 'Processed via ROVA AI Assistant',
      }).select().maybeSingle();

      if (txErr) throw txErr;

      const result = await applyPayrollIntent({
        userId: user!.id,
        employeeName,
        amount: grossAmount,
        transactionId: tx?.id || '',
        date: periodEnd,
      });

      if (!result.success) throw new Error(result.error || 'Payroll processing failed');

      const payeRate = 7.5;
      const pensionRate = 8.0;
      const paye = grossAmount * (payeRate / 100);
      const pension = grossAmount * (pensionRate / 100);
      const net = grossAmount - paye - pension;

      setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
        id: `payroll-ok-${Date.now()}`, role: 'assistant',
        content: `✅ Payroll processed for **${employeeName}** (${periodLabel}):\n\n` +
          `• Gross: ₦${grossAmount.toLocaleString()}\n` +
          `• PAYE (${payeRate}%): ₦${paye.toLocaleString()}\n` +
          `• Pension (${pensionRate}%): ₦${pension.toLocaleString()}\n` +
          `• **Net Pay: ₦${net.toLocaleString()}**\n\n` +
          `Expense transaction and payslip have been recorded automatically.`,
        timestamp: new Date(),
        actions: [{ type: 'view_report', label: '📊 View Payroll', payload: {} }],
      }));
    } catch (err: any) {
      const msg = err.message?.includes('not found')
        ? `I couldn't find an employee named **"${employeeName}"** in your records. Please add them in the Payroll → Employees section first, then I can process their salary directly.`
        : `❌ Payroll error: ${err.message || err}`;
      setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
        id: `payroll-err-${Date.now()}`, role: 'assistant',
        content: msg,
        timestamp: new Date(),
      }));
    } finally {
      setTyping(false);
    }
  }

  // ── Handle action buttons ───────────────────────────────────────────────────

  async function handleAction(action: ChatAction) {
    switch (action.type) {

      // ── Invoice ────────────────────────────────────────────────────────────
      case 'create_invoice': {
        const payload = action.payload || {};
        if (payload.client_name) {
          setTyping(true);
          const loadingMsgId = `loading-${Date.now()}`;
          setMessages(prev => [...prev, {
            id: loadingMsgId, role: 'assistant',
            content: `⏳ Creating invoice for **${payload.client_name}**…`,
            timestamp: new Date(),
          }]);
          createInvoice({
            userId: user!.id,
            client_name: payload.client_name,
            client_email: payload.client_email,
            client_address: payload.client_address,
            due_date: payload.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            tax_rate: Number(payload.tax_rate) || 0,
            notes: payload.notes || 'Created via ROVA AI Assistant',
            payment_status: payload.payment_status || 'unpaid',
            amount_paid: Number(payload.amount_paid) || 0,
            items: (payload.items && Array.isArray(payload.items))
              ? payload.items.map((item: any) => ({
                  description: item.description || 'Service',
                  quantity: Number(item.quantity) || 1,
                  unit_price: Number(item.unit_price) || 0,
                  inventory_item_id: item.inventory_item_id || null,
                }))
              : [{
                  description: payload.item_description || payload.description || 'Professional Services',
                  quantity: 1,
                  unit_price: Number(payload.amount) || 0,
                  inventory_item_id: null,
                }],
          })
            .then(newInv => {
              setMessages(prev => prev.filter(m => m.id !== loadingMsgId).concat({
                id: `inv-ok-${Date.now()}`, role: 'assistant',
                content: `✅ Invoice **${newInv.invoice_number}** created for **${newInv.client_name}** — total **₦${newInv.total.toLocaleString()}**. You can review and send it from the Invoices page.`,
                timestamp: new Date(),
                actions: [{ type: 'view_invoice', label: '📄 View Invoice', payload: { invoice_id: newInv.id } }],
              }));
            })
            .catch(err => {
              setMessages(prev => prev.filter(m => m.id !== loadingMsgId).concat({
                id: `inv-err-${Date.now()}`, role: 'assistant',
                content: `❌ Couldn't create the invoice: ${err.message || err}`,
                timestamp: new Date(),
              }));
            })
            .finally(() => setTyping(false));
        } else {
          navigate('/app/invoices', { state: { openCreateModal: true, payload } });
        }
        break;
      }

      case 'view_invoice':
        navigate('/app/invoices', { state: { viewInvoiceId: action.payload?.invoice_id || action.payload?.id } });
        break;

      // ── Payroll ────────────────────────────────────────────────────────────
      case 'record_payroll': {
        const payload = action.payload || {};
        const employeeName: string = payload.employee_name || payload.employee || '';
        const grossAmount: number = Number(payload.gross_amount || payload.amount || 0);

        if (employeeName && grossAmount > 0) {
          // Has enough info — process directly via the helper
          setTyping(true);
          await processPayrollFromAI(employeeName, grossAmount);
        } else {
          // Not enough info — open payroll page as fallback
          navigate('/app/payroll', { state: { openCreateModal: true, payload } });
        }
        break;
      }

      // ── Inventory ──────────────────────────────────────────────────────────
      case 'add_inventory': {
        const payload = action.payload || {};
        if (payload.name) {
          addInventoryFromAI(payload);
        } else {
          navigate('/app/inventory', { state: { openCreateModal: true, payload } });
        }
        break;
      }

      // ── Employee ───────────────────────────────────────────────────────────
      case 'add_employee': {
        const payload = action.payload || {};
        if (payload.full_name) {
          addEmployeeFromAI(payload);
        } else {
          navigate('/app/payroll', { state: { openCreateModal: true, payload } });
        }
        break;
      }

      // ── Reports ────────────────────────────────────────────────────────────
      case 'view_report':
        if (action.payload?.page === 'inventory') {
          navigate('/app/inventory');
        } else if (action.payload?.page === 'payroll') {
          navigate('/app/payroll');
        } else {
          navigate('/app/reports');
        }
        break;

      // ── Clarify Transaction (update description from AI/user answer) ──────
      case 'clarify_transaction': {
        const payload = action.payload || {};
        const txId = payload.transaction_id;
        const newDescription = payload.description || payload.answer;
        const newCategory = payload.category;

        if (txId && newDescription) {
          // Update the transaction description in the database
          const { error: updateErr } = await supabase
            .from('transactions')
            .update({
              description: newDescription,
              notes: payload.original_description
                ? `Clarified via ROVA AI. Original: "${payload.original_description}"`
                : 'Updated via ROVA AI Assistant',
            })
            .eq('id', txId);

          if (!updateErr) {
            // Update local state
            setTransactions(prev =>
              prev.map(t =>
                t.id === txId
                  ? { ...t, description: newDescription, notes: payload.original_description ? `Clarified via ROVA AI. Original: "${payload.original_description}"` : 'Updated via ROVA AI Assistant' }
                  : t
              )
            );
          }

          // Re-classify with the new description
          classifyTransaction(
            {
              id: txId,
              description: newDescription,
              amount: payload.amount || undefined,
              type: payload.type || 'expense',
            },
            user!.id,
            'full'
          ).catch(err => console.error('Failed to re-classify:', err));

          setMessages(prev => [...prev, {
            id: `clarify-ok-${Date.now()}`,
            role: 'assistant',
            content: `✅ Transaction updated to: **${newDescription}**${newCategory ? ` (Category: ${newCategory})` : ''}`,
            timestamp: new Date(),
          }]);
        }
        break;
      }

      default:
        break;
    }
  }

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || typing) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setTyping(true);

      try {
        const history = messages
          .filter(m => !m.isTyping)
          .slice(-10)
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        history.push({ role: 'user', content: text });

        const response = await chatWithAssistant({
          messages: history,
          context: {
            transactions: transactions.slice(0, 100),
            accounts,
            userId: user!.id,
            isStaff,
          },
        });

        const responseActions = response.actions ?? [];

        setMessages(prev => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: response.reply,
            timestamp: new Date(),
            actions: responseActions,
          },
        ]);

        // Auto-process clarify_transaction actions from the AI response
        // so the transaction description is updated immediately
        for (const action of responseActions) {
          if (action.type === 'clarify_transaction') {
            const payload = action.payload || {};
            const txId = payload.transaction_id;
            const newDesc = payload.description || payload.answer;
            if (txId && newDesc) {
              supabase
                .from('transactions')
                .update({
                  description: newDesc,
                  notes: payload.original_description
                    ? `Clarified via ROVA AI. Original: "${payload.original_description}"`
                    : 'Updated via ROVA AI Assistant',
                })
                .eq('id', txId)
                .then(({ error }) => {
                  if (!error) {
                    console.log("ROVA: Auto-updated transaction description in DB to:", newDesc);
                    setTransactions(prev =>
                      prev.map(t => t.id === txId ? { ...t, description: newDesc } : t)
                    );
                    // Only re-classify after description update succeeds
                    classifyTransaction(
                      { id: txId, description: newDesc, amount: payload.amount, type: payload.type || 'expense' },
                      user!.id,
                      'full'
                    ).catch(err => console.error('ROVA: Auto-reclassify failed:', err));
                  } else {
                    console.error("ROVA: Auto-process description update failed:", error);
                  }
                });
            }
          }
        }
      } catch (err: any) {
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `Sorry, I had trouble responding. ${err.message?.includes('api-chat') ? 'Make sure the ai-chat edge function is deployed.' : err.message ?? 'Please try again.'}`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setTyping(false);
      }
    },
    [messages, transactions, accounts, user, isStaff, typing]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) sendMessage(input.trim());
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1100, animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ color: 'white', fontWeight: 800, fontSize: 15, fontFamily: 'Space Grotesk, sans-serif' }}>S</span>
            </div>
            <h1 style={{ fontSize: 22 }}>ROVA Assistant</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            AI-powered financial advisor — insights, actions, and answers from your real data
          </p>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', fontSize: 13,
            transition: 'all 0.15s', cursor: 'pointer',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-border)')}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* ── Pending Clarifications Panel ─────────────────────────────────────── */}
      {clarifications.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 13, fontWeight: 600, color: '#f59e0b',
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Bell size={13} color="#f59e0b" />
            Pending Clarifications ({clarifications.length})
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
              — Help ROVA categorise these transactions correctly
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clarifications.map(item => (
              <ClarificationCard
                key={item.id}
                item={item}
                onResolve={handleResolve}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Main Grid ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 380px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Left column: Insights + Starters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Smart Insights */}
          <div>
            <div
              style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Zap size={13} color="var(--accent-light)" />
              Smart Insights
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton" style={{ height: 72 }} />
                ))}
              </div>
            ) : insights.length === 0 ? (
              <Card>
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Add more transactions for personalised insights
                </div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {insights.map(insight => {
                  const style = SEVERITY_STYLES[insight.severity];
                  return (
                    <div
                      key={insight.id}
                      style={{
                        padding: '14px 16px', borderRadius: 'var(--radius-md)',
                        background: style.bg, border: `1px solid ${style.border}`,
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        animation: 'fadeIn 0.3s ease',
                      }}
                    >
                      <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{insight.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                          {insight.title}
                        </div>
                        <div
                          style={{
                            fontSize: 12, color: 'var(--text-secondary)',
                            lineHeight: 1.5, whiteSpace: 'pre-line',
                          }}
                        >
                          {insight.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Starters */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Quick Questions
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {STARTERS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  disabled={typing}
                  style={{
                    padding: '7px 12px', borderRadius: 'var(--radius-full)', fontSize: 12,
                    background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                    color: 'var(--text-secondary)', transition: 'all 0.15s', cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--accent-light)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-border)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Chat */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', height: 580,
            background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          }}
        >
          {/* Chat header */}
          <div
            style={{
              padding: '14px 16px', borderBottom: '1px solid var(--bg-border)',
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--success)', boxShadow: '0 0 6px var(--success)',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Chat with ROVA
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {messages.filter(m => m.role === 'user').length} messages
              </span>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1, overflowY: 'auto', padding: '14px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
              >
                {msg.role === 'assistant' && (
                  <div
                    style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginRight: 8, marginTop: 2,
                    }}
                  >
                    <span style={{ color: 'white', fontWeight: 800, fontSize: 13, fontFamily: 'Space Grotesk, sans-serif' }}>S</span>
                  </div>
                )}
                <div style={{ maxWidth: '85%' }}>
                  <div
                    style={{
                      padding: '10px 13px',
                      borderRadius:
                        msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background:
                        msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-line',
                      border: msg.role === 'assistant' ? '1px solid var(--bg-border)' : 'none',
                    }}
                  >
                    {msg.content}
                  </div>

                  {/* Action buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingLeft: 4 }}>
                      {msg.actions.map((action, i) => (
                        <ActionButton key={i} action={action} onAction={handleAction} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span style={{ color: 'white', fontWeight: 800, fontSize: 13, fontFamily: 'Space Grotesk, sans-serif' }}>S</span>
                </div>
                <div
                  style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                    borderRadius: '14px 14px 14px 4px', padding: '10px 16px',
                    display: 'flex', gap: 4,
                  }}
                >
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
                        animation: `spin 1s ease-in-out ${i * 0.15}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '12px 14px', borderTop: '1px solid var(--bg-border)',
              display: 'flex', gap: 8, flexShrink: 0,
            }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything about your finances…"
              disabled={typing}
              style={{
                flex: 1, padding: '9px 12px', background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)', outline: 'none', fontSize: 13,
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent-primary)')}
              onBlur={e => (e.target.style.borderColor = 'var(--bg-border)')}
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              style={{
                width: 38, height: 38, borderRadius: 'var(--radius-md)', flexShrink: 0,
                background: input.trim() && !typing ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: input.trim() && !typing ? 'white' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', border: '1px solid var(--bg-border)', cursor: 'pointer',
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
