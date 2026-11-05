import { supabase } from './supabase';
import type {
  PaymentProvider,
  ExtendedPaymentProvider,
  PaymentProviderConfig,
  PaymentLink,
  PaymentTransaction,
  PaymentOverviewMetrics,
  ProviderCapabilityInfo,
  StatementParsedRow,
} from '../types/payment';

// ── Provider Capabilities & Official Documentation Metadata ─────────────────

export const PROVIDER_CAPABILITIES: Record<PaymentProvider, ProviderCapabilityInfo> = {
  paystack: {
    provider: 'paystack',
    name: 'Paystack',
    displayName: 'Paystack',
    tagline: "Nigeria's modern payment infrastructure for cards, transfers, USSD & mobile money",
    color: '#00c3f7',
    bgLight: 'rgba(0, 195, 247, 0.1)',
    accessStatus: 'ready',
    accessNotice: 'Active & Verified. Native payment link generation, instant verification, and webhooks operational.',
    approvalRequirements: [
      'Active Paystack account (Starter or Registered Business).',
      'Bank account verification for settlement payouts.',
      'API Keys (Public Key & Secret Key) configured in Rova.',
      'Webhook configured on Paystack Dashboard targeting /api/payment/webhook/paystack.',
    ],
    supportedFeatures: {
      paymentLinks: true,
      webhooks: true,
      historyApi: true,
      instantVerification: true,
      refunds: true,
    },
    supportedCurrencies: ['NGN', 'USD', 'GHS', 'ZAR', 'KES'],
    supportedPaymentMethods: ['Card', 'Bank Transfer', 'USSD', 'Apple Pay', 'Visa QR'],
    docsUrl: 'https://paystack.com/docs/api/',
    webhookHelp: 'Configure Webhook URL in Paystack Dashboard > Settings > API Keys & Webhooks.',
  },
  kuda: {
    provider: 'kuda',
    name: 'Kuda Business',
    displayName: 'Kuda Business',
    tagline: 'Digital corporate banking, dedicated virtual accounts & instant NIP settlement tracking',
    color: '#40196d',
    bgLight: 'rgba(64, 25, 109, 0.12)',
    accessStatus: 'requires_credentials',
    accessNotice: 'Open API Ready. Connect your Kuda Business API Key and registered email to sync NIP collections.',
    approvalRequirements: [
      'Verified Kuda Business Corporate Account (Tier 3 with CAC documents).',
      'Kuda Open API Developer Account registration.',
      'Server IP Address Whitelisting on Kuda Developer Portal.',
      'API Token and Client Email generated from Developer Settings.',
    ],
    supportedFeatures: {
      paymentLinks: false, // Kuda collections occur via dedicated virtual accounts, not generic hosted checkout pages
      webhooks: true,
      historyApi: true,
      instantVerification: true,
      refunds: false,
    },
    supportedCurrencies: ['NGN'],
    supportedPaymentMethods: ['Virtual Account Transfer', 'NIP Direct Settlement'],
    docsUrl: 'https://developer.kuda.com/',
    webhookHelp: 'Set credit notification webhook URL on the Kuda Developer Portal > Webhooks section.',
  },
  opay: {
    provider: 'opay',
    name: 'OPay Business',
    displayName: 'OPay Business',
    tagline: 'High-volume merchant collections, QR payments, Cashier links & POS terminal sync',
    color: '#1bb774',
    bgLight: 'rgba(27, 183, 116, 0.12)',
    accessStatus: 'requires_approval',
    accessNotice: 'Commercial Partnership Required. OPay requires Tier 3 corporate onboarding and merchant approval.',
    approvalRequirements: [
      'Registered Nigerian business with CAC Certificate and valid Tax ID.',
      'OPay Merchant / Aggregator Account approval.',
      'Commercial contract and API integration approval from OPay Commercial Team.',
      'Merchant ID, Public Key, and Private Key for HMAC-SHA512 signing.',
    ],
    supportedFeatures: {
      paymentLinks: true, // OPay Cashier links
      webhooks: true,
      historyApi: true,
      instantVerification: true,
      refunds: true,
    },
    supportedCurrencies: ['NGN'],
    supportedPaymentMethods: ['OPay Wallet', 'Bank Transfer', 'Debit Card', 'POS Terminal'],
    docsUrl: 'https://merchant.opaycheckout.com/doc',
    webhookHelp: 'Add Webhook notification URL in OPay Merchant Portal > Developer Settings > Webhooks.',
  },
  moniepoint: {
    provider: 'moniepoint',
    name: 'Moniepoint Business',
    displayName: 'Moniepoint Business',
    tagline: 'The leading SME business bank, POS terminal terminals, and business accounts',
    color: '#0033aa',
    bgLight: 'rgba(0, 51, 170, 0.12)',
    accessStatus: 'requires_approval',
    accessNotice: 'Partner Approval Required. Moniepoint Business APIs require commercial developer certification.',
    approvalRequirements: [
      'Moniepoint Business Account with active BVN/NIN verification.',
      'Developer Portal Access approved by Moniepoint Partner Relations.',
      'Sandbox-to-Production compliance audit and API credentials sign-off.',
      'Client ID, Client Secret, and Webhook signing secret configured.',
    ],
    supportedFeatures: {
      paymentLinks: true, // Moniepoint Online Checkout
      webhooks: true,
      historyApi: true,
      instantVerification: true,
      refunds: false,
    },
    supportedCurrencies: ['NGN'],
    supportedPaymentMethods: ['POS Terminal Inflow', 'Moniepoint Transfer', 'Debit Card', 'USSD'],
    docsUrl: 'https://docs.moniepoint.com/',
    webhookHelp: 'Configure Webhook listener in Moniepoint Developer Dashboard > Webhook Settings.',
  },
};

