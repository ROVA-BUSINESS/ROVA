// types.ts - Core types for ROVA AI Orchestrator

export type AISource = 'web' | 'whatsapp';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}

export interface OrchestratorContext {
  userId: string;
  source?: AISource;
  isStaff?: boolean;
  documentUrl?: string;
  documentFileName?: string;
  transactions?: any[];
  accounts?: any[];
  inventoryItems?: any[];
  expenses?: any[];
  bills?: any[];
  externalWorkers?: any[];
  serviceAgreements?: any[];
  activeConversationId?: string;
  pendingAction?: {
    toolName: string;
    parameters: Record<string, any>;
    promptedQuestion?: string;
  };
}

export interface OrchestratorRequest {
  userId: string;
  messages: ChatMessage[];
  message?: string;
  context?: OrchestratorContext;
  source?: AISource;
  confirmed?: boolean;
  cancelled?: boolean;
  pendingToolCall?: {
    name: string;
    parameters: Record<string, any>;
  } | null;
  idempotencyKey?: string;
}

export interface ToolAction {
  type: string;
  label: string;
  payload: Record<string, any>;
}

export interface DocumentAttachment {
  url: string;
  fileName: string;
  caption: string;
  mimeType: string;
}

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  data?: any;
  formattedSummary: string;
  actions?: ToolAction[];
  recordId?: string;
  documentToSend?: DocumentAttachment;
  requiresClarification?: boolean;
  clarificationQuestion?: string;
  errorMessage?: string;
}

export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'read' | 'write' | 'high_risk';
  parameters: Record<string, ToolParameterSchema>;
  requiresConfirmation: boolean;
  execute: (
    supabaseClient: any,
    userId: string,
    params: Record<string, any>,
    rawMsg: string,
    meta?: Record<string, any>
  ) => Promise<ToolExecutionResult>;
}

export interface IntentAnalysis {
  primaryCategory:
    | 'general_chat'
    | 'accounting_question'
    | 'business_advice'
    | 'record_transaction'
    | 'query_data'
    | 'document_operation'
    | 'manage_memory'
    | 'clarification_response'
    | 'follow_up';
  needsFinancialSnapshot: boolean;
  neededTables: string[];
  suggestedToolCall: {
    name: string;
    parameters: Record<string, any>;
  } | null;
  isMultiIntent: boolean;
  clarificationNeeded?: string | null;
  confidence: number;
}

export interface OrchestratorResponse {
  reply: string;
  actions?: ToolAction[];
  requiresConfirmation?: boolean;
  confirmationSummary?: string;
  pendingToolCall?: {
    name: string;
    parameters: Record<string, any>;
  } | null;
  toolExecuted?: boolean;
  documentToSend?: DocumentAttachment;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
  };
}
