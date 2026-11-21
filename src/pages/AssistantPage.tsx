import WhatsAppIcon from '../components/ui/WhatsAppIcon';
import RobotIcon from "../components/ui/RobotIcon";
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send,
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Mic,
  Square,
  RotateCcw,
  Copy,
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Paperclip,
  TrendingUp,
  Package,
  Users,
  FileText,
  HelpCircle,
  MessageCircle,
  ArrowDown,
} from 'lucide-react';
import { useMobile } from '../hooks/useMobile';
import {
  useAssistant,
  type PendingMediaAttachment,
} from '../contexts/AssistantContext';
import {
  uploadAndOcrDocument,
} from '../lib/aiMediaService';
import type { ChatAction, PendingClarification } from '../lib/deepseekClient';

const ACTION_ICONS: Record<string, React.ElementType> = {
  create_invoice: FileText,
  add_inventory: Package,
  record_payroll: Users,
  clarify_transaction: HelpCircle,
  view_report: TrendingUp,
  open_whatsapp_bot: MessageCircle,
  confirm_large_transaction: CheckCircle2,
  undo_transaction: RotateCcw,
};

const ACTION_COLORS: Record<string, string> = {
  create_invoice: '#818cf8',
  add_inventory: '#34d399',
  record_payroll: '#fbbf24',
  clarify_transaction: '#60a5fa',
  view_report: '#a78bfa',
  open_whatsapp_bot: '#25D366',
  confirm_large_transaction: '#10b981',
  undo_transaction: '#f87171',
};

const STARTER_PROMPTS = [
  {
    icon: HelpCircle,
    badge: 'Explain',
    title: 'General Knowledge',
    prompt: 'Can you explain how quantum computing works in simple terms?',
  },
  {
    icon: TrendingUp,
    badge: 'Brainstorm',
    title: 'Ideas & Strategy',
    prompt: 'Brainstorm 5 innovative marketing and growth ideas for a startup in 2026.',
  },
  {
    icon: FileText,
    badge: 'Business',
    title: 'Business & Finance',
    prompt: 'What are the most effective ways to manage cash flow and improve profit margins?',
  },
  {
    icon: MessageSquare,
    badge: 'Chat',
    title: 'Casual Conversation',
    prompt: 'Hi! What are some fascinating science or technology discoveries from recently?',
  },
];

import VoiceMessagePlayer from '../components/assistant/VoiceMessagePlayer';

// ── Action Button Component ──────────────────────────────────────────────────

