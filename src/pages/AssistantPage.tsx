import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, RefreshCw,
  Bell, ChevronRight, Package, Users, FileText, X,
  MessageCircle, MessageSquare, ExternalLink, HelpCircle, TrendingUp, Brain
} from 'lucide-react';
import { supabase, type Transaction, type Account, type Expense, type Bill, type ExternalWorker, type ServiceAgreement } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  classifyTransaction,
  chatWithAssistant,
  confirmPendingAction,
  fetchPendingClarifications,
  resolveClarification,
  dismissClarification,
  applyPayrollIntent,
  type PendingClarification,
  type ChatAction,
} from '../lib/deepseekClient';

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



const ACTION_ICONS: Record<string, React.ElementType> = {
  create_invoice: FileText,
  add_inventory: Package,
  record_payroll: Users,
  clarify_transaction: HelpCircle,
  view_report: TrendingUp,
  open_whatsapp_bot: MessageCircle,
};

const ACTION_COLORS: Record<string, string> = {
  create_invoice: '#818cf8',
  add_inventory: '#34d399',
  record_payroll: '#fbbf24',
  clarify_transaction: '#60a5fa',
  view_report: '#a78bfa',
  open_whatsapp_bot: '#25D366',
};

const STARTERS = [
  'How much did I make this month?',
  'What are my total expenses this week?',
  'Who owes me money?',
  'How many staff are on my payroll?',
  'Show me my inventory stock levels',
  'Who are my customers?',
  'I want to create an invoice',
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
  const isWhatsApp = action.type === 'open_whatsapp_bot';
  const color = isWhatsApp ? '#25D366' : (ACTION_COLORS[action.type] ?? '#a78bfa');

  if (isWhatsApp) {
    return (
      <button
        onClick={() => onAction(action)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, #1da851, #128C3E)',
          border: '1px solid rgba(18, 140, 62, 0.8)',
          color: '#ffffff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', marginTop: 6,
          boxShadow: '0 4px 14px rgba(18, 140, 62, 0.35)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'linear-gradient(135deg, #25D366, #1da851)';
          el.style.transform = 'translateY(-1px)';
          el.style.boxShadow = '0 6px 20px rgba(18, 140, 62, 0.45)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'linear-gradient(135deg, #1da851, #128C3E)';
          el.style.transform = 'none';
          el.style.boxShadow = '0 4px 14px rgba(18, 140, 62, 0.35)';
        }}
      >
        <img
          src="/whatsapp-logo.png"
          alt="WhatsApp"
          style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }}
        />
        <span>{action.label.replace(/^💬\s*/, '')}</span>
        <ExternalLink size={13} style={{ opacity: 0.9, marginLeft: 2 }} />
      </button>
    );
  }

  return (
    <button
      onClick={() => onAction(action)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 'var(--radius-full)',
        background: `${color}25`, border: `1px solid ${color}45`,
        color: '#ffffff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.15s', marginTop: 4,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}40`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}25`; }}
    >
      <Icon size={13} color={color} />
      {action.label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const { user, isStaff, staffData } = useAuth();
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;
  const isMobile = useMobile(1024);
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [externalWorkers, setExternalWorkers] = useState<ExternalWorker[]>([]);
  const [serviceAgreements, setServiceAgreements] = useState<ServiceAgreement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [clarifications, setClarifications] = useState<PendingClarification[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]); // will be set on load or keep default
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [activeInventoryFlow, setActiveInventoryFlow] = useState<any | null>(null);
  const [pendingToolCall, setPendingToolCall] = useState<{ name: string; parameters: Record<string, any> } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize messages with welcome if it doesn't exist
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "Hi! I'm ROVA, your AI-powered business assistant. I've analysed your transactions and I'm ready to help. Ask me anything about your finances, or record expenses, upload receipts & send voice notes directly via WhatsApp!",
        timestamp: new Date(),
        actions: [
          { type: 'open_whatsapp_bot', label: '💬 Chat with ROVA Bot on WhatsApp' }
        ]
      },
    ]);
  }, []);

  useEffect(() => {
    if (effectiveUserId) { loadData(); loadClarifications(); }
  }, [effectiveUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadData() {
    if (!effectiveUserId) return;
    const [txRes, accRes, catRes, invRes, expRes, billsRes, workersRes, agreementsRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*), account:accounts(*)')
        .eq('user_id', effectiveUserId)
        .order('date', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', effectiveUserId).eq('is_active', true),
      supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${effectiveUserId},is_system.eq.true`),
      supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('status', 'active'),
      supabase
        .from('expenses')
        .select('*, category:categories(*)')
        .eq('user_id', effectiveUserId)
        .order('date', { ascending: false }),
      supabase
        .from('bills')
        .select('*, category:categories(*), bill_payments(*)')
        .eq('user_id', effectiveUserId)
        .order('due_date', { ascending: true }),
      supabase
        .from('external_workers')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('name'),
      supabase
        .from('service_agreements')
        .select('*, worker:external_workers(*)')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false }),
    ]);
    const txs = txRes.data || [];
    const accs = accRes.data || [];
    const cats = catRes.data || [];
    const invs = invRes.data || [];
    setTransactions(txs);
    setAccounts(accs);
    setCategories(cats);
    setInventoryItems(invs);
    setExpenses(expRes.data || []);
    setBills(billsRes.data || []);
    setExternalWorkers(workersRes.data || []);
    setServiceAgreements(agreementsRes.data || []);
  }

  async function loadClarifications() {
    try {
      const items = await fetchPendingClarifications(effectiveUserId!);
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


  async function handleResolve(id: string, answer: string, notifId: string | null) {
    await resolveClarification(id, notifId);
    setClarifications(prev => prev.filter(c => c.id !== id));

    const clarification = clarifications.find(c => c.id === id);
    if (clarification) {
      // First update transaction description so it's documented in DB
      if (clarification.transaction_id) {
        await supabase
          .from('transactions')
          .update({
            description: answer,
            notes: `Clarified via ROVA AI. Original: "${clarification.original_description}"`,
          })
          .eq('id', clarification.transaction_id);

        setTransactions(prev =>
          prev.map(t =>
            t.id === clarification.transaction_id
              ? { ...t, description: answer, notes: `Clarified via ROVA AI. Original: "${clarification.original_description}"` }
              : t
          )
        );
      }

      // ALWAYS ask the user if they want to allocate this to inventory
      const userMsg: ChatMessage = {
        id: `u-resolve-${Date.now()}`,
        role: 'user',
        content: answer,
        timestamp: new Date(),
      };

      const assistantMsg: ChatMessage = {
        id: `a-resolve-inv-confirm-${Date.now()}`,
        role: 'assistant',
        content: `Got it! I've updated the transaction description to: **${answer}**.\n\nWould you like to allocate this transaction to **Inventory** and track **${answer}** in your stock?`,
        timestamp: new Date(),
        actions: [
          {
            type: 'confirm_inventory_allocation',
            label: '📦 Yes, track as inventory',
            payload: { itemName: answer, clarification },
          },
          {
            type: 'skip_inventory_allocation',
            label: '❌ No, just record as regular expense',
            payload: { answer, clarification },
          }
        ],
      };

      setMessages(prev => [...prev, userMsg, assistantMsg]);
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
          user_id: effectiveUserId,
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
          user_id: effectiveUserId,
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
        user_id: effectiveUserId,
        amount: grossAmount,
        type: 'expense',
        description: `Salary — ${employeeName} (${periodLabel})`,
        date: periodEnd,
        notes: 'Processed via ROVA AI Assistant',
      }).select().maybeSingle();

      if (txErr) throw txErr;

      const result = await applyPayrollIntent({
        userId: effectiveUserId!,
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
            userId: effectiveUserId!,
            client_name: payload.client_name,
            client_email: payload.client_email,
            client_address: payload.client_address,
            due_date: payload.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            tax_rate: Number(payload.tax_rate) || 0,
            discount_rate: Number(payload.discount_rate) || 0,
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

      case 'open_whatsapp_bot':
        window.open('https://wa.me/2349132957881?text=Hello%20ROVA!%20I%20want%20to%20start%20logging%20my%20transactions.', '_blank');
        break;

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

      // ── Edit Transaction ───────────────────────────────────────────────────
      case 'update_transaction': {
        const payload = action.payload || {};
        const txId = payload.transaction_id;
        const newCategoryName = payload.category_name || payload.category;
        const newDescription = payload.description;
        const newAmount = payload.amount;
        const newDate = payload.date;

        if (txId) {
          const updates: any = {};
          if (newDescription) updates.description = newDescription;
          if (newAmount !== undefined && newAmount !== null) updates.amount = Number(newAmount);
          if (newDate) updates.date = newDate;

          const runUpdate = async () => {
            if (newCategoryName) {
              const matchedCat = categories.find(c => 
                c.name.toLowerCase() === newCategoryName.toLowerCase()
              );
              if (matchedCat) {
                updates.category_id = matchedCat.id;
              } else {
                const { data: newCat, error: createCatErr } = await supabase
                  .from('categories')
                  .insert({
                    user_id: effectiveUserId,
                    name: newCategoryName,
                    type: payload.type || 'expense',
                    is_system: false
                  })
                  .select()
                  .single();
                if (!createCatErr && newCat) {
                  setCategories(prev => [...prev, newCat]);
                  updates.category_id = newCat.id;
                }
              }
            }

            if (Object.keys(updates).length > 0) {
              const { error: updateErr } = await supabase
                .from('transactions')
                .update(updates)
                .eq('id', txId);

              if (!updateErr) {
                setTransactions(prev =>
                  prev.map(t => {
                    if (t.id === txId) {
                      const updatedTx = { ...t, ...updates };
                      if (updates.category_id) {
                        const catObj = categories.find(c => c.id === updates.category_id) || t.category;
                        updatedTx.category = catObj;
                      }
                      return updatedTx;
                    }
                    return t;
                  })
                );
                setMessages(prev => [...prev, {
                  id: `update-ok-${Date.now()}`,
                  role: 'assistant',
                  content: `✅ Transaction updated successfully!`,
                  timestamp: new Date(),
                }]);
              } else {
                setMessages(prev => [...prev, {
                  id: `update-err-${Date.now()}`,
                  role: 'assistant',
                  content: `❌ Failed to update transaction: ${updateErr.message}`,
                  timestamp: new Date(),
                }]);
              }
            }
          };
          runUpdate().catch(err => console.error("Update action failed:", err));
        }
        break;
      }

      // ── Delete Transaction ───────────────────────────────────────────────────
      case 'delete_transaction': {
        const payload = action.payload || {};
        const txId = payload.transaction_id;

        if (txId) {
          supabase
            .from('transactions')
            .delete()
            .eq('id', txId)
            .then(({ error: deleteErr }) => {
              if (!deleteErr) {
                setTransactions(prev => prev.filter(t => t.id !== txId));
                setMessages(prev => [...prev, {
                  id: `delete-ok-${Date.now()}`,
                  role: 'assistant',
                  content: `✅ Transaction deleted successfully.`,
                  timestamp: new Date(),
                }]);
              } else {
                setMessages(prev => [...prev, {
                  id: `delete-err-${Date.now()}`,
                  role: 'assistant',
                  content: `❌ Failed to delete transaction: ${deleteErr.message}`,
                  timestamp: new Date(),
                }]);
              }
            });
        }
        break;
      }

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
            effectiveUserId!,
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

      // ── Edit Inventory ─────────────────────────────────────────────────────
      case 'edit_inventory': {
        const payload = action.payload || {};
        if (payload.is_movement) {
          navigate('/app/inventory', { state: { openCreateModal: true, payload } });
          break;
        }
        const itemId = payload.item_id;
        if (itemId) {
          const updates: any = {};
          if (payload.name) updates.name = payload.name;
          if (payload.sku) updates.sku = payload.sku;
          if (payload.category) updates.category = payload.category;
          if (payload.unit) updates.unit = payload.unit;
          if (payload.cost_price !== undefined) updates.cost_price = Number(payload.cost_price);
          if (payload.selling_price !== undefined) updates.selling_price = Number(payload.selling_price);
          if (payload.current_stock !== undefined) updates.current_stock = Number(payload.current_stock);
          if (payload.reorder_level !== undefined) updates.reorder_level = Number(payload.reorder_level);

          if (Object.keys(updates).length > 0) {
            const runUpdate = async () => {
              setTyping(true);
              const loadingMsgId = `loading-${Date.now()}`;
              setMessages(prev => [...prev, {
                id: loadingMsgId, role: 'assistant',
                content: `⏳ Saving changes to inventory item…`,
                timestamp: new Date(),
              }]);

              try {
                const { error } = await supabase
                  .from('inventory_items')
                  .update(updates)
                  .eq('id', itemId);

                setMessages(prev => prev.filter(m => m.id !== loadingMsgId));

                if (!error) {
                  setMessages(prev => [...prev, {
                    id: `edit-inv-ok-${Date.now()}`,
                    role: 'assistant',
                    content: `✅ Inventory item updated successfully!`,
                    timestamp: new Date(),
                    actions: [{ type: 'view_report', label: '📦 View Inventory', payload: { page: 'inventory' } }],
                  }]);
                  loadData();
                } else {
                  setMessages(prev => [...prev, {
                    id: `edit-inv-err-${Date.now()}`,
                    role: 'assistant',
                    content: `❌ Failed to update inventory item: ${error.message}`,
                    timestamp: new Date(),
                  }]);
                }
              } catch (err: any) {
                setMessages(prev => prev.filter(m => m.id !== loadingMsgId).concat({
                  id: `edit-inv-err-${Date.now()}`,
                  role: 'assistant',
                  content: `❌ Failed to update inventory item: ${err.message || err}`,
                  timestamp: new Date(),
                }));
              } finally {
                setTyping(false);
              }
            };
            runUpdate();
          }
        }
        break;
      }

      // ── Delete Inventory ───────────────────────────────────────────────────
      case 'delete_inventory': {
        const payload = action.payload || {};
        const itemId = payload.item_id;
        if (itemId) {
          const runDelete = async () => {
            setTyping(true);
            const loadingMsgId = `loading-${Date.now()}`;
            setMessages(prev => [...prev, {
              id: loadingMsgId, role: 'assistant',
              content: `⏳ Deleting inventory item…`,
              timestamp: new Date(),
            }]);

            try {
              const { error } = await supabase
                .from('inventory_items')
                .delete()
                .eq('id', itemId);

              setMessages(prev => prev.filter(m => m.id !== loadingMsgId));

              if (!error) {
                setMessages(prev => [...prev, {
                  id: `delete-inv-ok-${Date.now()}`,
                  role: 'assistant',
                  content: `✅ Inventory item deleted successfully.`,
                  timestamp: new Date(),
                  actions: [{ type: 'view_report', label: '📦 View Inventory', payload: { page: 'inventory' } }],
                }]);
                loadData();
              } else {
                setMessages(prev => [...prev, {
                  id: `delete-inv-err-${Date.now()}`,
                  role: 'assistant',
                  content: `❌ Failed to delete inventory item: ${error.message}`,
                  timestamp: new Date(),
                }]);
              }
            } catch (err: any) {
              setMessages(prev => prev.filter(m => m.id !== loadingMsgId).concat({
                id: `delete-inv-err-${Date.now()}`,
                role: 'assistant',
                content: `❌ Failed to delete inventory item: ${err.message || err}`,
                timestamp: new Date(),
              }));
            } finally {
              setTyping(false);
            }
          };
          runDelete();
        }
        break;
      }

      // ── Confirm Inventory Allocation ────────────────────────────────────────
      case 'confirm_inventory_allocation': {
        const { itemName, clarification } = action.payload || {};
        if (!itemName) break;

        const flow = {
          step: 'single_message',
          clarification,
          itemName: itemName.trim(),
        };
        setActiveInventoryFlow(flow);

        const totalAmt = clarification?.suggested_amount;
        const totalNote = totalAmt ? `\n*(Cost price per unit will be automatically calculated based on your ₦${totalAmt.toLocaleString()} transaction).*` : '';

        setMessages(prev => [...prev, {
          id: `a-inv-start-${Date.now()}`,
          role: 'assistant',
          content: `Great! Let's set up **${itemName.trim()}** in your inventory.${totalNote}\n\nPlease reply in **one message** with your item parameters using comma-separated values (or list them):` +
            `\n\n**Category, Unit, Quantity, Selling Price, Reorder Level**` +
            `\n\n*Example:* \`Food, kg, 10, 250, 5\``,
          timestamp: new Date(),
        }]);
        break;
      }

      // ── Skip Inventory Allocation (just expense) ────────────────────────────
      case 'skip_inventory_allocation': {
        const { answer, clarification } = action.payload || {};
        setMessages(prev => [...prev, {
          id: `a-inv-skip-${Date.now()}`,
          role: 'assistant',
          content: `Understood! The transaction has been recorded as a regular expense for **${answer || 'this purchase'}**. No inventory item was created.`,
          timestamp: new Date(),
        }]);

        // Re-classify as regular expense
        if (clarification?.transaction_id) {
          classifyTransaction(
            {
              id: clarification.transaction_id,
              description: answer || clarification.original_description,
              amount: clarification.suggested_amount || undefined,
              type: 'expense',
            },
            effectiveUserId!,
            'full'
          ).catch(err => console.error('ROVA: Failed to re-classify skipped clarification:', err));
        }
        break;
      }

      // ── Select Inventory Item (disambiguation) ───────────────────────────
      case 'select_inventory_item': {
        const payload = action.payload || {};
        setMessages(prev => [...prev, {
          id: `a-inv-select-${Date.now()}`,
          role: 'assistant',
          content: `Got it! You selected **${payload.item_name}**. It currently has **${payload.current_stock} units** in stock. What would you like to do with it?`,
          timestamp: new Date(),
          actions: [
            { type: 'edit_inventory', label: '📦 Update Stock', payload: { item_id: payload.item_id, is_movement: true } },
          ],
        }]);
        break;
      }

      // ── Confirm / Cancel pending AI action ───────────────────────────────
      case 'confirm_action': {
        if (!pendingToolCall) break;
        const ptc = pendingToolCall;
        setPendingToolCall(null);
        setTyping(true);
        try {
          const history = messages
            .filter(m => !m.isTyping)
            .slice(-10)
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
          const response = await confirmPendingAction(
            { messages: history, context: { transactions: transactions.slice(0, 50), accounts, userId: effectiveUserId!, isStaff } },
            ptc
          );
          setMessages(prev => [...prev, {
            id: `a-confirmed-${Date.now()}`,
            role: 'assistant',
            content: response.reply,
            timestamp: new Date(),
            actions: response.actions ?? [],
          }]);
        } catch (err: any) {
          setMessages(prev => [...prev, {
            id: `a-confirm-err-${Date.now()}`,
            role: 'assistant',
            content: `❌ Action failed: ${err.message || err}`,
            timestamp: new Date(),
          }]);
        } finally {
          setTyping(false);
        }
        break;
      }

      case 'cancel_action': {
        setPendingToolCall(null);
        setMessages(prev => [...prev, {
          id: `a-cancel-${Date.now()}`,
          role: 'assistant',
          content: `No problem — action cancelled. Let me know if there's anything else I can help with.`,
          timestamp: new Date(),
        }]);
        break;
      }

      default:
        break;
    }
  }

  // ── Send message ────────────────────────────────────────────────────────────

  const finalizeInventoryCreation = useCallback(
    async (flow: any) => {
      const loadingId = `finalize-loading-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: loadingId,
        role: 'assistant',
        content: `⏳ Finalizing inventory item **${flow.itemName}**…`,
        timestamp: new Date(),
      }]);

      try {
        // 1. Insert the inventory item
        const { data: item, error: itemErr } = await supabase
          .from('inventory_items')
          .insert({
            user_id: effectiveUserId,
            name: flow.itemName,
            sku: `SKU-${Date.now()}`,
            category: flow.category || 'General',
            unit: flow.unit || 'unit',
            cost_price: flow.cost_price || 0,
            selling_price: flow.selling_price || 0,
            current_stock: flow.current_stock || 0,
            reorder_level: flow.reorder_level || 0,
            status: 'active',
          })
          .select()
          .single();

        if (itemErr) throw itemErr;

        // 2. Insert the inventory transaction
        const { error: txErr } = await supabase
          .from('inventory_transactions')
          .insert({
            user_id: effectiveUserId,
            item_id: item.id,
            transaction_id: flow.clarification.transaction_id || null,
            type: 'purchase',
            quantity: flow.current_stock,
            unit_cost: flow.cost_price,
            total_cost: (flow.current_stock || 0) * (flow.cost_price || 0),
            date: new Date().toISOString().split('T')[0],
            notes: 'Auto-recorded via ROVA AI clarification interrogation',
          });

        if (txErr) console.error("Error creating inventory transaction:", txErr);

        // 3. Update the original transaction if exists
        if (flow.clarification.transaction_id) {
          const { data: inventoryCat } = await supabase
            .from('categories')
            .select('id')
            .eq('name', 'Inventory')
            .maybeSingle();

          const updates: any = {};
          if (inventoryCat) {
            updates.category_id = inventoryCat.id;
          }
          updates.notes = `Clarified and allocated to inventory item "${flow.itemName}". Original: "${flow.clarification.original_description}"`;

          await supabase
            .from('transactions')
            .update(updates)
            .eq('id', flow.clarification.transaction_id);

          setTransactions(prev =>
            prev.map(t =>
              t.id === flow.clarification.transaction_id
                ? { ...t, ...updates, category: inventoryCat || t.category }
                : t
            )
          );
        }

        loadData();

        setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
          id: `inv-finalize-ok-${Date.now()}`,
          role: 'assistant',
          content: `✅ Successfully created inventory item **${flow.itemName}**!\n\n` +
            `• Category: ${item.category}\n` +
            `• Unit: ${item.unit}\n` +
            `• Stock Added: ${item.current_stock} ${item.unit}\n` +
            `• Cost Price: ₦${item.cost_price.toLocaleString()}\n` +
            `• Selling Price: ₦${item.selling_price.toLocaleString()}\n` +
            `• Reorder Level: ${item.reorder_level} ${item.unit}\n\n` +
            `The original financial transaction has been categorized under Inventory and linked.`,
          timestamp: new Date(),
          actions: [{ type: 'view_report', label: '📦 View Inventory', payload: { page: 'inventory' } }],
        }));

      } catch (err: any) {
        console.error("Failed to finalize inventory creation:", err);
        setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
          id: `inv-finalize-err-${Date.now()}`,
          role: 'assistant',
          content: `❌ Failed to create inventory item: ${err.message || err}`,
          timestamp: new Date(),
        }));
      } finally {
        setTyping(false);
      }
    },
    [effectiveUserId, loadData, setMessages, setTransactions]
  );

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

      if (activeInventoryFlow) {
        const currentFlow = { ...activeInventoryFlow };

        // Parse 1-message inventory parameters
        const textClean = text.trim();
        let category = 'General';
        let unit = 'unit';
        let quantity = 0;
        let sellingPrice = 0;
        let reorderLevel = 5;

        // Parse Key: Value format if user provided multiline
        const lines = textClean.split('\n');
        const kv: Record<string, string> = {};
        lines.forEach(line => {
          const parts = line.split(/[:=]/);
          if (parts.length >= 2) {
            kv[parts[0].trim().toLowerCase()] = parts.slice(1).join(':').trim();
          }
        });

        if (kv['category']) category = kv['category'];
        if (kv['unit']) unit = kv['unit'];
        if (kv['quantity'] || kv['qty'] || kv['stock']) {
          quantity = parseFloat((kv['quantity'] || kv['qty'] || kv['stock']).replace(/,/g, '')) || 0;
        }
        if (kv['selling price'] || kv['selling_price'] || kv['price'] || kv['selling']) {
          sellingPrice = parseFloat((kv['selling price'] || kv['selling_price'] || kv['price'] || kv['selling']).replace(/[₦,\s]/g, '')) || 0;
        }
        if (kv['reorder level'] || kv['reorder_level'] || kv['reorder'] || kv['alert']) {
          reorderLevel = parseFloat((kv['reorder level'] || kv['reorder_level'] || kv['reorder'] || kv['alert']).replace(/,/g, '')) || 5;
        }

        // Parse comma-separated (Category, Unit, Quantity, Selling Price, Reorder Level)
        if (quantity === 0 && textClean.includes(',')) {
          const parts = textClean.split(',').map(s => s.trim());
          if (parts.length >= 1 && parts[0]) category = parts[0];
          if (parts.length >= 2 && parts[1]) unit = parts[1];
          if (parts.length >= 3) quantity = parseFloat(parts[2].replace(/,/g, '')) || 0;
          if (parts.length >= 4) sellingPrice = parseFloat(parts[3].replace(/[₦,\s]/g, '')) || 0;
          if (parts.length >= 5) reorderLevel = parseFloat(parts[4].replace(/,/g, '')) || 5;
        }

        // Fallback: search numbers if quantity wasn't found
        if (quantity === 0) {
          const numbers = textClean.match(/\d+(\.\d+)?/g);
          if (numbers && numbers.length >= 1) {
            quantity = parseFloat(numbers[0]) || 1;
            if (numbers.length >= 2) sellingPrice = parseFloat(numbers[1]) || 0;
            if (numbers.length >= 3) reorderLevel = parseFloat(numbers[2]) || 5;
          } else {
            quantity = 1;
          }
        }

        currentFlow.category = category;
        currentFlow.unit = unit;
        currentFlow.current_stock = quantity > 0 ? quantity : 1;
        currentFlow.selling_price = sellingPrice;
        currentFlow.reorder_level = reorderLevel;

        const totalAmount = currentFlow.clarification?.suggested_amount;
        if (totalAmount && totalAmount > 0 && currentFlow.current_stock > 0) {
          currentFlow.cost_price = Number((totalAmount / currentFlow.current_stock).toFixed(2));
        } else {
          currentFlow.cost_price = 0;
        }

        setActiveInventoryFlow(null);
        setTyping(true);
        finalizeInventoryCreation(currentFlow);
        return;
      }


      setTyping(true);

      try {
        const systemInstructions = {
          role: 'user' as const,
          content: `IMPORTANT INSTRUCTION OVERRIDE:
When I ask to add, remove, or edit stock/inventory of an item:
1. Do NOT ask for unit price, unit cost, cost price, or total value under any circumstances. Never say "I need to know the unit cost or total value..." or similar.
2. Do NOT ask if it is a sale or general stock adjustment.
3. Search the inventory items list in the context.
4. If there are multiple different types or variations of the product in the database:
   - List all of them clearly in your reply with Name, SKU, and Prices (both Cost & Selling).
   - Ask me which variation I want to adjust.
   - Do NOT return any action button yet in this turn.
5. If there is exactly ONE matching item:
   - Directly list the matched item details (Name, SKU, current stock, cost price, selling price).
   - Return a single 'edit_inventory' action labeled "Update Inventory" with this payload:
     {
       "item_id": "<id of matched item>",
       "name": "<name of matched item>",
       "quantity": <positive quantity (always positive)>,
       "type": "sale" | "purchase",
       "is_movement": true
     }
6. Always format replies in JSON as required. Do not violate these override rules.`,
        };

        const history = [
          systemInstructions,
          ...messages
            .filter(m => !m.isTyping)
            .slice(-10)
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        ];

        history.push({ role: 'user', content: text });

        const response = await chatWithAssistant({
          messages: history,
          context: {
            transactions: transactions.slice(0, 100),
            accounts,
            userId: effectiveUserId!,
            isStaff,
            inventoryItems: inventoryItems.slice(0, 100),
            expenses: expenses.slice(0, 100),
            bills: bills.slice(0, 100),
            externalWorkers: externalWorkers.slice(0, 100),
            serviceAgreements: serviceAgreements.slice(0, 100),
          },
        });

        const responseActions = response.actions ?? [];

        // ── Handle confirmation-required responses ────────────────────────
        if (response.requiresConfirmation && response.pendingToolCall) {
          setPendingToolCall(response.pendingToolCall);
          const confirmActions: ChatAction[] = [
            { type: 'confirm_action', label: '✅ Yes, proceed', payload: {} },
            { type: 'cancel_action', label: '❌ Cancel', payload: {} },
          ];
          setMessages(prev => [...prev, {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: response.reply,
            timestamp: new Date(),
            actions: confirmActions,
          }]);
          setTyping(false);
          return;
        }

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

        // Auto-process clarify_transaction, update_transaction, delete_transaction, edit_inventory, and delete_inventory actions from the AI response
        // so the transactions/inventory are updated immediately
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
                      effectiveUserId!,
                      'full'
                    ).catch(err => console.error('ROVA: Auto-reclassify failed:', err));
                  } else {
                    console.error("ROVA: Auto-process description update failed:", error);
                  }
                });
            }
          } else if (action.type === 'update_transaction') {
            const payload = action.payload || {};
            const txId = payload.transaction_id;
            const newCategoryName = payload.category_name || payload.category;
            const newDescription = payload.description;
            const newAmount = payload.amount;
            const newDate = payload.date;

            if (txId) {
              const updates: any = {};
              if (newDescription) updates.description = newDescription;
              if (newAmount !== undefined && newAmount !== null) updates.amount = Number(newAmount);
              if (newDate) updates.date = newDate;

              const runUpdate = async () => {
                if (newCategoryName) {
                  const matchedCat = categories.find(c => 
                    c.name.toLowerCase() === newCategoryName.toLowerCase()
                  );
                  if (matchedCat) {
                    updates.category_id = matchedCat.id;
                  } else {
                    const { data: newCat, error: createCatErr } = await supabase
                      .from('categories')
                      .insert({
                        user_id: effectiveUserId!,
                        name: newCategoryName,
                        type: payload.type || 'expense',
                        is_system: false
                      })
                      .select()
                      .single();
                    if (!createCatErr && newCat) {
                      setCategories(prev => [...prev, newCat]);
                      updates.category_id = newCat.id;
                    }
                  }
                }

                if (Object.keys(updates).length > 0) {
                  const { error } = await supabase
                    .from('transactions')
                    .update(updates)
                    .eq('id', txId);

                  if (!error) {
                    setTransactions(prev =>
                      prev.map(t => {
                        if (t.id === txId) {
                          const updatedTx = { ...t, ...updates };
                          if (updates.category_id) {
                            const catObj = categories.find(c => c.id === updates.category_id) || t.category;
                            updatedTx.category = catObj;
                          }
                          return updatedTx;
                        }
                        return t;
                      })
                    );
                  }
                }
              };
              runUpdate().catch(err => console.error("Auto-update failed:", err));
            }
          } else if (action.type === 'delete_transaction') {
            const payload = action.payload || {};
            const txId = payload.transaction_id;
            if (txId) {
              supabase
                .from('transactions')
                .delete()
                .eq('id', txId)
                .then(({ error }) => {
                  if (!error) {
                    setTransactions(prev => prev.filter(t => t.id !== txId));
                  }
                });
            }
          } else if (action.type === 'edit_inventory') {
            const payload = action.payload || {};
            if (payload.is_movement) {
              continue;
            }
            const itemId = payload.item_id;
            if (itemId) {
              const updates: any = {};
              if (payload.name) updates.name = payload.name;
              if (payload.sku) updates.sku = payload.sku;
              if (payload.category) updates.category = payload.category;
              if (payload.unit) updates.unit = payload.unit;
              if (payload.cost_price !== undefined) updates.cost_price = Number(payload.cost_price);
              if (payload.selling_price !== undefined) updates.selling_price = Number(payload.selling_price);
              if (payload.current_stock !== undefined) updates.current_stock = Number(payload.current_stock);
              if (payload.reorder_level !== undefined) updates.reorder_level = Number(payload.reorder_level);

              if (Object.keys(updates).length > 0) {
                supabase
                  .from('inventory_items')
                  .update(updates)
                  .eq('id', itemId)
                  .then(({ error }) => {
                    if (!error) {
                      console.log("ROVA: Auto-updated inventory item in DB");
                      loadData();
                    } else {
                      console.error("ROVA: Auto-process inventory update failed:", error);
                    }
                  });
              }
            }
          } else if (action.type === 'delete_inventory') {
            const payload = action.payload || {};
            const itemId = payload.item_id;
            if (itemId) {
              supabase
                .from('inventory_items')
                .delete()
                .eq('id', itemId)
                .then(({ error }) => {
                  if (!error) {
                    console.log("ROVA: Auto-deleted inventory item in DB");
                    loadData();
                  } else {
                    console.error("ROVA: Auto-process inventory deletion failed:", error);
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
    [messages, transactions, accounts, categories, inventoryItems, user, isStaff, typing, activeInventoryFlow, finalizeInventoryCreation]
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
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--accent-border)'
              }}
            >
              <Brain size={18} color="var(--accent-light)" style={{ display: 'block' }} />
            </div>
            <h1 style={{ fontSize: 22 }}>ROVA Assistant</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            AI-powered financial advisor: insights, actions, and answers from your real data
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

      {/* ── Main Grid ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 380px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Left column: Chat Box + Pending Clarifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Chat Box */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: 580,
              background: 'var(--bg-card)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
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

          {/* Pending Clarifications Panel (placed below chatbot) */}
          {clarifications.length > 0 && (
            <div style={{ marginTop: 10 }}>
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
        </div>

        {/* Right column: Quick Questions */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Quick Questions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STARTERS.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                disabled={typing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-border)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>{s}</span>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
