import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, RefreshCw, AlertTriangle, Info, CheckCircle, Zap } from 'lucide-react';
import { supabase, type Transaction, type Account } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateInsights, answerQuestion, type Insight, type ChatMessage } from '../lib/aiEngine';
import Card from '../components/ui/Card';
import { useMobile } from '../hooks/useMobile';

const SEVERITY_STYLES: Record<Insight['severity'], { bg: string; border: string; icon: React.ElementType; color: string }> = {
  info: { bg: 'var(--info-dim)', border: 'rgba(59,130,246,0.2)', icon: Info, color: 'var(--info)' },
  warning: { bg: 'var(--warning-dim)', border: 'rgba(245,158,11,0.2)', icon: AlertTriangle, color: 'var(--warning)' },
  critical: { bg: 'var(--error-dim)', border: 'rgba(239,68,68,0.2)', icon: AlertTriangle, color: 'var(--error)' },
  positive: { bg: 'var(--success-dim)', border: 'rgba(34,197,94,0.2)', icon: CheckCircle, color: 'var(--success)' },
};

const STARTERS = [
  'How much did I make this month?',
  'What am I overspending on?',
  'Give me a financial summary',
  'Can I afford to hire someone?',
  'What was my best income month?',
  "What's my profit margin?",
];

export default function AssistantPage() {
  const { user, isStaff } = useAuth();
  const isMobile = useMobile(1024);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your ROVA financial assistant. I've analysed your transactions and I'm ready to help. Ask me anything about your finances, or check out the insights below.",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadData() {
    setLoading(true);
    const [txRes, accRes] = await Promise.all([
      supabase.from('transactions').select('*, category:categories(*), account:accounts(*)').eq('user_id', user!.id).order('date', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true),
    ]);
    const txs = txRes.data || [];
    const accs = accRes.data || [];
    setTransactions(txs);
    setAccounts(accs);
    setInsights(generateInsights(txs, accs));
    setLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function sendMessage(text: string) {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const answer = answerQuestion(text, transactions, accounts, isStaff);
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: answer,
        timestamp: new Date(),
      }]);
      setTyping(false);
    }, 600 + Math.random() * 400);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1100, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-primary), #7e22ce)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={14} color="white" />
            </div>
            <h1 style={{ fontSize: 22 }}>ROVA Assistant</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Your AI-powered financial advisor — insights, answers, and analysis from your real data</p>
        </div>
        <button onClick={handleRefresh}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', fontSize: 13, transition: 'all 0.15s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-border)'}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh Analysis
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={13} color="var(--accent-light)" />
              Smart Insights
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
              </div>
            ) : insights.length === 0 ? (
              <Card>
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Add more transactions for personalized insights
                </div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {insights.map(insight => {
                  const style = SEVERITY_STYLES[insight.severity];
                  return (
                    <div key={insight.id}
                      style={{
                        padding: '14px 16px', borderRadius: 'var(--radius-md)',
                        background: style.bg, border: `1px solid ${style.border}`,
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        animation: 'fadeIn 0.3s ease',
                      }}
                    >
                      <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{insight.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{insight.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{insight.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>Quick Questions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {STARTERS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  style={{
                    padding: '7px 12px', borderRadius: 'var(--radius-full)', fontSize: 12,
                    background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                    color: 'var(--text-secondary)', transition: 'all 0.15s', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-light)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', height: 560, background: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Chat with ROVA</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), #7e22ce)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                    <Sparkles size={11} color="white" />
                  </div>
                )}
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 13px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-line',
                  border: msg.role === 'assistant' ? '1px solid var(--bg-border)' : 'none',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {typing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), #7e22ce)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={11} color="white" />
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: '14px 14px 14px 4px', padding: '10px 16px', display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: `spin 1s ease-in-out ${i * 0.15}s infinite alternate` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '12px 14px', borderTop: '1px solid var(--bg-border)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything about your finances..."
              style={{
                flex: 1, padding: '9px 12px', background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)', outline: 'none', fontSize: 13,
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--bg-border)'}
            />
            <button type="submit" disabled={!input.trim() || typing}
              style={{
                width: 38, height: 38, borderRadius: 'var(--radius-md)', flexShrink: 0,
                background: input.trim() && !typing ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: input.trim() && !typing ? 'white' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', border: '1px solid var(--bg-border)',
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