function ActionButton({ action, onAction }: { action: ChatAction; onAction: (action: ChatAction) => void }) {
  const isWhatsApp = action.type === 'open_whatsapp_bot';
  const [clicked, setClicked] = useState(false);
  const Icon = isWhatsApp ? WhatsAppIcon : (ACTION_ICONS[action.type] ?? ChevronRight);
  const color = isWhatsApp ? '#25D366' : (ACTION_COLORS[action.type] ?? 'var(--accent-light)');

  const handleClick = () => {
    if (isWhatsApp) {
      setClicked(true);
      return;
    }
    onAction(action);
  };

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: isWhatsApp ? '8px 16px' : '7px 14px',
        borderRadius: 'var(--radius-full)',
        background: isWhatsApp ? (clicked ? 'rgba(37, 211, 102, 0.2)' : 'rgba(37, 211, 102, 0.12)') : 'rgba(255, 255, 255, 0.05)',
        border: isWhatsApp ? (clicked ? '1px solid #25D366' : '1px solid rgba(37, 211, 102, 0.35)') : '1px solid var(--bg-border)',
        color: isWhatsApp ? '#4ade80' : 'var(--text-primary)',
        fontSize: 12.5,
        fontWeight: 600,
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        marginTop: 6,
        fontFamily: "'Inter', 'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isWhatsApp ? 'rgba(37, 211, 102, 0.25)' : 'rgba(255, 255, 255, 0.09)';
        e.currentTarget.style.borderColor = isWhatsApp ? '#25D366' : 'var(--accent-border)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isWhatsApp ? (clicked ? 'rgba(37, 211, 102, 0.2)' : 'rgba(37, 211, 102, 0.12)') : 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.borderColor = isWhatsApp ? (clicked ? '1px solid #25D366' : '1px solid rgba(37, 211, 102, 0.35)') : '1px solid var(--bg-border)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      <Icon size={isWhatsApp ? 22 : 14} color={isWhatsApp ? '#25D366' : color} />
      <span>{isWhatsApp && clicked ? 'Coming Soon' : action.label.replace(/^💬\s*/, '')}</span>
      {isWhatsApp && (
        <span style={{ fontSize: 10, background: 'rgba(37, 211, 102, 0.25)', color: '#4ade80', padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>Soon</span>
      )}
    </button>
  );
}

// ── Pending Clarification Card ───────────────────────────────────────────────

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
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        animation: 'fadeIn 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              flexShrink: 0,
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
        >
          <X size={13} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
          placeholder="Type your answer…"
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            background: 'var(--bg-card)',
            border: '1px solid var(--bg-border)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleResolve}
          disabled={!answer.trim() || saving}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            background: answer.trim() && !saving ? '#f59e0b' : 'var(--bg-card)',
            color: answer.trim() && !saving ? 'white' : 'var(--text-muted)',
            border: '1px solid var(--bg-border)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {saving ? '…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

// ── Main ChatGPT-Style Assistant Page ────────────────────────────────────────

function renderFormattedContent(text: string) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith('•') || trimmed.startsWith('* ') || trimmed.startsWith('- ');
    const rawContent = isBullet ? trimmed.replace(/^([•*-]\s*)/, '') : line;

    const parts = rawContent.split(/(\*\*.*?\*\*)/g);
    const elements = parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (isBullet) {
      return (
        <div key={lineIdx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', margin: '3px 0' }}>
          <span style={{ color: 'var(--accent-light)', fontSize: 13, lineHeight: '20px' }}>•</span>
          <span style={{ flex: 1 }}>{elements}</span>
        </div>
      );
    }

    return (
      <div key={lineIdx} style={{ minHeight: trimmed ? undefined : 6 }}>
        {elements}
      </div>
    );
  });
}

