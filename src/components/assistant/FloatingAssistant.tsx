import WhatsAppIcon from '../ui/WhatsAppIcon';
import RobotIcon from "../ui/RobotIcon";
import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X, Minus, Send, Mic, Maximize2,
  ChevronRight, FileText, Package, Users, TrendingUp, HelpCircle,
  RotateCcw, Sparkles
} from 'lucide-react';
import { useAssistant, type PendingMediaAttachment } from '../../contexts/AssistantContext';
import { useMobile } from '../../hooks/useMobile';
import type { ChatAction } from '../../lib/deepseekClient';
import { AudioRecorder, transcribeAudioBlob } from '../../lib/aiMediaService';
import VoiceMessagePlayer from './VoiceMessagePlayer';

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
      suggestions: ['How can I optimize recurring business expenses?', 'What metrics should I track for healthy cash flow?', 'Ask any question...'],
    };
  }
  if (pathname.includes('/invoices')) {
    return {
      title: 'Invoices',
      suggestions: ['What payment terms work best for client invoices?', 'How can I minimize overdue receivables?', 'Ask any question...'],
    };
  }
  if (pathname.includes('/inventory')) {
    return {
      title: 'Inventory',
      suggestions: ['What is the best way to calculate reorder levels?', 'How do I calculate inventory turnover ratio?', 'Ask any question...'],
    };
  }
  if (pathname.includes('/receipts')) {
    return {
      title: 'Receipts',
      suggestions: ['Why is audit-ready receipt recordkeeping important?', 'How should I organize digital business receipts?', 'Ask any question...'],
    };
  }
  if (pathname.includes('/expenses') || pathname.includes('/bills')) {
    return {
      title: 'Bills & Expenses',
      suggestions: ['What is the difference between direct and indirect costs?', 'How do I prepare a monthly expense budget?', 'Ask any question...'],
    };
  }
  if (pathname.includes('/reports') || pathname.includes('/statements')) {
    return {
      title: 'Financial Reports',
      suggestions: ['What is the difference between EBITDA and Net Profit?', 'Explain the components of a balance sheet', 'Ask any question...'],
    };
  }
  if (pathname.includes('/payroll')) {
    return {
      title: 'Payroll',
      suggestions: ['What are key payroll statutory deductions in Nigeria?', 'How do I structure competitive employee benefits?', 'Ask any question...'],
    };
  }
  if (pathname.includes('/tax')) {
    return {
      title: 'Tax & Compliance',
      suggestions: ['Explain how Company Income Tax works for small businesses', 'What are allowable tax deductions?', 'Ask any question...'],
    };
  }
  return {
    title: 'Assistant',
    suggestions: ['Ask anything: technology, science, everyday life', 'Help me brainstorm business ideas', 'Explain a complex concept simply'],
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<PendingMediaAttachment | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Movable Bubble Position State
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('rova_assistant_bubble_pos');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });
  const hasMovedRef = useRef(false);
  const bubbleContainerRef = useRef<HTMLDivElement>(null);

  // Keep bubble in bounds on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        if (!prev) return null;
        const size = isMobile ? 48 : 52;
        const clampedX = Math.max(12, Math.min(window.innerWidth - size - 12, prev.x));
        const clampedY = Math.max(12, Math.min(window.innerHeight - size - 12, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = bubbleContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: rect.left,
      initY: rect.top,
    };
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      if (!hasMovedRef.current) {
        hasMovedRef.current = true;
        setIsDragging(true);
      }
    }

    if (hasMovedRef.current) {
      const size = isMobile ? 48 : 52;
      const newX = Math.max(12, Math.min(window.innerWidth - size - 12, dragStartRef.current.initX + dx));
      const newY = Math.max(12, Math.min(window.innerHeight - size - 12, dragStartRef.current.initY + dy));
      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    if (hasMovedRef.current) {
      setPosition(cur => {
        if (cur) {
          localStorage.setItem('rova_assistant_bubble_pos', JSON.stringify(cur));
        }
        return cur;
      });
    }
  };

  const panelStyle = useMemo((): React.CSSProperties => {
    if (isMobile) {
      return {
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
      };
    }

    const baseDesktop: React.CSSProperties = {
      position: 'fixed',
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
      transition: isDragging ? 'none' : 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      backdropFilter: 'blur(12px)',
    };

    if (!position) {
      return {
        ...baseDesktop,
        right: 24,
        bottom: 88,
      };
    }

    const panelWidth = 390;
    let left: number | undefined;
    let right: number | undefined;
    if (position.x + panelWidth + 20 <= window.innerWidth) {
      left = Math.max(16, position.x - (panelWidth - 60));
      if (left + panelWidth > window.innerWidth - 16) {
        left = window.innerWidth - panelWidth - 16;
      }
      if (left < 16) left = 16;
    } else {
      right = Math.max(16, window.innerWidth - position.x - 52);
    }

    let top: number | undefined;
    let bottom: number | undefined;
    if (position.y > window.innerHeight / 2) {
      bottom = Math.max(16, window.innerHeight - position.y + 12);
    } else {
      top = Math.max(16, position.y + 60);
    }

    return {
      ...baseDesktop,
      left,
      right,
      top,
      bottom,
    };
  }, [isMobile, isFloatingMinimized, position, isDragging]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const recognitionRef = useRef<any>(null);

  // Clean up audio recorder on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.isRecording) {
        recorderRef.current.cancel();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const handleStartRecording = async () => {
    if (isRecording) return;
    setSpeechError('');
    try {
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;
      setRecordSeconds(0);
      setAudioLevel(0);
      setIsRecording(true);

      await recorder.start(
        (sec) => setRecordSeconds(sec),
        (lvl) => setAudioLevel(lvl)
      );

      // Start interim recognition if browser supports SpeechRecognition for real-time speech preview
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const rec = new SpeechRecognition();
          rec.continuous = false;
          rec.interimResults = true;
          rec.lang = 'en-NG';
          rec.onresult = (evt: any) => {
            let transcript = '';
            for (let i = evt.resultIndex; i < evt.results.length; ++i) {
              transcript += evt.results[i][0].transcript;
            }
            if (transcript.trim()) {
              setInput(transcript);
            }
          };
          rec.onerror = () => {};
          rec.onend = () => {};
          recognitionRef.current = rec;
          rec.start();
        }
      } catch {
        // Non-fatal if browser speech recognition is unavailable
      }
    } catch (err: any) {
      setIsRecording(false);
      setSpeechError(err.message || 'Microphone access failed. Please ensure microphone permissions are allowed.');
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;
    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsRecording(false);
      setIsTranscribing(true);
      const result = await recorderRef.current.stop();

      let transcribedText = '';
      let confidence = 0.95;

      try {
        // Transcribe audio using the Whisper AI translation & transcription pipeline
        const transResult = await transcribeAudioBlob(result.blob, 'voice_note.webm');
        transcribedText = transResult.text;
        confidence = transResult.confidence;
      } catch (transErr: any) {
        console.warn('Backend whisper transcription failed, falling back to input text:', transErr);
        if (input.trim()) {
          transcribedText = input.trim();
        } else {
          throw transErr;
        }
      }

      setPendingAttachment({
        type: 'voice',
        url: result.audioUrl,
        name: `Voice note (${result.durationSeconds}s)`,
        durationSeconds: result.durationSeconds,
        sizeBytes: result.blob.size,
        mimeType: result.mimeType,
        extractedText: transcribedText,
        transcriptionConfidence: confidence,
      });

      if (transcribedText) {
        setInput(transcribedText);
      }
    } catch (err: any) {
      setSpeechError(`Voice translation error: ${err.message || 'Could not transcribe voice note.'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCancelRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.cancel();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsRecording(false);
    setRecordSeconds(0);
    setAudioLevel(0);
  };

  const pageContext = useMemo(() => getPageContext(location.pathname), [location.pathname]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isFloatingOpen && !isFloatingMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isFloatingOpen, isFloatingMinimized, isTranscribing]);

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
    if ((!text && !pendingAttachment) || typing || isTranscribing) return;

    const attachment = pendingAttachment;
    setInput('');
    setPendingAttachment(null);

    if (isRecording) {
      handleCancelRecording();
    }

    await sendMessage(
      text,
      {
        pathname: location.pathname,
        pageTitle: pageContext.title,
      },
      attachment || undefined
    );
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
          role="dialog" aria-label="ROVA AI Assistant" style={panelStyle}>
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
                <RobotIcon size={17} color="#ffffff" />
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
                        <RobotIcon size={13} color="white" />
                      </div>
                    )}
                    <div style={{ maxWidth: '86%' }}>
                      {/* Voice Note Audio Player */}
                      {msg.mediaType === 'voice' && msg.mediaUrl && (
                        <VoiceMessagePlayer audioUrl={msg.mediaUrl} duration={msg.mediaMetadata?.durationSeconds} />
                      )}

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
                      <RobotIcon size={13} color="white" />
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

              {/* Speech / Translation Error Banner */}
              {speechError && (
                <div
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    background: 'var(--error-dim)',
                    color: 'var(--error)',
                    textAlign: 'center',
                    borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  {speechError}
                </div>
              )}

              {/* Transcription in progress banner */}
              {isTranscribing && (
                <div
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--bg-elevated)',
                    borderTop: '1px solid var(--accent-border)',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: '2px solid rgba(102, 45, 145, 0.2)',
                      borderTop: '2px solid var(--accent-primary)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      flexShrink: 0,
                    }}
                  />
                  <span>Transcribing voice note with Whisper AI…</span>
                </div>
              )}

              {/* Pending Voice Attachment Chip */}
              {pendingAttachment && (
                <div
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-elevated)',
                    borderTop: '1px solid var(--bg-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mic size={15} color="var(--accent-light)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{pendingAttachment.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    title="Remove voice note"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Bottom Input Area: Recording Controls OR Input Form */}
              {isRecording ? (
                /* Active Recording Controls */
                <div
                  style={{
                    padding: '10px 14px',
                    borderTop: '1px solid rgba(239, 68, 68, 0.3)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: '#ef4444',
                        boxShadow: '0 0 10px #ef4444',
                        animation: 'pulse 1.2s infinite',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      Recording voice note…
                    </span>
                    <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {Math.floor(recordSeconds / 60)}:{(recordSeconds % 60).toString().padStart(2, '0')} / 02:00
                    </span>

                    {/* Dynamic Audio Level Meter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => {
                        const isActive = audioLevel > bar * 11;
                        return (
                          <div
                            key={bar}
                            style={{
                              width: 3,
                              height: `${isActive ? 16 : 4}px`,
                              borderRadius: 1,
                              background: isActive ? '#ef4444' : 'rgba(255, 255, 255, 0.2)',
                              transition: 'height 0.1s ease',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={handleCancelRecording}
                      title="Cancel recording"
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--bg-border)',
                        color: 'var(--text-secondary)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      title="Finish & transcribe"
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--accent-primary)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Transcribe
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal Input Form */
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
                      placeholder={speechError ? speechError : `Ask about ${pageContext.title.toLowerCase()} or anything…`}
                      disabled={typing || isTranscribing}
                      style={{
                        width: '100%',
                        padding: '8px 36px 8px 12px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--bg-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontSize: 13,
                        transition: 'all 0.15s ease',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--accent-primary)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--bg-border)')}
                    />

                    {/* Voice Note Button */}
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      disabled={typing || isTranscribing}
                      title="Record voice note"
                      style={{
                        position: 'absolute',
                        right: 6,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.color = 'var(--accent-light)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                      }}
                    >
                      <Mic size={15} />
                    </button>
                  </div>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={(!input.trim() && !pendingAttachment) || typing || isTranscribing}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-md)',
                      background: (input.trim() || pendingAttachment) && !typing && !isTranscribing ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                      color: (input.trim() || pendingAttachment) && !typing && !isTranscribing ? 'white' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--bg-border)',
                      cursor: (input.trim() || pendingAttachment) && !typing && !isTranscribing ? 'pointer' : 'default',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Send size={14} />
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}

            {/* ── Floating Bubble Button (Movable) ───────────────── */}
      <div
        ref={bubbleContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'fixed',
          ...(position
            ? { left: position.x, top: position.y }
            : {
                right: isMobile ? 18 : 24,
                bottom: isMobile ? 'calc(78px + env(safe-area-inset-bottom, 0px))' : 36,
              }),
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          touchAction: 'none',
          userSelect: 'none',
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
            opacity: showTooltip && !isFloatingOpen && !isDragging ? 1 : 0,
            transform: showTooltip && !isFloatingOpen && !isDragging ? 'translateX(0)' : 'translateX(6px)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace: 'nowrap',
            order: position && position.x < 120 ? 2 : 0,
          }}
        >
          {isDragging ? 'Moving…' : 'Ask ROVA'}
        </div>

        {/* Circular Bubble */}
        <button
          type="button"
          onClick={e => {
            if (hasMovedRef.current) {
              e.stopPropagation();
              return;
            }
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
          title="Drag to move · Click to open"
          style={{
            width: isMobile ? 48 : 52,
            height: isMobile ? 48 : 52,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #431a6b 100%)',
            border: '1px solid rgba(157, 91, 211, 0.45)',
            boxShadow: isFloatingOpen
              ? '0 0 0 4px var(--accent-border), 0 8px 30px rgba(102, 45, 145, 0.5)'
              : '0 8px 24px rgba(102, 45, 145, 0.38), 0 2px 8px rgba(0, 0, 0, 0.4)',
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: isDragging ? 'none' : 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: showTooltip && !isDragging ? 'scale(1.08)' : 'scale(1)',
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
              <RobotIcon size={isMobile ? 24 : 26} color="#ffffff" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }} />
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

  const [waClicked, setWaClicked] = useState(false);
  if (isWhatsApp) {
    return (
      <button
        type="button"
        onClick={() => setWaClicked(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 'var(--radius-full)',
          background: waClicked ? 'rgba(37, 211, 102, 0.18)' : 'linear-gradient(135deg, #1da851, #128C3E)',
          border: waClicked ? '1px solid #25D366' : '1px solid rgba(18, 140, 62, 0.8)',
          color: waClicked ? '#25D366' : '#ffffff',
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
          marginTop: 4,
          boxShadow: waClicked ? 'none' : '0 2px 8px rgba(18, 140, 62, 0.3)',
          transition: 'all 0.15s ease',
        }}
      >
        <WhatsAppIcon size={20} color={waClicked ? '#25D366' : '#ffffff'} />
        <span>{waClicked ? 'Coming Soon' : action.label.replace(/^💬\s*/, '')}</span>
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
