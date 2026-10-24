import { supabase } from './supabase';
import type { ChatAction } from './deepseekClient';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
  requiresConfirmation?: boolean;
  confirmationSummary?: string;
  pendingToolCall?: { name: string; parameters: Record<string, any> } | null;
  toolExecuted?: boolean;
  // Media attachments
  mediaType?: 'voice' | 'image' | 'document' | 'none';
  mediaUrl?: string;
  mediaMetadata?: {
    fileName?: string;
    durationSeconds?: number;
    fileSizeBytes?: number;
    mimeType?: string;
    transcriptionConfidence?: number;
    ocrExtractedFields?: Record<string, any>;
  };
  // Status tracking for retry & streaming
  status?: 'sending' | 'streaming' | 'sent' | 'error';
  errorMessage?: string;
  isTyping?: boolean;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  isPinned?: boolean;
  messages: ChatMessage[];
}

const STORAGE_PREFIX = 'rova_ai_conversations_';
const ACTIVE_CONV_PREFIX = 'rova_active_conv_id_';

export const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm ROVA, your conversational ERP and financial assistant. I have live access to your transactions, inventory, payroll, and invoices.\n\nYou can chat with me using:\n• **Text:** Ask anything about your financial health, profit, or unpaid debts\n• **Voice:** Record audio notes or upload audio files to dictate transactions\n• **Images & Documents:** Upload receipts, bills, or invoices for automated OCR analysis",
  timestamp: new Date(),
  actions: [
    { type: 'open_whatsapp_bot', label: '💬 Chat with ROVA Bot on WhatsApp' },
  ],
};

// ── Token Budget Estimator & Summarizer ──────────────────────────────────────

/**
 * Fast estimation of token count for a text string (~4 chars per token).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Prepares the conversation history for the AI prompt within a token budget.
 * Automatically summarizes older messages when the history exceeds the budget.
 */