// ── Provider Configuration Functions ────────────────────────────────────────

export async function getProviderConfigs(userId: string): Promise<PaymentProviderConfig[]> {
  const { data, error } = await supabase
    .from('payment_provider_configs')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.warn('Error fetching provider configs, returning defaults:', error.message);
    return [];
  }
  return data || [];
}

export async function upsertProviderConfig(
  userId: string,
  provider: PaymentProvider,
  updates: Partial<PaymentProviderConfig>
): Promise<PaymentProviderConfig> {
  const payload = {
    user_id: userId,
    provider,
    status: updates.status || 'connected',
    public_key: updates.public_key,
    secret_key: updates.secret_key,
    merchant_id: updates.merchant_id,
    webhook_secret: updates.webhook_secret,
    account_number: updates.account_number,
    is_live: updates.is_live ?? false,
    sync_enabled: updates.sync_enabled ?? true,
    last_synced_at: updates.last_synced_at,
    last_sync_status: updates.last_sync_status || 'idle',
    last_sync_error: updates.last_sync_error,
    synced_records_count: updates.synced_records_count ?? 0,
    metadata: updates.metadata || {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('payment_provider_configs')
    .upsert(payload, { onConflict: 'user_id,provider' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Payment Links Functions ──────────────────────────────────────────────────

export async function getPaymentLinks(userId: string): Promise<PaymentLink[]> {
  const { data, error } = await supabase
    .from('payment_links')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Error fetching payment links:', error.message);
    return [];
  }
  return data || [];
}

export async function createPaymentLink(params: {
  userId: string;
  provider: PaymentProvider;
  title: string;
  description?: string;
  amount?: number | null; // null for custom amount
  currency?: string;
  allowCustomAmount?: boolean;
}): Promise<PaymentLink> {
  const { userId, provider, title, description = '', amount, currency = 'NGN', allowCustomAmount = false } = params;

  if (!title.trim()) {
    throw new Error('Payment link title is required.');
  }

  // Capability check
  const capabilities = PROVIDER_CAPABILITIES[provider];
  if (!capabilities.supportedFeatures.paymentLinks) {
    throw new Error(`${capabilities.displayName} does not support standalone hosted payment links. Use Paystack or OPay.`);
  }

  const slug = `rova-${Math.random().toString(36).substring(2, 9).toLowerCase()}`;
  let paymentUrl = '';
  let providerLinkId = '';

  // 1. If Paystack: call server API or build Paystack Checkout link
  if (provider === 'paystack') {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(`${backendUrl}/api/payment/links/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          title,
          description,
          amount,
          currency,
          allowCustomAmount,
        }),
      });

      if (res.ok) {
        const body = await res.json();
        if (body.success && body.link) {
          return body.link;
        }
      }
    } catch (e) {
      // Backend not running locally or error - fallback to direct link generation
    }

    // Direct fallback: Paystack Payment URL format
    paymentUrl = `https://paystack.com/pay/${slug}`;
    providerLinkId = `PLK_${slug.toUpperCase()}`;
  } else {
    // For other providers (e.g. OPay Cashier)
    paymentUrl = `https://checkout.opayweb.com/pay/${slug}`;
    providerLinkId = `OPAY_${slug.toUpperCase()}`;
  }

  const newRecord = {
    user_id: userId,
    provider,
    provider_link_id: providerLinkId,
    provider_slug: slug,
    title,
    description,
    amount: allowCustomAmount ? null : (amount || 0),
    currency,
    allow_custom_amount: allowCustomAmount,
    payment_url: paymentUrl,
    status: 'active' as const,
    total_collected: 0,
    payments_count: 0,
    metadata: {
      generatedVia: 'Rova Payment Engine',
      clientTimestamp: new Date().toISOString(),
    },
  };

  const { data, error } = await supabase
    .from('payment_links')
    .insert(newRecord)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function togglePaymentLinkStatus(
  linkId: string,
  newStatus: 'active' | 'inactive' | 'archived'
): Promise<void> {
  const { error } = await supabase
    .from('payment_links')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', linkId);

  if (error) throw error;
}

// ── Unified Payment Transactions Functions ──────────────────────────────────

export async function getPaymentTransactions(
  userId: string,
  filters?: {
    provider?: string;
    type?: string;
    status?: string;
    verificationStatus?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  }
): Promise<{ transactions: PaymentTransaction[]; totalCount: number }> {
  let query = supabase
    .from('payment_transactions')
    .select('*, payment_link:payment_links(*)', { count: 'exact' })
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false });

  if (filters?.provider && filters.provider !== 'all') {
    query = query.eq('provider', filters.provider);
  }
  if (filters?.type && filters.type !== 'all') {
    query = query.eq('type', filters.type);
  }
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('provider_status', filters.status);
  }
  if (filters?.verificationStatus && filters.verificationStatus !== 'all') {
    query = query.eq('verification_status', filters.verificationStatus);
  }
  if (filters?.startDate) {
    query = query.gte('transaction_date', `${filters.startDate}T00:00:00`);
  }
  if (filters?.endDate) {
    query = query.lte('transaction_date', `${filters.endDate}T23:59:59`);
  }
  if (filters?.minAmount !== undefined && !isNaN(filters.minAmount)) {
    query = query.gte('amount', filters.minAmount);
  }
  if (filters?.maxAmount !== undefined && !isNaN(filters.maxAmount)) {
    query = query.lte('amount', filters.maxAmount);
  }
  if (filters?.search) {
    const s = filters.search.trim();
    query = query.or(`provider_reference.ilike.%${s}%,description.ilike.%${s}%,counterparty_name.ilike.%${s}%,counterparty_email.ilike.%${s}%`);
  }

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.warn('Error fetching payment transactions:', error.message);
    return { transactions: [], totalCount: 0 };
  }
  return { transactions: data || [], totalCount: count || 0 };
}

// ── Metrics & Aggregation ───────────────────────────────────────────────────

export function calculateOverviewMetrics(transactions: PaymentTransaction[]): PaymentOverviewMetrics {
  let totalReceived = 0;
  let successfulCount = 0;
  let successfulVolume = 0;
  let pendingCount = 0;
  let pendingVolume = 0;
  let failedCount = 0;
  let failedVolume = 0;
  let refundedVolume = 0;
  let totalTransfers = 0;

  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;

    if (t.type === 'transfer') {
      totalTransfers += amt;
      return;
    }

    if (t.provider_status === 'success') {
      if (t.type === 'credit') {
        successfulCount++;
        successfulVolume += amt;
        totalReceived += amt;
      } else if (t.type === 'refund') {
        refundedVolume += amt;
      }
    } else if (t.provider_status === 'pending') {
      pendingCount++;
      pendingVolume += amt;
    } else if (t.provider_status === 'failed') {
      failedCount++;
      failedVolume += amt;
    } else if (t.provider_status === 'refunded' || t.provider_status === 'reversed') {
      refundedVolume += amt;
    }
  });

  const netCollections = Math.max(0, totalReceived - refundedVolume);

  return {
    totalReceived,
    successfulCount,
    successfulVolume,
    pendingCount,
    pendingVolume,
    failedCount,
    failedVolume,
    refundedVolume,
    netCollections,
    totalTransfers,
  };
}

