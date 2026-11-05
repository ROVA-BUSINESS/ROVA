export type PaymentProvider = 'paystack' | 'kuda' | 'opay' | 'moniepoint';
export type ExtendedPaymentProvider = PaymentProvider | 'manual_import';

export type ProviderConnectionStatus = 'connected' | 'not_connected' | 'pending_approval' | 'error';
export type SyncStatus = 'idle' | 'running' | 'success' | 'failed';

export type PaymentTransactionType = 'credit' | 'debit' | 'refund' | 'transfer' | 'fee';
export type PaymentProviderStatus = 'success' | 'pending' | 'failed' | 'refunded' | 'reversed';
export type PaymentVerificationStatus = 'verified' | 'unverified' | 'manual_review' | 'failed';
export type PaymentTransactionSource = 'webhook' | 'api_sync' | 'manual_import' | 'payment_link';
export type AccountingClassificationStatus = 'unclassified' | 'classified_income' | 'classified_expense' | 'classified_transfer' | 'ignored';

export interface PaymentProviderConfig {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  status: ProviderConnectionStatus;
  public_key?: string | null;
  secret_key?: string | null;
  merchant_id?: string | null;
  webhook_secret?: string | null;
  account_number?: string | null;
  is_live: boolean;
  sync_enabled: boolean;
  last_synced_at?: string | null;
  last_sync_status: SyncStatus;
  last_sync_error?: string | null;
  synced_records_count: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PaymentLink {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  provider_link_id?: string | null;
  provider_slug?: string | null;
  title: string;
  description?: string;
  amount?: number | null; // null if customer enters amount
  currency: string;
  allow_custom_amount: boolean;
  payment_url: string;
  status: 'active' | 'inactive' | 'archived';
  total_collected: number;
  payments_count: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  user_id: string;
  provider: ExtendedPaymentProvider;
  provider_account_id?: string | null;
  provider_reference: string;
  provider_event_id?: string | null;
  transaction_date: string;
  amount: number;
  currency: string;
  type: PaymentTransactionType;
  description: string;
  counterparty_name?: string | null;
  counterparty_account?: string | null;
  counterparty_bank?: string | null;
  counterparty_email?: string | null;
  counterparty_phone?: string | null;
  provider_status: PaymentProviderStatus;
  verification_status: PaymentVerificationStatus;
  source: PaymentTransactionSource;
  payment_link_id?: string | null;
  rova_transaction_id?: string | null;
  accounting_status: AccountingClassificationStatus;
  raw_payload?: Record<string, any>;
  reconciliation_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  payment_link?: PaymentLink;
}

export interface PaymentOverviewMetrics {
  totalReceived: number;
  successfulCount: number;
  successfulVolume: number;
  pendingCount: number;
  pendingVolume: number;
  failedCount: number;
  failedVolume: number;
  refundedVolume: number;
  netCollections: number;
  totalTransfers: number;
}

export interface ProviderCapabilityInfo {
  provider: PaymentProvider;
  name: string;
  displayName: string;
  tagline: string;
  color: string;
  bgLight: string;
  logoUrl?: string;
  accessStatus: 'ready' | 'requires_credentials' | 'requires_approval';
  accessNotice: string;
  approvalRequirements: string[];
  supportedFeatures: {
    paymentLinks: boolean;
    webhooks: boolean;
    historyApi: boolean;
    instantVerification: boolean;
    refunds: boolean;
  };
  supportedCurrencies: string[];
  supportedPaymentMethods: string[];
  docsUrl: string;
  webhookHelp: string;
}

export interface StatementParsedRow {
  rowNumber: number;
  date: string;
  description: string;
  reference: string;
  amount: number;
  type: PaymentTransactionType;
  currency: string;
  counterpartyName?: string;
  status: PaymentProviderStatus;
  isDuplicate?: boolean;
  duplicateMatchId?: string;
  validationError?: string;
}

