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
  Sparkles,
  ExternalLink,
  RefreshCw,
  Play,
  Pause,
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
  AudioRecorder,
  transcribeAudioBlob,
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
};

const ACTION_COLORS: Record<string, string> = {
  create_invoice: '#818cf8',
  add_inventory: '#34d399',
  record_payroll: '#fbbf24',
  clarify_transaction: '#60a5fa',
  view_report: '#a78bfa',
  open_whatsapp_bot: '#25D366',
};

const STARTER_PROMPTS = [
  {
    icon: '💰',
    title: 'Financial Health',
    prompt: 'How much revenue and profit did my business generate this month?',
  },
  {
    icon: '🧾',
    title: 'Receipts & Expenses',
    prompt: 'Show me my total expenses this week and which category is highest',
  },
  {
    icon: '📦',
    title: 'Inventory Stock',
    prompt: 'Which inventory items are currently running low on stock?',
  },
  {
    icon: '📄',
    title: 'Outstanding Debts',
    prompt: 'Who owes me money and what invoices are currently unpaid?',
  },
];

// ── Audio Player Component ───────────────────────────────────────────────────

function VoiceMessagePlayer({ audioUrl, duration }: { audioUrl: string; duration?: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        marginBottom: 6,
        userSelect: 'none',
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {isPlaying ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: 2 }} />}
      </button>

      {/* Simulated waveform bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
        {[4, 8, 14, 10, 16, 7, 12, 18, 9, 13, 6, 11].map((h, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: `${h}px`,
              borderRadius: 1,
              background: isPlaying ? 'var(--accent-light)' : 'rgba(255, 255, 255, 0.4)',
              transition: 'height 0.15s ease',
            }}
          />
        ))}
      </div>

      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.8)' }}>
        {formatSecs(currentTime || duration || 0)}
      </span>
    </div>
  );
}

// ── Action Button Component ──────────────────────────────────────────────────

function ActionButton({ action, onAction }: { action: ChatAction; onAction: (action: ChatAction) => void }) {
  const Icon = ACTION_ICONS[action.type] ?? ChevronRight;
  const isWhatsApp = action.type === 'open_whatsapp_bot';
  const color = isWhatsApp ? '#25D366' : ACTION_COLORS[action.type] ?? '#a78bfa';

  return (
    <button
      onClick={() => onAction(action)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 'var(--radius-full)',
        background: `${color}20`,
        border: `1px solid ${color}40`,
        color: '#ffffff',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        marginTop: 4,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = `${color}35`;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = `${color}20`;
        (e.currentTarget as HTMLElement).style.transform = 'none';
      }}
    >
      <Icon size={13} color={color} />
      <span>{action.label}</span>
      {isWhatsApp && <ExternalLink size={12} style={{ opacity: 0.8 }} />}
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

export default function AssistantPage() {
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

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<AudioRecorder | null>(null);

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

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing, isTranscribing, isProcessingOcr]);

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

  // Clean up audio recorder on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.isRecording) {
        recorderRef.current.cancel();
      }
    };
  }, []);

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

  // ── Voice Recording Handlers ───────────────────────────────────────────────

  const handleStartRecording = async () => {
    if (isRecording) return;
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
    } catch (err: any) {
      setIsRecording(false);
      alert(err.message || 'Microphone access failed.');
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;
    try {
      setIsRecording(false);
      setIsTranscribing(true);
      const result = await recorderRef.current.stop();

      // Transcribe audio using the existing voice-to-text pipeline
      const transResult = await transcribeAudioBlob(result.blob, 'voice_note.webm');

      // Set as pending attachment ready to send or review
      setPendingAttachment({
        type: 'voice',
        url: result.audioUrl,
        name: `Voice note (${result.durationSeconds}s)`,
        durationSeconds: result.durationSeconds,
        sizeBytes: result.blob.size,
        mimeType: result.mimeType,
        extractedText: transResult.text,
        transcriptionConfidence: transResult.confidence,
      });

      // Also pre-fill text input so user can review or edit the transcription before sending!
      if (!input.trim()) {
        setInput(transResult.text);
      }
    } catch (err: any) {
      alert(`Transcription error: ${err.message || 'Could not transcribe voice note.'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCancelRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.cancel();
    }
    setIsRecording(false);
    setRecordSeconds(0);
    setAudioLevel(0);
  };

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

      // If text input is empty, pre-fill with a helpful inquiry about the document
      if (!input.trim()) {
        const typeLabel = ocrResult.documentType.toUpperCase();
        const amtStr = ocrResult.parsedData.totalAmount
          ? ` for ₦${ocrResult.parsedData.totalAmount.toLocaleString()}`
          : '';
        setInput(`Please process this ${typeLabel}${amtStr} and record it in my accounts.`);
      }
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
        fontFamily: "'Plus Jakarta Sans', sans-serif",
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
          <Sparkles size={40} color="var(--accent-primary)" />
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
                background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
                color: 'white',
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
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
          <a
            href="https://wa.me/2349132957881?text=Hi%20ROVA"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(37, 211, 102, 0.1)',
              border: '1px solid rgba(37, 211, 102, 0.25)',
              color: '#25D366',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <MessageCircle size={15} />
            <span style={{ flex: 1 }}>WhatsApp Voice & OCR</span>
            <ExternalLink size={12} />
          </a>
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
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {conversations.find((c) => c.id === currentConversationId)?.title || 'ROVA AI Assistant'}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 7px',
                  borderRadius: 10,
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: 'var(--accent-light)',
                  fontWeight: 600,
                }}
              >
                ERP Intelligence
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
                  background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
                  marginBottom: 14,
                }}
              >
                <Sparkles size={26} color="white" />
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
                {STARTER_PROMPTS.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(starter.prompt)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--bg-border)',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-border)';
                      (e.currentTarget as HTMLElement).style.transform = 'none';
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{starter.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{starter.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {starter.prompt}
                      </div>
                    </div>
                  </button>
                ))}
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
                      background: 'linear-gradient(135deg, var(--accent-primary), #4f46e5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                    }}
                  >
                    <Sparkles size={15} color="white" />
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

                  {/* Message Bubble */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isError
                        ? 'rgba(239, 68, 68, 0.15)'
                        : isUser
                        ? 'linear-gradient(135deg, var(--accent-primary), #6366f1)'
                        : 'var(--bg-card)',
                      border: isError
                        ? '1px solid rgba(239, 68, 68, 0.4)'
                        : isUser
                        ? 'none'
                        : '1px solid var(--bg-border)',
                      color: isError ? '#fca5a5' : 'var(--text-primary)',
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-line',
                      boxShadow: isUser ? '0 4px 14px rgba(99, 102, 241, 0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
                      position: 'relative',
                    }}
                  >
                    {msg.content}

                    {/* Interactive Financial Confirmation Card */}
                    {msg.requiresConfirmation && (
                      <div
                        style={{
                          marginTop: 12,
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
                    {msg.toolExecuted && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#10b981', fontSize: 11.5, fontWeight: 600 }}>
                        <CheckCircle2 size={13} />
                        <span>Action verified and executed securely</span>
                      </div>
                    )}
                  </div>

                  {/* Message Actions / Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {!isUser && (
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
                  background: 'linear-gradient(135deg, var(--accent-primary), #4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={15} color="white" />
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

          {/* Transcription In Progress */}
          {isTranscribing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--accent-border)' }}>
              <div className="upload-spinner" style={{ width: 14, height: 14, border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Transcribing voice note with Whisper AI…</span>
            </div>
          )}

          {/* OCR In Progress */}
          {isProcessingOcr && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--accent-border)' }}>
              <div className="upload-spinner" style={{ width: 14, height: 14, border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
              bottom: 90,
              right: 24,
              width: 36,
              height: 36,
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

            {/* Active Voice Recording Bar */}
            {isRecording ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  animation: 'pulse 2s infinite',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: '#ef4444',
                      boxShadow: '0 0 10px #ef4444',
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Recording voice note…
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
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
                            background: isActive ? '#ef4444' : 'rgba(255,255,255,0.2)',
                            transition: 'height 0.1s ease',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-border)')}
              >
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

                {/* Voice Note Button */}
                <button
                  type="button"
                  onClick={handleStartRecording}
                  title="Record voice note"
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
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent-light)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                >
                  <Mic size={18} />
                </button>

                {/* Multiline Text Area */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask ROVA anything about your business, attach a receipt, or dictate..."
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
              </form>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Press <kbd style={{ padding: '2px 4px', borderRadius: 3, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontSize: 10 }}>Enter</kbd> to send, <kbd style={{ padding: '2px 4px', borderRadius: 3, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontSize: 10 }}>Shift + Enter</kbd> for newline
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                🔒 Bank-grade security & audit logging
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Global animations */}
      <style>{`
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
