import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Brain, Sparkles, X, Minus, Send, Mic, MicOff, Maximize2,
  ChevronRight, FileText, Package, Users, TrendingUp, HelpCircle,
  ExternalLink, RotateCcw
} from 'lucide-react';
import { useAssistant } from '../../contexts/AssistantContext';
import { useMobile } from '../../hooks/useMobile';
import type { ChatAction } from '../../lib/deepseekClient';

const ACTION_ICONS: Record<string, React.ElementType> = {
  create_invoice: FileText,
  add_inventory: Package,
  record_payroll: Users,
  clarify_transaction: HelpCircle,
  view_report: TrendingUp,
};

const ACTION_COLORS: Record<string, string> = {
  create_invoice: '#818cf8',
  add_inventory: '#34d399',
  record_payroll: '#fbbf24',
  clarify_transaction: '#60a5fa',
  view_report: '#a78bfa',
  open_whatsapp_bot: '#25D366',
};

// Map current pathname to human-readable page name and contextual suggestions
function getPageContext(pathname: string): { title: string; suggestions: string[] } {
  if (pathname.includes('/transactions')) {
    return {
      title: 'Transactions',
      suggestions: ["Show today's expenses", 'Categorize recent transactions', 'Largest expense this month'],
    };
  }
  if (pathname.includes('/invoices')) {
    return {
      title: 'Invoices',
      suggestions: ['Show me unpaid invoices', 'Create an invoice', 'Who owes the most?'],
    };
  }
  if (pathname.includes('/inventory')) {
    return {
      title: 'Inventory',
      suggestions: ['Which products are running low?', 'What is my total stock value?', 'Add new inventory item'],
    };
  }
  if (pathname.includes('/receipts')) {
    return {
      title: 'Receipts',
      suggestions: ['Show recent receipts', 'Unmatched receipts', 'Expense summary by category'],
    };
  }
  if (pathname.includes('/expenses') || pathname.includes('/bills')) {
    return {
      title: 'Bills & Expenses',
      suggestions: ['Upcoming bills due', 'Total expenses this week', 'Record a new expense'],
    };
  }
  if (pathname.includes('/reports') || pathname.includes('/statements')) {
    return {
      title: 'Financial Reports',
      suggestions: ['What is my profit margin?', 'Compare revenue vs last month', 'Net cash flow summary'],
    };
  }
  if (pathname.includes('/payroll')) {
    return {
      title: 'Payroll',
      suggestions: ['How many staff are on payroll?', 'Run monthly payroll', 'Show pending salary disbursements'],
    };
  }
  if (pathname.includes('/tax')) {
    return {
      title: 'Tax & Compliance',
      suggestions: ['Calculate estimated CIT', 'What are my tax obligations?', 'Show VAT report'],
    };
  }
  return {
    title: 'Dashboard',
    suggestions: ['How much did I make this month?', 'Why did my profit decrease?', 'Summarize my business health'],
  };
}

