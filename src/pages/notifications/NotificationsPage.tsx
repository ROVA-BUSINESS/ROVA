import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, TriangleAlert as AlertTriangle, Info, CircleCheck as CheckCircle, Circle as XCircle, Package, FileText, CreditCard, Calendar, Zap, RefreshCw, Sparkles, MessageCircle } from 'lucide-react';
import { supabase, type Notification, type Transaction, type InventoryItem, type Invoice } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatCurrency } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

const TYPE_META: Record<Notification['type'], { icon: React.ElementType; color: string; label: string }> = {
  payment_reminder: { icon: CreditCard, color: 'var(--warning)', label: 'Payment Reminder' },
  tax_deadline: { icon: Calendar, color: 'var(--error)', label: 'Tax Deadline' },
  low_stock: { icon: Package, color: 'var(--warning)', label: 'Low Stock' },
  cash_warning: { icon: AlertTriangle, color: 'var(--error)', label: 'Cash Warning' },
  invoice_due: { icon: FileText, color: 'var(--warning)', label: 'Invoice Due' },
  payroll: { icon: CreditCard, color: 'var(--info)', label: 'Payroll' },
  info: { icon: Info, color: 'var(--info)', label: 'Info' },
  success: { icon: CheckCircle, color: 'var(--success)', label: 'Success' },
  error: { icon: XCircle, color: 'var(--error)', label: 'Error' },
  ai_clarification: { icon: Sparkles, color: 'var(--accent-light)', label: 'AI Clarification' },
};

const SEVERITY_BG: Record<Notification['severity'], string> = {
  info: 'var(--info-dim)',
  warning: 'var(--warning-dim)',
  critical: 'var(--error-dim)',
  success: 'var(--success-dim)',
};

