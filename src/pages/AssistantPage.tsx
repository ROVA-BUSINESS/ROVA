import { useEffect, useRef, useState } from 'react';
import {
  Send, RefreshCw,
  Bell, ChevronRight, Package, Users, FileText, X,
  MessageCircle, ExternalLink, HelpCircle, TrendingUp, Brain
} from 'lucide-react';
import { useMobile } from '../hooks/useMobile';
import { useAssistant } from '../contexts/AssistantContext';
import type { PendingClarification, ChatAction } from '../lib/deepseekClient';

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
  const isMobile = useMobile(1024);

  const {
    messages,
    typing,
    clarifications,
    refreshing,
    handleRefresh,
    sendMessage,
    handleAction,
    handleResolve,
    handleDismiss,
  } = useAssistant();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      const text = input.trim();
      setInput('');
      sendMessage(text, {
        pathname: '/app/assistant',
        pageTitle: 'AI Assistant Workspace',
      });
    }
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1100, animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href="https://wa.me/2349132957881?text=Hi%20ROVA"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 'var(--radius-md)', background: 'rgba(37, 211, 102, 0.1)',
              border: '1px solid rgba(37, 211, 102, 0.3)', color: '#25D366', fontSize: 13,
              fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span>WhatsApp Bot</span>
          </a>
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
                onClick={() => sendMessage(s, { pathname: '/app/assistant', pageTitle: 'AI Assistant Workspace' })}
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