export function prepareMessagesWithinBudget(
  messages: ChatMessage[],
  maxTokens: number = 3200
): { role: 'user' | 'assistant' | 'system'; content: string }[] {
  // Filter out pending or typing states
  const validMessages = messages.filter((m) => !m.isTyping && m.status !== 'error');

  if (validMessages.length <= 4) {
    return validMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  // Calculate tokens from newest to oldest
  let tokenCount = 0;
  const recentMessages: ChatMessage[] = [];
  const olderMessages: ChatMessage[] = [];

  for (let i = validMessages.length - 1; i >= 0; i--) {
    const msg = validMessages[i];
    const msgTokens = estimateTokens(msg.content);

    if (tokenCount + msgTokens < maxTokens || recentMessages.length < 4) {
      tokenCount += msgTokens;
      recentMessages.unshift(msg);
    } else {
      olderMessages.unshift(msg);
    }
  }

  // If we had to truncate older messages, generate a concise summary header
  if (olderMessages.length > 0) {
    const summarySnippets = olderMessages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'User' : 'ROVA'}: ${m.content.slice(0, 80).replace(/\n/g, ' ')}`)
      .join(' | ');

    const summaryMessage = {
      role: 'system' as const,
      content: `[Previous conversation summary (${olderMessages.length} earlier turns): ${summarySnippets}]`,
    };

    return [summaryMessage, ...recentMessages.map((m) => ({ role: m.role, content: m.content }))];
  }

  return recentMessages.map((m) => ({ role: m.role, content: m.content }));
}

// ── Conversation Storage & Persistence ───────────────────────────────────────

/**
 * Loads all conversations for an authenticated user.
 */
export async function loadUserConversations(userId: string): Promise<Conversation[]> {
  if (!userId) return [];

  // Step 1: Check localStorage cache first for instant UI responsiveness
  const localKey = `${STORAGE_PREFIX}${userId}`;
  let localConvs: Conversation[] = [];
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localConvs = parsed.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt || c.created_at || Date.now()),
          updatedAt: new Date(c.updatedAt || c.updated_at || Date.now()),
          messages: (c.messages || []).map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp || Date.now()),
          })),
        }));
      }
    }
  } catch (err) {
    console.warn('Failed to parse local conversations cache:', err);
  }

  // Step 2: Attempt to load from Supabase if table exists
  try {
    const { data: dbData, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (!error && Array.isArray(dbData) && dbData.length > 0) {
      // Merge DB conversations with messages
      const convList: Conversation[] = dbData.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        title: d.title || 'Conversation',
        createdAt: new Date(d.created_at),
        updatedAt: new Date(d.updated_at),
        isPinned: Boolean(d.is_pinned),
        messages: Array.isArray(d.messages)
          ? d.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp || Date.now()),
            }))
          : [],
      }));

      // Update local cache
      saveConversationsToLocal(userId, convList);
      return convList;
    }
  } catch (dbErr) {
    // Graceful fallback to local storage
  }

  if (localConvs.length === 0) {
    // Create an initial default conversation if none exist
    const defaultConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      title: 'New Conversation',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [INITIAL_WELCOME_MESSAGE],
    };
    localConvs = [defaultConv];
    saveConversationsToLocal(userId, localConvs);
  }

  return localConvs;
}

/**
 * Saves conversations to local storage.
 */
export function saveConversationsToLocal(userId: string, conversations: Conversation[]): void {
  if (!userId) return;
  try {
    const localKey = `${STORAGE_PREFIX}${userId}`;
    const serialized = conversations.map((c) => ({
      ...c,
      messages: c.messages.filter((m) => !m.isTyping).slice(-60), // keep last 60 per conv
    }));
    localStorage.setItem(localKey, JSON.stringify(serialized));
  } catch (err) {
    console.warn('Failed to save conversations to local storage:', err);
  }
}

/**
 * Saves or updates a specific conversation in local storage and Supabase.
 */
export async function persistConversation(
  userId: string,
  conversation: Conversation
): Promise<void> {
  if (!userId || !conversation) return;

  // 1. Update local cache
  try {
    const existing = await loadUserConversations(userId);
    const index = existing.findIndex((c) => c.id === conversation.id);
    if (index >= 0) {
      existing[index] = conversation;
    } else {
      existing.unshift(conversation);
    }
    saveConversationsToLocal(userId, existing);
  } catch (err) {
    console.warn('Local persist error:', err);
  }

  // 2. Sync to Supabase in the background
  try {
    await supabase.from('chat_conversations').upsert({
      id: conversation.id,
      user_id: userId,
      title: conversation.title,
      messages: conversation.messages.filter((m) => !m.isTyping).slice(-60),
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore if table doesn't exist
  }
}

/**
 * Deletes a conversation from storage and Supabase.
 */
export async function deleteConversationById(
  userId: string,
  conversationId: string
): Promise<void> {
  if (!userId || !conversationId) return;

  try {
    const existing = await loadUserConversations(userId);
    const filtered = existing.filter((c) => c.id !== conversationId);
    saveConversationsToLocal(userId, filtered);
  } catch (err) {
    console.warn('Delete local error:', err);
  }

  try {
    await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);
  } catch {
    // ignore
  }
}

/**
 * Gets the active conversation ID for a user.
 */
export function getActiveConversationId(userId: string): string | null {
  if (!userId) return null;
  return localStorage.getItem(`${ACTIVE_CONV_PREFIX}${userId}`);
}

/**
 * Sets the active conversation ID for a user.
 */
export function setActiveConversationId(userId: string, conversationId: string): void {
  if (!userId) return;
  localStorage.setItem(`${ACTIVE_CONV_PREFIX}${userId}`, conversationId);
}

/**
 * Generates an automatic title for a conversation based on the first user message.
 */
export function generateConversationTitle(firstUserMessage: string): string {
  const clean = firstUserMessage.replace(/^[#\s\d.-]+/, '').trim();
  if (!clean) return 'New Conversation';
  const firstSentence = clean.split(/[.?!;\n]/)[0].trim();
  if (firstSentence.length <= 40) return firstSentence;
  return firstSentence.substring(0, 37) + '…';
}