const SEVERITY_BORDER: Record<Notification['severity'], string> = {
  info: 'rgba(59,130,246,0.2)',
  warning: 'rgba(245,158,11,0.2)',
  critical: 'rgba(239,68,68,0.2)',
  success: 'rgba(34,197,94,0.2)',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const handleUpdate = () => {
      loadNotifications();
    };
    window.addEventListener('unread-notifications-updated', handleUpdate);
    return () => {
      window.removeEventListener('unread-notifications-updated', handleUpdate);
    };
  }, [user]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const [notifsRes, clarsRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user!.id)
          .eq('is_dismissed', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('ai_pending_clarifications')
          .select('*')
          .eq('user_id', user!.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      ]);

      const dbNotifs = notifsRes.data || [];
      const dbClars = clarsRes.data || [];

      // Read read clarification IDs from localStorage
      const readClarIds = JSON.parse(localStorage.getItem('read_clarifications') || '[]');

      // Map clarifications to virtual notification objects if they don't already have one in notifications
      const clarificationNotifs = dbClars.map(clar => {
        const hasNotification = dbNotifs.some(n => n.id === clar.notification_id);
        if (hasNotification) return null;

        const isRead = readClarIds.includes(clar.id);

        return {
          id: `clar-${clar.id}`,
          user_id: user!.id,
          type: 'ai_clarification' as const,
          severity: 'info' as const,
          title: 'Transaction needs your input',
          body: clar.ai_question || `Please clarify the intent for transaction "${clar.original_description}".`,
          action_url: '/app/assistant',
          action_label: 'Clarify',
          is_read: isRead,
          is_dismissed: false,
          created_at: clar.created_at,
          clarification_id: clar.id
        };
      }).filter(Boolean) as any[];

      const combined = [...dbNotifs, ...clarificationNotifs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(combined);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function generateSmartNotifications() {
    setGenerating(true);
    const now = new Date();
    const toInsert: Omit<Notification, 'id' | 'created_at'>[] = [];

    const [txRes, inventoryRes, invoicesRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', user!.id).order('date', { ascending: false }).limit(100),
      supabase.from('inventory_items').select('*').eq('user_id', user!.id).eq('status', 'active'),
      supabase.from('invoices').select('*').eq('user_id', user!.id).in('status', ['sent', 'overdue']),
    ]);

    const txs: Transaction[] = txRes.data || [];
    const items: InventoryItem[] = inventoryRes.data || [];
    const invoices: Invoice[] = invoicesRes.data || [];

    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const thisMonthTx = txs.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const income = thisMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = thisMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    if (expenses > income && income > 0) {
      toInsert.push({
        user_id: user!.id, type: 'cash_warning', severity: 'critical',
        title: 'Spending exceeds income this month',
        body: `Your expenses (${formatCurrency(expenses)}) exceed income (${formatCurrency(income)}) this month. Cash flow is negative.`,
        action_url: '/transactions', action_label: 'Review Transactions',
        is_read: false, is_dismissed: false, scheduled_for: null,
      });
    }

    items.filter(i => i.current_stock <= i.reorder_level && i.current_stock >= 0).forEach(item => {
      const severity = item.current_stock === 0 ? 'critical' : 'warning';
      toInsert.push({
        user_id: user!.id, type: 'low_stock', severity,
        title: item.current_stock === 0 ? `Out of stock: ${item.name}` : `Low stock: ${item.name}`,
        body: item.current_stock === 0
          ? `${item.name} is out of stock. Reorder immediately.`
          : `${item.name} has only ${item.current_stock} ${item.unit} left (reorder level: ${item.reorder_level}).`,
        action_url: '/inventory', action_label: 'View Inventory',
        is_read: false, is_dismissed: false, scheduled_for: null,
      });
    });

    invoices.forEach(inv => {
      const due = new Date(inv.due_date);
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        toInsert.push({
          user_id: user!.id, type: 'invoice_due', severity: 'critical',
          title: `Invoice overdue: ${inv.client_name}`,
          body: `Invoice #${inv.invoice_number} for ${formatCurrency(inv.total)} was due ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago.`,
          action_url: '/invoices', action_label: 'View Invoice',
          is_read: false, is_dismissed: false, scheduled_for: null,
        });
      } else if (daysOverdue > -7) {
        toInsert.push({
          user_id: user!.id, type: 'payment_reminder', severity: 'warning',
          title: `Invoice due soon: ${inv.client_name}`,
          body: `Invoice #${inv.invoice_number} for ${formatCurrency(inv.total)} is due on ${formatDate(inv.due_date)}.`,
          action_url: '/invoices', action_label: 'View Invoice',
          is_read: false, is_dismissed: false, scheduled_for: null,
        });
      }
    });

    const vatMonth = now.getMonth() + 1;
    const vatDue = new Date(thisYear, vatMonth, 21);
    const daysToVat = Math.floor((vatDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysToVat >= 0 && daysToVat <= 14) {
      toInsert.push({
        user_id: user!.id, type: 'tax_deadline', severity: daysToVat <= 7 ? 'critical' : 'warning',
        title: `VAT return due in ${daysToVat} day${daysToVat !== 1 ? 's' : ''}`,
        body: `Your monthly VAT return is due on ${vatDue.toLocaleDateString('en-NG', { day: 'numeric', month: 'long' })}. Make sure your records are up to date.`,
        action_url: '/tax', action_label: 'View Tax',
        is_read: false, is_dismissed: false, scheduled_for: null,
      });
    }

    if (toInsert.length > 0) {
      await supabase.from('notifications').insert(toInsert);
    }

    await loadNotifications();
    setGenerating(false);
  }

  async function markRead(id: string) {
    if (id.startsWith('clar-')) {
      const clarId = id.replace('clar-', '');
      const readClarIds = JSON.parse(localStorage.getItem('read_clarifications') || '[]');
      if (!readClarIds.includes(clarId)) {
        readClarIds.push(clarId);
        localStorage.setItem('read_clarifications', JSON.stringify(readClarIds));
      }
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } else {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
    window.dispatchEvent(new Event('unread-notifications-updated'));
  }

  async function dismiss(id: string) {
    if (id.startsWith('clar-')) {
      const clarId = id.replace('clar-', '');
      await supabase
        .from('ai_pending_clarifications')
        .update({ status: 'dismissed' })
        .eq('id', clarId);
    } else {
      await supabase.from('notifications').update({ is_dismissed: true }).eq('id', id);
    }
    setNotifications(prev => prev.filter(n => n.id !== id));
    window.dispatchEvent(new Event('unread-notifications-updated'));
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false);
    
    // Save all pending virtual notifications to localStorage read list
    const pendingVirtuals = notifications.filter(n => n.id.startsWith('clar-') && !n.is_read);
    const readClarIds = JSON.parse(localStorage.getItem('read_clarifications') || '[]');
    pendingVirtuals.forEach(n => {
      const clarId = n.id.replace('clar-', '');
      if (!readClarIds.includes(clarId)) {
        readClarIds.push(clarId);
      }
    });
    localStorage.setItem('read_clarifications', JSON.stringify(readClarIds));

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    window.dispatchEvent(new Event('unread-notifications-updated'));
  }

  async function clearAll() {
    if (!confirm('Clear all notifications?')) return;
    await Promise.all([
      supabase.from('notifications').update({ is_dismissed: true }).eq('user_id', user!.id),
      supabase.from('ai_pending_clarifications').update({ status: 'dismissed' }).eq('user_id', user!.id).eq('status', 'pending')
    ]);
    setNotifications([]);
    window.dispatchEvent(new Event('unread-notifications-updated'));
  }

  const filtered = notifications.filter(n => filter === 'all' || !n.is_read);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{ padding: 24, maxWidth: 900, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22 }}>Notifications</h1>
            {unreadCount > 0 && (
              <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--error)', color: 'white', fontSize: 11, fontWeight: 700 }}>{unreadCount}</span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Smart alerts, reminders, and automation warnings</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon={<RefreshCw size={13} style={{ animation: generating ? 'spin 0.8s linear infinite' : 'none' }} />} onClick={generateSmartNotifications}>
            {generating ? 'Scanning...' : 'Scan for Alerts'}
          </Button>
          {unreadCount > 0 && <Button variant="secondary" icon={<CheckCheck size={13} />} onClick={markAllRead}>Mark All Read</Button>}
        </div>
      </div>

      <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--info-dim)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Zap size={14} color="var(--info)" style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Click <strong style={{ color: 'var(--info)' }}>Scan for Alerts</strong> to auto-generate smart notifications from your live data — including overdue invoices, low stock, cash flow warnings, and upcoming tax deadlines.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500,
                background: filter === f ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: filter === f ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${filter === f ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                transition: 'all 0.15s', textTransform: 'capitalize',
              }}>{f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}</button>
          ))}
        </div>
        {notifications.length > 0 && (
          <button onClick={clearAll}
            style={{ fontSize: 12, color: 'var(--text-muted)', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--error)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
          >Clear all</button>
        )}
      </div>

      {loading ? (
        <div>{[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 10 }} />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Bell size={36} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {filter === 'unread' ? 'All caught up! No unread notifications.' : 'No notifications yet'}
            </p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4, marginBottom: 16 }}>
              Click "Scan for Alerts" to analyse your data and generate smart notifications
            </p>
            <Button variant="primary" icon={<RefreshCw size={13} />} onClick={generateSmartNotifications}>Scan for Alerts</Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(notif => {
            const meta = TYPE_META[notif.type] ?? TYPE_META['info'];
            const Icon = meta.icon;
            const isAiClarification = notif.type === 'ai_clarification';

            return (
              <div key={notif.id}
                onClick={() => !notif.is_read && markRead(notif.id)}
                style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-md)',
                  background: isAiClarification
                    ? 'rgba(168,85,247,0.06)'
                    : notif.is_read ? 'var(--bg-card)' : SEVERITY_BG[notif.severity],
                  border: isAiClarification
                    ? '1px solid rgba(168,85,247,0.25)'
                    : `1px solid ${notif.is_read ? 'var(--bg-border)' : SEVERITY_BORDER[notif.severity]}`,
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  cursor: notif.is_read ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  animation: 'fadeIn 0.3s ease',
                  position: 'relative',
                }}
              >
                {!notif.is_read && (
                  <div style={{ position: 'absolute', top: 14, right: 40, width: 7, height: 7, borderRadius: '50%', background: meta.color }} />
                )}

                {/* Icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                  background: isAiClarification ? 'linear-gradient(135deg, var(--accent-dim), var(--accent-subtle))' : notif.is_read ? 'var(--bg-elevated)' : 'transparent',
                  border: isAiClarification ? '1px solid var(--accent-border)' : `1px solid ${notif.is_read ? 'var(--bg-border)' : 'transparent'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color={meta.color} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: notif.is_read ? 500 : 700, color: 'var(--text-primary)' }}>
                      {notif.title}
                    </span>
                    <Badge variant={isAiClarification ? 'info' : notif.severity === 'critical' ? 'error' : notif.severity === 'warning' ? 'warning' : notif.severity === 'success' ? 'success' : 'info'}>
                      {meta.label}
                    </Badge>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{notif.body}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                      {new Date(notif.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isAiClarification ? (
                      <a
                        href="/app/assistant"
                        onClick={e => { e.stopPropagation(); markRead(notif.id); }}
                        style={{
                          fontSize: 12, color: 'var(--accent-light)', fontWeight: 600,
                          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.textDecoration = 'underline'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.textDecoration = 'none'}
                      >
                        <MessageCircle size={11} />
                        Clarify in Assistant →
                      </a>
                    ) : notif.action_label && notif.action_url ? (
                      <a href={notif.action_url} onClick={e => e.stopPropagation()}
                        style={{ fontSize: 12, color: meta.color, fontWeight: 500, textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.textDecoration = 'underline'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.textDecoration = 'none'}
                      >
                        {notif.action_label} →
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* Dismiss */}
                <button onClick={e => { e.stopPropagation(); dismiss(notif.id); }}
                  style={{ padding: 4, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s', flexShrink: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                ><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