export default function AssistantPage() {
  const [waPromoComingSoon, setWaPromoComingSoon] = useState(false);
  const isMobile = useMobile(900);

  const {
    messages,
    typing,
    clarifications,
    refreshing,
    handleRefresh,
    conversations,
    currentConversationId,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
    stopGeneration,
    retryMessage,
    handleAction,
    handleResolve,
    handleDismiss,
  } = useAssistant();

  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Voice dictation state (matching AI bubble)
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const recognitionRef = useRef<any>(null);

  // Document attachment & OCR state
  const [pendingAttachment, setPendingAttachment] = useState<PendingMediaAttachment | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  // Initialize browser SpeechRecognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      try {
        recognition.lang = navigator.language || 'en-US';
      } catch {
        recognition.lang = 'en-US';
      }

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setVoiceTranscript(transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access denied. Please allow microphone permissions in your browser.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const confirmVoiceRecording = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsListening(false);
    if (voiceTranscript.trim()) {
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${voiceTranscript.trim()}` : voiceTranscript.trim()));
    }
    setVoiceTranscript('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const cancelVoiceRecording = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsListening(false);
    setVoiceTranscript('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const toggleSpeechRecognition = () => {
    if (!speechSupported) {
      alert(
        'Voice dictation is not natively supported in this browser. Please use Chrome, Edge, Safari, or send voice notes directly via WhatsApp!'
      );
      return;
    }
    setSpeechError('');
    if (isListening) {
      confirmVoiceRecording();
    } else {
      setVoiceTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (messages.some(m => m.role === 'user')) { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }
  }, [messages, typing, isProcessingOcr]);

  // Track scroll position to show jump-to-bottom arrow
  const handleScroll = useCallback(() => {
    const el = chatScrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceToBottom > 150);
  }, []);

  // Resize textarea dynamically
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
  }, [input]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const term = searchTerm.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(term) ||
        c.messages.some((m) => m.content.toLowerCase().includes(term))
    );
  }, [conversations, searchTerm]);

  // ── Document & Image OCR Handlers ──────────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setOcrError(null);
    setIsProcessingOcr(true);

    try {
      const ocrResult = await uploadAndOcrDocument(file);

      setPendingAttachment({
        type: file.type === 'application/pdf' ? 'document' : 'image',
        url: ocrResult.fileUrl,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        extractedText: ocrResult.extractedText,
        parsedData: ocrResult.parsedData,
      });

      
    } catch (err: any) {
      console.error('OCR process error:', err);
      setOcrError(err.message || 'Failed to process document OCR.');
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // ── Drag & Drop Handlers ───────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // ── Submit Message ─────────────────────────────────────────────────────────

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
    }
    const cleanText = input.trim();
    if ((!cleanText && !pendingAttachment) || typing) return;

    sendMessage(
      cleanText,
      { pathname: '/app/assistant', pageTitle: 'AI Assistant Workspace' },
      pendingAttachment || undefined
    );

    setInput('');
    setPendingAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        height: 'calc(100vh - var(--header-height, 64px))',
        position: 'relative',
        background: 'var(--bg-base)',
        overflow: 'hidden',
        color: 'var(--text-primary)',
        fontFamily: "'Inter', 'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ── Drag & Drop Overlay ────────────────────────────────────────────── */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '2px dashed var(--accent-primary)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            pointerEvents: 'none',
          }}
        >
          <RobotIcon size={44} color="var(--accent-primary)" />
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Drop your receipt or document here</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            ROVA OCR will automatically extract amounts, vendor details, and items.
          </p>
        </div>
      )}

      {/* ── Collapsible Conversation Sidebar ───────────────────────────────── */}
      <aside
        style={{
          width: isMobile ? (sidebarOpen ? '100%' : '0px') : sidebarOpen ? '280px' : '0px',
          minWidth: isMobile ? undefined : sidebarOpen ? '280px' : '0px',
          height: '100%',
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--bg-border)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          zIndex: isMobile ? 50 : 2,
          position: isMobile ? 'absolute' : 'relative',
        }}
      >
        {/* Sidebar Header: New Chat Button & Close on mobile */}
        <div style={{ padding: '16px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => {
                createConversation();
                if (isMobile) setSidebarOpen(false);
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                color: 'white',
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(102, 45, 145, 0.28)',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={16} />
              <span>New Chat</span>
            </button>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 8,
                  marginLeft: 8,
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Search conversations */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
            }}
          >
            <Search size={13} color="var(--text-muted)" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search conversations…"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 12,
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Conversation List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '8px 8px 4px' }}>
            Conversations ({filteredConversations.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filteredConversations.map((c) => {
              const isActive = c.id === currentConversationId;
              const isEditing = editingConvId === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (!isEditing) {
                      selectConversation(c.id);
                      if (isMobile) setSidebarOpen(false);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: isActive ? 'var(--bg-elevated)' : 'transparent',
                    border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
                    <MessageSquare size={14} color={isActive ? 'var(--accent-light)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                    {isEditing ? (
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameConversation(c.id, editTitle);
                            setEditingConvId(null);
                          } else if (e.key === 'Escape') {
                            setEditingConvId(null);
                          }
                        }}
                        autoFocus
                        style={{
                          background: 'var(--bg-base)',
                          border: '1px solid var(--accent-primary)',
                          borderRadius: 4,
                          padding: '2px 6px',
                          color: 'var(--text-primary)',
                          fontSize: 12,
                          width: '100%',
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.title}
                      </span>
                    )}
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {isEditing ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          renameConversation(c.id, editTitle);
                          setEditingConvId(null);
                        }}
                        style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 2 }}
                      >
                        <Check size={13} />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingConvId(c.id);
                            setEditTitle(c.title);
                          }}
                          title="Rename"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 3,
                            opacity: isActive ? 0.8 : 0,
                            transition: 'opacity 0.15s',
                          }}
                          className="conv-action-btn"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete "${c.title}"?`)) {
                              deleteConversation(c.id);
                            }
                          }}
                          title="Delete"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 3,
                            opacity: isActive ? 0.8 : 0,
                            transition: 'opacity 0.15s',
                          }}
                          className="conv-action-btn"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* WhatsApp Bot Promo Footer */}
        <div style={{ padding: 12, borderTop: '1px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <button
            type="button"
            onClick={() => setWaPromoComingSoon(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: waPromoComingSoon ? 'rgba(37, 211, 102, 0.2)' : 'rgba(37, 211, 102, 0.1)',
              border: waPromoComingSoon ? '1px solid #25D366' : '1px solid rgba(37, 211, 102, 0.25)',
              color: '#25D366',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <WhatsAppIcon size={22} color="#25D366" />
            <span style={{ flex: 1 }}>{waPromoComingSoon ? 'Coming Soon' : 'WhatsApp Voice & OCR'}</span>
            {waPromoComingSoon ? (
              <span style={{ fontSize: 10, background: 'rgba(37, 211, 102, 0.25)', padding: '2px 6px', borderRadius: 4 }}>Soon</span>
            ) : (
              <ExternalLink size={12} />
            )}
          </button>
        </div>
      </aside>

      {/* ── Main Chat Column ──────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: 'var(--bg-base)',
          position: 'relative',
        }}
      >
        {/* Chat Header Bar */}
        <header
          style={{
            height: 52,
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            background: 'var(--bg-card)',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Collapse sidebar' : 'Open conversations'}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  boxShadow: '0 0 8px var(--success)',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? 180 : 350 }}>
                {conversations.find((c) => c.id === currentConversationId)?.title || 'ROVA AI Assistant'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleRefresh}
              title="Refresh financial data snapshot"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              <span style={{ display: isMobile ? 'none' : 'inline' }}>Sync Data</span>
            </button>
          </div>
        </header>

        {/* Messages Thread Container */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxWidth: 900,
            width: '100%',
            margin: '0 auto',
          }}
        >
          {/* Welcome Hero when no user messages exist in this conversation */}
          {messages.filter((m) => m.role === 'user').length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '30px 16px 20px',
                animation: 'fadeIn 0.3s ease',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(102, 45, 145, 0.3)',
                  marginBottom: 14,
                }}
              >
                <RobotIcon size={30} color="white" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
                How can ROVA help your business today?
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 520, lineHeight: 1.6, marginBottom: 24 }}>
                Ask financial questions, attach receipts for automated OCR expense logging, or record voice notes to dictate transactions.
              </p>

              {/* Starter Prompt Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 10,
                  width: '100%',
                  maxWidth: 680,
                }}
              >
                {STARTER_PROMPTS.map((starter, i) => {
                  const Icon = starter.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => sendMessage(starter.prompt)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '16px 18px',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--bg-card)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: 'var(--shadow-sm)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(124, 58, 237, 0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--accent-dim)',
                          color: 'var(--accent-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Icon size={16} />
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--accent-light)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(124, 58, 237, 0.1)',
                          border: '1px solid rgba(124, 58, 237, 0.2)',
                        }}>
                          {starter.badge}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 4 }}>
                          {starter.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {starter.prompt}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Clarifications Section */}
          {clarifications.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#f59e0b',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertCircle size={14} color="#f59e0b" />
                Pending Clarifications ({clarifications.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {clarifications.map((item) => (
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

          {/* Message Thread */}
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isError = msg.status === 'error';

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  gap: 10,
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                    }}
                  >
                    <RobotIcon size={17} color="white" />
                  </div>
                )}

                <div style={{ maxWidth: isMobile ? '88%' : '75%', display: 'flex', flexDirection: 'column' }}>
                  {/* Media Preview (Voice or Image) */}
                  {msg.mediaType === 'voice' && msg.mediaUrl && (
                    <VoiceMessagePlayer audioUrl={msg.mediaUrl} duration={msg.mediaMetadata?.durationSeconds} />
                  )}

                  {msg.mediaType === 'image' && msg.mediaUrl && (
                    <div
                      style={{
                        marginBottom: 6,
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        border: '1px solid var(--bg-border)',
                        maxWidth: 240,
                        alignSelf: isUser ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <img
                        src={msg.mediaUrl}
                        alt="Attached Document"
                        style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 180, objectFit: 'cover' }}
                      />
                      <div style={{ padding: '4px 8px', background: 'var(--bg-elevated)', fontSize: 11, color: 'var(--text-muted)' }}>
                        📎 {msg.mediaMetadata?.fileName || 'Document Attachment'}
                      </div>
                    </div>
                  )}

                  {/* Message Text Bubble - only render if there is actual text */}
                  {msg.content?.trim() ? (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isError
                          ? 'rgba(239, 68, 68, 0.15)'
                          : isUser
                          ? 'linear-gradient(135deg, var(--accent-primary), #7c3aed)'
                          : 'var(--bg-card)',
                        border: isError
                          ? '1px solid rgba(239, 68, 68, 0.4)'
                          : isUser
                          ? 'none'
                          : '1px solid var(--bg-border)',
                        color: isError ? '#fca5a5' : (isUser ? '#ffffff' : 'var(--text-primary)'),
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-line',
                        boxShadow: isUser ? '0 4px 14px rgba(102, 45, 145, 0.25)' : '0 2px 8px rgba(0,0,0,0.1)',
                        position: 'relative',
                      }}
                    >
                      {renderFormattedContent(msg.content)}
                    </div>
                  ) : null}

                  {/* Recorded Transactions Card */}
                  {msg.recordedTransactions && msg.recordedTransactions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: msg.content?.trim() ? 10 : 0 }}>
                      {msg.recordedTransactions.map((tx: any, idx: number) => {
                        const isIncome = tx.type === 'income';
                        const amt = Number(tx.amount || 0);
                        return (
                          <div
                            key={tx.id || idx}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 'var(--radius-md)',
                              background: isIncome ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                              border: isIncome ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: isIncome ? '#10b981' : '#f87171' }}>
                                  {isIncome ? '+₦' : '-₦'}{amt.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: isIncome ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: isIncome ? '#10b981' : '#f87171', fontWeight: 600 }}>
                                  {isIncome ? 'Money In' : 'Money Out'}
                                </span>
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                📅 {tx.date}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {tx.description}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                              <span>🏷️ {tx.ai_category || 'General'}</span>
                              {tx.reference && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ref: {tx.reference}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Interactive Financial Confirmation Card */}
                  {msg.requiresConfirmation && (
                    <div
                      style={{
                        marginTop: msg.content?.trim() ? 12 : 0,
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>
                        <AlertCircle size={15} />
                        <span>Confirmation Required</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                        {msg.confirmationSummary || 'Please verify the transaction details above before proceeding.'}
                      </p>
                    </div>
                  )}

                  {/* Success Indicator if tool executed */}
                  {msg.toolExecuted && (!msg.recordedTransactions || msg.recordedTransactions.length === 0) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#10b981', fontSize: 11.5, fontWeight: 600 }}>
                      <CheckCircle2 size={13} />
                      <span>Action verified and executed securely</span>
                    </div>
                  )}

                  {/* Message Actions / Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {!isUser && msg.content?.trim() && (
                      <button
                        onClick={() => copyMessage(msg.id, msg.content)}
                        title="Copy message"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedId === msg.id ? '#10b981' : 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 11,
                          padding: 2,
                        }}
                      >
                        {copiedId === msg.id ? <Check size={11} /> : <Copy size={11} />}
                        <span>{copiedId === msg.id ? 'Copied' : ''}</span>
                      </button>
                    )}

                    {isError && (
                      <button
                        onClick={() => retryMessage(msg.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          fontSize: 11,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        <RotateCcw size={11} />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>

                  {/* Action Buttons attached to this message */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingLeft: 2 }}>
                      {msg.actions.map((action, i) => (
                        <ActionButton key={i} action={action} onAction={handleAction} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {typing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeIn 0.2s ease' }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <RobotIcon size={17} color="white" />
              </div>
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '18px 18px 18px 4px',
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--accent-light)',
                      animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>ROVA is thinking…</span>
              </div>
            </div>
          )}


          {/* OCR In Progress */}
          {isProcessingOcr && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--accent-border)' }}>
              <div className="upload-spinner" style={{ width: 14, height: 14, border: '2px solid rgba(102,45,145,0.2)', borderTop: '2px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Analyzing document & running OCR extraction…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollBottom && (
          <button
            onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              position: 'absolute',
              bottom: isMobile ? 75 : 85,
              right: isMobile ? 16 : 24,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--bg-card)',
              border: '1px solid var(--bg-border)',
              color: 'var(--text-secondary)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 20,
            }}
          >
            <ArrowDown size={16} />
          </button>
        )}

        {/* Stop Generation Floating Control */}
        {typing && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <button
              onClick={stopGeneration}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-card)',
                border: '1px solid var(--bg-border)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '#ef4444')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-border)')}
            >
              <Square size={11} fill="#ef4444" color="#ef4444" />
              <span>Stop generating</span>
            </button>
          </div>
        )}

        {/* ── Bottom Input Section ─────────────────────────────────────────── */}
        <div
          style={{
            borderTop: '1px solid var(--bg-border)',
            background: 'var(--bg-card)',
            padding: '12px 16px 16px',
            flexShrink: 0,
          }}
        >
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Pending Attachment Chip */}
            {pendingAttachment && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--accent-border)',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {pendingAttachment.type === 'voice' ? (
                    <Mic size={15} color="var(--accent-light)" />
                  ) : (
                    <FileText size={15} color="var(--accent-light)" />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{pendingAttachment.name}</span>
                  {pendingAttachment.parsedData?.totalAmount && (
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 700 }}>
                      ₦{pendingAttachment.parsedData.totalAmount.toLocaleString()}
                    </span>
                  )}
                  {pendingAttachment.parsedData?.merchant && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      • {pendingAttachment.parsedData.merchant}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPendingAttachment(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* OCR Error Notification */}
            {ocrError && (
              <div style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: 11.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{ocrError}</span>
                <button onClick={() => setOcrError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><X size={12} /></button>
              </div>
            )}

            {/* Bottom Message Input Form */}
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: isListening ? '6px 10px' : '8px 12px',
                borderRadius: isListening ? '28px' : 'var(--radius-lg)',
                background: isListening ? 'rgba(32, 34, 38, 0.95)' : 'var(--bg-elevated)',
                border: isListening ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid var(--bg-border)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                minHeight: 48,
                boxShadow: isListening ? '0 4px 20px rgba(0, 0, 0, 0.35)' : 'none',
              }}
              onFocus={(e) => {
                if (!isListening) e.currentTarget.style.borderColor = 'var(--accent-primary)';
              }}
              onBlur={(e) => {
                if (!isListening) e.currentTarget.style.borderColor = 'var(--bg-border)';
              }}
            >
              {isListening ? (
                /* Sleek Voice Transcription Interface */
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    gap: 12,
                    padding: '2px 4px',
                  }}
                >
                  {/* Left: Plus Icon + Italicized Listening / Text */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach file"
                      style={{
                        width: 28,
                        height: 28,
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      <Plus size={18} />
                    </button>

                    <span
                      style={{
                        fontStyle: 'italic',
                        fontSize: 14,
                        color: voiceTranscript ? 'var(--text-primary)' : 'rgba(255, 255, 255, 0.7)',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        userSelect: 'none',
                      }}
                    >
                      {voiceTranscript || 'Listening...'}
                    </span>
                  </div>

                  {/* Center-Right: Animated Dotted Waveform */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3.5, flexShrink: 0 }}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => (
                      <span
                        key={i}
                        style={{
                          width: 2.5,
                          height: 2.5,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255, 255, 255, 0.6)',
                          animation: 'pulseDot 1.4s infinite ease-in-out',
                          animationDelay: `${i * 0.08}s`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Right: [X] Cancel and [✓] Confirm buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      title="Cancel dictation"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                      }}
                    >
                      <X size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={confirmVoiceRecording}
                      title="Done - insert transcribed text"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.12)',
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                        e.currentTarget.style.color = '#10b981';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />

                  {/* Attach Document Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach receipt, invoice, or document"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 'var(--radius-md)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                  >
                    <Paperclip size={18} />
                  </button>

                  {/* Voice Dictation Button */}
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    title="Dictate with voice (Speak to ROVA)"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 'var(--radius-md)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--accent-light)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    }}
                  >
                    <Mic size={18} />
                  </button>

                  {/* Multiline Text Area */}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={speechError ? speechError : 'Ask ROVA anything about your business, attach a receipt, or dictate...'}
                    rows={1}
                    disabled={typing}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      resize: 'none',
                      maxHeight: 140,
                      padding: '6px 4px',
                      fontFamily: 'inherit',
                    }}
                  />

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={(!input.trim() && !pendingAttachment) || typing}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-md)',
                      background:
                        (input.trim() || pendingAttachment) && !typing
                          ? 'var(--accent-primary)'
                          : 'rgba(255, 255, 255, 0.05)',
                      color: (input.trim() || pendingAttachment) && !typing ? 'white' : 'var(--text-muted)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: (input.trim() || pendingAttachment) && !typing ? 'pointer' : 'default',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Send size={15} />
                  </button>
                </>
              )}
            </form>


          </div>
        </div>
      </main>

      {/* Global animations */}
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.35); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .conv-action-btn:hover {
          color: var(--text-primary) !important;
        }
      `}</style>
    </div>
  );
}