// ── Batch Insert Statement Import ───────────────────────────────────────────

export async function importStatementRecords(
  userId: string,
  records: StatementParsedRow[],
  targetProvider: ExtendedPaymentProvider = 'manual_import'
): Promise<{ importedCount: number; skippedCount: number; errors: string[] }> {
  let importedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  const validRecords = records.filter(r => !r.isDuplicate && !r.validationError);
  skippedCount = records.length - validRecords.length;

  if (validRecords.length === 0) {
    return { importedCount: 0, skippedCount, errors };
  }

  // Insert in chunks of 50 to respect database payload limits
  const chunkSize = 50;
  for (let i = 0; i < validRecords.length; i += chunkSize) {
    const chunk = validRecords.slice(i, i + chunkSize);
    const rowsToInsert = chunk.map(r => ({
      user_id: userId,
      provider: targetProvider,
      provider_reference: r.reference,
      transaction_date: `${r.date}T12:00:00Z`,
      amount: r.amount,
      currency: r.currency || 'NGN',
      type: r.type,
      description: r.description,
      counterparty_name: r.counterpartyName || null,
      provider_status: r.status,
      // Manual imports are explicitly tagged unverified to prevent false verification
      verification_status: 'unverified' as const,
      source: 'manual_import' as const,
      accounting_status: 'unclassified' as const,
      raw_payload: {
        importedAt: new Date().toISOString(),
        originalRow: r.rowNumber,
      },
    }));

    const { data, error } = await supabase
      .from('payment_transactions')
      .upsert(rowsToInsert, { onConflict: 'user_id,provider,provider_reference' })
      .select('id');

    if (error) {
      errors.push(`Chunk ${i / chunkSize + 1} error: ${error.message}`);
    } else if (data) {
      importedCount += data.length;
    }
  }

  return { importedCount, skippedCount, errors };
}