export default function FloatingAssistant() {
  const {
    messages,
    typing,
    sendMessage,
    handleAction,
    isFloatingOpen,
    setIsFloatingOpen,
    isFloatingMinimized,
    setIsFloatingMinimized,
    clearChat,
  } = useAssistant();

  const isMobile = useMobile(768);
  const location = useLocation();
  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access denied');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleSpeechRecognition = () => {
    if (!speechSupported) {
      alert("Voice dictation is not natively supported in this browser. You can also send voice notes directly to ROVA via WhatsApp!");
      return;
    }
    setSpeechError('');
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const pageContext = useMemo(() => getPageContext(location.pathname), [location.pathname]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isFloatingOpen && !isFloatingMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isFloatingOpen, isFloatingMinimized]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isFloatingOpen && !isFloatingMinimized && !isMobile) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isFloatingOpen, isFloatingMinimized, isMobile]);

  // Don't show floating bubble on the full AI assistant page to avoid UI duplication
  const isOnAssistantPage = location.pathname === '/app/assistant';
  if (isOnAssistantPage) {
    return null;
  }

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || typing) return;
    setInput('');
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    await sendMessage(text, {
      pathname: location.pathname,
      pageTitle: pageContext.title,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleOpenFullWorkspace = () => {
    setIsFloatingOpen(false);
    navigate('/app/assistant');
  };

  return (
    <>
      {/* ── Floating Chat Panel ────────────────────────────────────────── */}
      {isFloatingOpen && (
        <div
          role="dialog"
          aria-label="ROVA AI Assistant"
          style={
            isMobile
              ? {
                  position: 'fixed',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: isFloatingMinimized ? 60 : '86vh',
                  background: 'var(--bg-surface)',
                  borderTop: '1px solid var(--accent-border)',
                  borderRadius: '20px 20px 0 0',
                  boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }
              : {
                  position: 'fixed',
                  right: 24,
                  bottom: isFloatingMinimized ? 88 : 88,
                  width: 390,
                  height: isFloatingMinimized ? 52 : 580,
                  maxHeight: 'calc(100vh - 120px)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 30px var(--accent-dim)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  backdropFilter: 'blur(12px)',
                }
          }
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: isFloatingMinimized ? 'none' : '1px solid var(--bg-border)',
              background: 'linear-gradient(135deg, rgba(102, 45, 145, 0.15), var(--bg-elevated))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: isFloatingMinimized ? 'pointer' : 'default',
              userSelect: 'none',
              flexShrink: 0,
            }}
            onClick={() => {
              if (isFloatingMinimized) setIsFloatingMinimized(false);
            }}
          >
            {/* Title & Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 12px var(--accent-border)',
                  flexShrink: 0,
                }}
              >
                <Brain size={16} color="#ffffff" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                    ROVA Assistant
                  </span>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--success)',
                      boxShadow: '0 0 6px var(--success)',
                    }}
                  />
                </div>
                {/* Page Context Badge */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Context:</span>
                  <span
                    style={{
                      color: 'var(--accent-light)',
                      fontWeight: 600,
                      background: 'var(--accent-dim)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {pageContext.title}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Expand to full workspace */}
              {!isFloatingMinimized && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleOpenFullWorkspace();
                  }}
                  title="Open full AI workspace"
                  style={{
                    padding: 6,
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  }}
                >
                  <Maximize2 size={14} />
                </button>
              )}

              {/* Reset / New Chat */}
              {!isFloatingMinimized && messages.length > 1 && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm('Start a fresh conversation?')) {
                      clearChat();
                    }
                  }}
                  title="Clear conversation"
                  style={{
                    padding: 6,
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  }}
                >
                  <RotateCcw size={13} />
                </button>
              )}

              {/* Minimize */}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setIsFloatingMinimized(!isFloatingMinimized);
                }}
                title={isFloatingMinimized ? 'Expand' : 'Minimize'}
                style={{
                  padding: 6,
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                }}
              >
                <Minus size={15} />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setIsFloatingOpen(false);
                }}
                title="Close"
                style={{
                  padding: 6,
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Main Chat Body (hidden if minimized) */}
          {!isFloatingMinimized && (
            <>
              {/* Message List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  background: 'var(--bg-base)',
                }}
              >
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {msg.role === 'assistant' && (
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginRight: 8,
                          marginTop: 2,
                        }}
                      >
                        <Sparkles size={11} color="white" />
                      </div>
                    )}
                    <div style={{ maxWidth: '86%' }}>
                      <div
                        style={{
                          padding: '9px 13px',
                          borderRadius:
                            msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          background:
                            msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          fontSize: 12.5,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-line',
                          border: msg.role === 'assistant' ? '1px solid var(--bg-border)' : 'none',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.content}
                      </div>

                      {/* Action buttons */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingLeft: 2 }}>
                          {msg.actions.map((action, i) => (
                            <FloatingActionButton key={i} action={action} onAction={handleAction} />
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
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Sparkles size={11} color="white" />
                    </div>
                    <div
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--bg-border)',
                        borderRadius: '14px 14px 14px 4px',
                        padding: '8px 12px',
                        display: 'flex',
                        gap: 4,
                        alignItems: 'center',
                      }}
                    >
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: 'var(--accent-light)',
                            animation: `spin 1s ease-in-out ${i * 0.15}s infinite alternate`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Contextual Suggestions Chips */}
              <div
                style={{
                  padding: '6px 12px 2px 12px',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  gap: 6,
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                  scrollbarWidth: 'none',
                  borderTop: '1px solid var(--bg-border)',
                }}
              >
                {pageContext.suggestions.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    disabled={typing}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                      (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-border)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Speech Error Banner if any */}
              {speechError && (
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: 11,
                    background: 'var(--error-dim)',
                    color: 'var(--error)',
                    textAlign: 'center',
                  }}
                >
                  {speechError}
                </div>
              )}

              {/* Input Form */}
              <form
                onSubmit={handleSubmit}
                style={{
                  padding: '10px 12px',
                  borderTop: '1px solid var(--bg-border)',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={isListening ? 'Listening… speak now' : 'Ask ROVA anything…'}
                    disabled={typing}
                    style={{
                      width: '100%',
                      padding: '8px 36px 8px 12px',
                      background: isListening ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-elevated)',
                      border: isListening ? '1px solid var(--error)' : '1px solid var(--bg-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: 13,
                      transition: 'all 0.15s ease',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent-primary)')}
                    onBlur={e => {
                      if (!isListening) e.target.style.borderColor = 'var(--bg-border)';
                    }}
                  />

                  {/* Voice input button inside the input right */}
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    title={isListening ? 'Stop listening' : 'Speak to ROVA (Voice dictation)'}
                    style={{
                      position: 'absolute',
                      right: 6,
                      background: isListening ? 'var(--error)' : 'transparent',
                      border: 'none',
                      color: isListening ? '#ffffff' : 'var(--text-muted)',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      animation: isListening ? 'pulse 1.2s infinite' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!isListening) (e.currentTarget as HTMLElement).style.color = 'var(--accent-light)';
                    }}
                    onMouseLeave={e => {
                      if (!isListening) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    }}
                  >
                    {isListening ? <MicOff size={13} /> : <Mic size={14} />}
                  </button>
                </div>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!input.trim() || typing}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: input.trim() && !typing ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                    color: input.trim() && !typing ? 'white' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--bg-border)',
                    cursor: input.trim() && !typing ? 'pointer' : 'default',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Send size={14} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* ── Floating Bubble Button (Fixed Bottom-Right) ───────────────── */}
      <div
        style={{
          position: 'fixed',
          right: isMobile ? 18 : 24,
          bottom: isMobile ? 18 : 24,
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Hover Tooltip: "Ask ROVA" */}
        <div
          style={{
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            padding: '5px 11px',
            borderRadius: 'var(--radius-full)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.2px',
            border: '1px solid var(--accent-border)',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            opacity: showTooltip && !isFloatingOpen ? 1 : 0,
            transform: showTooltip && !isFloatingOpen ? 'translateX(0)' : 'translateX(6px)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace: 'nowrap',
          }}
        >
          Ask ROVA
        </div>

        {/* Circular Bubble */}
        <button
          type="button"
          onClick={() => {
            if (isFloatingOpen && isFloatingMinimized) {
              setIsFloatingMinimized(false);
            } else {
              setIsFloatingOpen(!isFloatingOpen);
              setIsFloatingMinimized(false);
            }
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          aria-label="Ask ROVA AI Assistant"
          style={{
            width: isMobile ? 48 : 52,
            height: isMobile ? 48 : 52,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #431a6b 100%)',
            border: '1px solid rgba(157, 91, 211, 0.45)',
            boxShadow: isFloatingOpen
              ? '0 0 0 4px var(--accent-border), 0 8px 30px rgba(102, 45, 145, 0.5)'
              : '0 8px 24px rgba(102, 45, 145, 0.38), 0 2px 8px rgba(0, 0, 0, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: showTooltip ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          {/* Subtle glowing ring effect */}
          <div
            style={{
              position: 'absolute',
              top: -2,
              left: -2,
              right: -2,
              bottom: -2,
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--accent-light) 0%, transparent 70%)',
              opacity: showTooltip ? 0.3 : 0.1,
              pointerEvents: 'none',
              transition: 'opacity 0.2s ease',
            }}
          />

          {isFloatingOpen && !isFloatingMinimized ? (
            <X size={20} color="#ffffff" />
          ) : (
            <>
              <Brain size={isMobile ? 22 : 24} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />
              {/* Online Pulse Dot */}
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  border: '2px solid var(--bg-surface)',
                  boxShadow: '0 0 6px var(--success)',
                }}
              />
            </>
          )}
        </button>
      </div>
    </>
  );
}

// ── Action button for chat messages ───────────────────────────────────────────
function FloatingActionButton({
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
        type="button"
        onClick={() => onAction(action)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, #1da851, #128C3E)',
          border: '1px solid rgba(18, 140, 62, 0.8)',
          color: '#ffffff',
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
          marginTop: 4,
          boxShadow: '0 2px 8px rgba(18, 140, 62, 0.3)',
        }}
      >
        <img
          src="/whatsapp-logo.png"
          alt="WhatsApp"
          style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }}
        />
        <span>{action.label.replace(/^💬\s*/, '')}</span>
        <ExternalLink size={11} style={{ opacity: 0.9 }} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onAction(action)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 11px',
        borderRadius: 'var(--radius-full)',
        background: `${color}20`,
        border: `1px solid ${color}40`,
        color: '#ffffff',
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        marginTop: 3,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = `${color}35`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = `${color}20`;
      }}
    >
      <Icon size={12} color={color} />
      {action.label}
    </button>
  );
}