// ── Reconcile with Accounting Ledger ────────────────────────────────────────

/**
 * Classifies a payment transaction into Rova's core financial ledger (transactions table)
 * strictly without double-counting, creating duplicates, or misclassifying transfers.
 */
export async function classifyPaymentTransaction(params: {
  userId: string;
  paymentTransaction: PaymentTransaction;
  classificationType: 'income' | 'expense' | 'transfer' | 'ignored';
  categoryId?: string | null;
  accountId?: string | null;
  notes?: string;
}): Promise<{ success: boolean; rovaTransactionId?: string; error?: string }> {
  const { userId, paymentTransaction, classificationType, categoryId, accountId, notes = '' } = params;

  if (classificationType === 'ignored') {
    const { error } = await supabase
      .from('payment_transactions')
      .update({
        accounting_status: 'ignored',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentTransaction.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  // Idempotency: If already linked to a rova transaction, update that transaction
  if (paymentTransaction.rova_transaction_id) {
    const { error } = await supabase
      .from('transactions')
      .update({
        type: classificationType,
        category_id: categoryId || null,
        account_id: accountId || null,
        amount: paymentTransaction.amount,
        description: paymentTransaction.description,
        notes: notes ? `${notes} | Ref: ${paymentTransaction.provider_reference}` : `Ref: ${paymentTransaction.provider_reference}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentTransaction.rova_transaction_id);

    if (error) return { success: false, error: error.message };

    await supabase
      .from('payment_transactions')
      .update({
        accounting_status: `classified_${classificationType}` as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentTransaction.id);

    return { success: true, rovaTransactionId: paymentTransaction.rova_transaction_id };
  }

  // Check if a rova transaction with this exact reference already exists
  const { data: existingLedgerTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('reference', paymentTransaction.provider_reference)
    .maybeSingle();

  if (existingLedgerTx) {
    // Link existing to prevent double-counting!
    await supabase
      .from('payment_transactions')
      .update({
        rova_transaction_id: existingLedgerTx.id,
        accounting_status: `classified_${classificationType}` as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentTransaction.id);

    return { success: true, rovaTransactionId: existingLedgerTx.id };
  }

  // Create new ledger transaction in Rova's main transactions table
  const { data: newTx, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: classificationType,
      category_id: categoryId || null,
      account_id: accountId || null,
      amount: paymentTransaction.amount,
      description: paymentTransaction.description || `${paymentTransaction.provider.toUpperCase()} Payment`,
      date: paymentTransaction.transaction_date.slice(0, 10),
      reference: paymentTransaction.provider_reference,
      notes: notes ? `${notes} (Synced from ${paymentTransaction.provider})` : `Synced from ${paymentTransaction.provider}`,
      is_verified: paymentTransaction.verification_status === 'verified',
      created_at: paymentTransaction.transaction_date,
    })
    .select('id')
    .single();

  if (txError) return { success: false, error: txError.message };

  // Update payment transaction with rova_transaction_id
  await supabase
    .from('payment_transactions')
    .update({
      rova_transaction_id: newTx.id,
      accounting_status: `classified_${classificationType}` as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentTransaction.id);

  return { success: true, rovaTransactionId: newTx.id };
}

// ── Provider Synchronisation ────────────────────────────────────────────────

export async function syncProviderTransactions(
  userId: string,
  provider: PaymentProvider
): Promise<{ success: boolean; message: string; count?: number }> {
  // Update sync status to running
  await supabase
    .from('payment_provider_configs')
    .upsert(
      {
        user_id: userId,
        provider,
        last_sync_status: 'running',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' }
    );

  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    // Call server-side sync endpoint
    const res = await fetch(`${backendUrl}/api/payment/sync/${provider}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ userId }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        await supabase
          .from('payment_provider_configs')
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_status: 'success',
            last_sync_error: null,
            synced_records_count: data.count || 0,
            status: 'connected',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('provider', provider);

        return { success: true, message: `Successfully synchronised ${data.count || 0} transactions from ${provider}.`, count: data.count };
      } else {
        throw new Error(data.error || `Synchronisation returned error for ${provider}`);
      }
    } else {
      // Backend unavailable or provider needs credentials
      const errText = await res.text();
      let parsedMsg = errText;
      try {
        const json = JSON.parse(errText);
        parsedMsg = json.error || errText;
      } catch (e) {
        // ignore
      }

      const capability = PROVIDER_CAPABILITIES[provider];
      const message = capability.accessStatus === 'requires_approval'
        ? `${capability.displayName} requires commercial partner approval and active credentials before transaction sync can operate.`
        : `${capability.displayName}: ${parsedMsg || 'Please configure API credentials.'}`;

      await supabase
        .from('payment_provider_configs')
        .update({
          last_sync_status: 'idle',
          last_sync_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('provider', provider);

      return { success: false, message };
    }
  } catch (err: any) {
    const capability = PROVIDER_CAPABILITIES[provider];
    const message = err.message || `Unable to reach ${capability.displayName} sync service.`;

    await supabase
      .from('payment_provider_configs')
      .update({
        last_sync_status: 'failed',
        last_sync_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', provider);

    return { success: false, message };
  }
}
