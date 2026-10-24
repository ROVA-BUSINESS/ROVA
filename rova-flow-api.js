import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Initialize Supabase Client using ROVA's service credentials
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ SUPABASE_URL or SUPABASE_KEY missing in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// Load WhatsApp Flow Private Key (RSA Private Key for Meta Flow decryption)
let flowPrivateKey = '';
if (process.env.WHATSAPP_FLOW_PRIVATE_KEY) {
  flowPrivateKey = process.env.WHATSAPP_FLOW_PRIVATE_KEY.replace(/\\n/g, '\n').trim();
} else {
  const possiblePaths = [
    path.resolve(process.cwd(), 'keys/flow_private_key.pem'),
    path.resolve(process.cwd(), 'whatsapp-transaction-pipeline/keys/flow_private_key.pem'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        flowPrivateKey = fs.readFileSync(p, 'utf8').trim();
        break;
      } catch (e) {
        console.error(`Error reading key from ${p}:`, e.message);
      }
    }
  }
}

/**
 * Decrypts Meta WhatsApp Flow encrypted request
 */
function decryptFlowPayload(encryptedFlowDataB64, encryptedAesKeyB64, initialVectorB64) {
  if (!flowPrivateKey) {
    throw new Error('Flow RSA private key is not configured.');
  }

  // 1. Decrypt AES Key using RSA-OAEP SHA256
  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: flowPrivateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encryptedAesKeyB64, 'base64')
  );

  // 2. Decrypt Flow Data using AES-128-GCM
  const flowDataBuffer = Buffer.from(encryptedFlowDataB64, 'base64');
  const iv = Buffer.from(initialVectorB64, 'base64');
  const authTag = flowDataBuffer.subarray(flowDataBuffer.length - 16);
  const cipherText = flowDataBuffer.subarray(0, flowDataBuffer.length - 16);

  const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);

  return {
    payload: JSON.parse(decrypted.toString('utf8')),
    decryptedAesKey,
    iv,
  };
}

/**
 * Encrypts WhatsApp Flow response back to Meta
 */
function encryptFlowResponse(responseObj, decryptedAesKey, iv) {
  // Flip IV bits as required by WhatsApp Flow Encryption protocol
  const flippedIv = Buffer.alloc(iv.length);
  for (let i = 0; i < iv.length; i++) {
    flippedIv[i] = ~iv[i];
  }

  const cipher = crypto.createCipheriv('aes-128-gcm', decryptedAesKey, flippedIv);
  const payloadString = JSON.stringify(responseObj);
  const encrypted = Buffer.concat([
    cipher.update(payloadString, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return encrypted.toString('base64');
}

/**
 * Resolves user from phone number or flow token
 */
export async function getUserByPhone(phoneOrToken) {
  if (!phoneOrToken) return null;
  const match = phoneOrToken.match(/(\d{10,14})/);
  const rawNumber = match ? match[1] : phoneOrToken.replace(/\D/g, '');
  const suffix = rawNumber.slice(-10);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, business_name, email, phone_number, whatsapp_phone')
    .or(`phone_number.ilike.%${suffix}%,whatsapp_phone.ilike.%${suffix}%`)
    .limit(1)
    .maybeSingle();

  return profile;
}

/**
 * Computes live dashboard state from ROVA database.
 * Synced live across WhatsApp and Website!
 */
export async function getDashboardState(userId, businessNameFallback = 'ROVA Business') {
  const today = new Date().toISOString().split('T')[0];

  // 1. Fetch transactions for user
  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, type, description, date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  let salesToday = 0;
  let expensesToday = 0;
  let totalIn = 0;
  let totalOut = 0;

  (txs || []).forEach((t) => {
    const amt = Number(t.amount) || 0;
    const isToday = t.date === today || (t.created_at && t.created_at.startsWith(today));

    if (t.type === 'income') {
      if (isToday) salesToday += amt;
      totalIn += amt;
    } else if (t.type === 'expense') {
      if (isToday) expensesToday += amt;
      totalOut += amt;
    }
  });

  const netProfit = salesToday - expensesToday;
  const cashBalance = totalIn - totalOut;

  // 2. Fetch inventory items
  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, name, quantity_on_hand, unit')
    .eq('user_id', userId)
    .limit(10);

  const products = (items || []).map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity_on_hand,
    unit: i.unit || 'units',
  }));

  const inventorySummary = products.length > 0
    ? products.map((p) => `${p.name}: ${p.quantity} ${p.unit}`).join(', ')
    : 'Rice: 25 bags';

  // 3. Recent activity from latest 3 transactions
  const recent = (txs || []).slice(0, 3).map((t) => {
    const sign = t.type === 'income' ? '+' : '-';
    return `• ${sign}₦${Number(t.amount || 0).toLocaleString()} ${t.description || t.type}`;
  });

  const recentActivity = recent.length > 0
    ? recent.join('\n')
    : '• No transactions recorded yet today';

  // Fetch business profile name if not passed
  let businessName = businessNameFallback;
  if (!businessName || businessName === 'ROVA Business') {
    const { data: prof } = await supabase
      .from('profiles')
      .select('business_name')
      .eq('id', userId)
      .maybeSingle();
    if (prof?.business_name) businessName = prof.business_name;
  }

  return {
    sales_today: salesToday.toLocaleString(),
    expenses_today: expensesToday.toLocaleString(),
    net_profit: netProfit.toLocaleString(),
    cash_balance: cashBalance.toLocaleString(),
    total_in: totalIn.toLocaleString(),
    total_out: totalOut.toLocaleString(),
    // Raw numeric values for external calculators / API consumers
    raw_sales_today: salesToday,
    raw_expenses_today: expensesToday,
    raw_net_profit: netProfit,
    raw_cash_balance: cashBalance,
    raw_total_in: totalIn,
    raw_total_out: totalOut,
    products,
    recent,
    inventory_summary: inventorySummary,
    recent_activity: recentActivity,
    business_name: businessName || 'ROVA Business',
  };
}

// ─── ACTION HANDLERS ─────────────────────────────────────────────────────────

/**
 * 1. adjust_stock: adjusts stock level for an inventory item (+/- delta)
 */
async function handleAdjustStock(userId, params) {
  const productName = params.product_name || params.item || 'Rice';
  const delta = Number(params.delta) || 0;

  // Find item
  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, name, quantity_on_hand')
    .eq('user_id', userId)
    .ilike('name', `%${productName}%`)
    .limit(1)
    .maybeSingle();

  if (item) {
    const newQty = Math.max(0, (Number(item.quantity_on_hand) || 0) + delta);
    await supabase
      .from('inventory_items')
      .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
      .eq('id', item.id);
  } else {
    // Create new stock entry if not existing
    await supabase.from('inventory_items').insert({
      user_id: userId,
      name: productName,
      quantity_on_hand: Math.max(0, 25 + delta),
      unit: 'bags',
    });
  }
}

/**
 * 2. record_sale: records sale transaction, updates customer debt if 'owe', reduces stock
 */
async function handleRecordSale(userId, params) {
  const customer = params.customer || 'Walk-in Customer';
  const amount = Number(params.amount) || 0;
  const paymentType = params.payment_type || 'cash';
  const items = params.items || 'General Goods';
  const today = new Date().toISOString().split('T')[0];

  // A. Save income transaction
  await supabase.from('transactions').insert({
    user_id: userId,
    amount: amount,
    type: 'income',
    description: `Sale of ${items} to ${customer} (${paymentType})`,
    date: today,
    ai_category: 'Sales',
    ai_confidence: 0.98,
    is_verified: true,
    notes: JSON.stringify({
      channel: 'whatsapp_flow',
      customer,
      items,
      payment_type: paymentType,
      provider: 'manual',
    }),
    tags: ['whatsapp', 'flow', 'sale', paymentType],
  });

  // B. If customer owes, track in customers table
  if (paymentType === 'owe') {
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, balance')
      .eq('user_id', userId)
      .ilike('name', customer.trim())
      .limit(1)
      .maybeSingle();

    if (existingCustomer) {
      await supabase
        .from('customers')
        .update({ balance: (Number(existingCustomer.balance) || 0) + amount })
        .eq('id', existingCustomer.id);
    } else {
      await supabase.from('customers').insert({
        user_id: userId,
        name: customer.trim(),
        balance: amount,
        status: 'active',
      });
    }
  }

  // C. Automatically reduce stock if item matches
  const match = items.match(/(\d+)\s*(?:bags?|units?|pcs?|bottles?)?\s*(?:of\s*)?([a-zA-Z\s]+)/i);
  const qtyToDeduct = match ? Number(match[1]) : 1;
  const itemName = match ? match[2].trim() : items.trim();

  const { data: stockItem } = await supabase
    .from('inventory_items')
    .select('id, quantity_on_hand')
    .eq('user_id', userId)
    .ilike('name', `%${itemName}%`)
    .limit(1)
    .maybeSingle();

  if (stockItem) {
    const currentQty = Number(stockItem.quantity_on_hand) || 0;
    await supabase
      .from('inventory_items')
      .update({ quantity_on_hand: Math.max(0, currentQty - qtyToDeduct) })
      .eq('id', stockItem.id);
  }
}

/**
 * 3. record_expense: records expense in transactions and handles optional stock addition
 */
async function handleRecordExpense(userId, params) {
  const expenseTitle = params.expense_title || 'General Expense';
  const expenseAmount = Number(params.expense_amount) || 0;
  const today = new Date().toISOString().split('T')[0];

  if (expenseAmount > 0) {
    await supabase.from('transactions').insert({
      user_id: userId,
      amount: expenseAmount,
      type: 'expense',
      description: expenseTitle,
      date: today,
      ai_category: 'Operational Expense',
      ai_confidence: 0.95,
      is_verified: true,
      notes: JSON.stringify({ channel: 'whatsapp_flow', provider: 'manual' }),
      tags: ['whatsapp', 'flow', 'expense'],
    });
  }

  // If user also added stock in the same form
  if (params.stock_item && params.stock_quantity) {
    await handleAddStock(userId, {
      product_name: params.stock_item,
      quantity: params.stock_quantity,
    });
  }
}

/**
 * 4. add_stock: adds stock quantity to inventory
 */
async function handleAddStock(userId, params) {
  const productName = params.product_name || params.item || 'New Item';
  const qtyToAdd = Number(params.quantity || params.qty) || 1;

  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, quantity_on_hand')
    .eq('user_id', userId)
    .ilike('name', productName.trim())
    .limit(1)
    .maybeSingle();

  if (item) {
    await supabase
      .from('inventory_items')
      .update({ quantity_on_hand: (Number(item.quantity_on_hand) || 0) + qtyToAdd })
      .eq('id', item.id);
  } else {
    await supabase.from('inventory_items').insert({
      user_id: userId,
      name: productName.trim(),
      quantity_on_hand: qtyToAdd,
      unit: 'units',
    });
  }
}

/**
 * 5. record_payment: logs payment (Cash Balance & Total In/Out)
 */
async function handleRecordPayment(userId, params) {
  const amount = Number(params.amount) || 0;
  const direction = params.payment_type || 'in'; // 'in' or 'out'
  const description = params.description || `Payment ${direction === 'in' ? 'Received' : 'Sent'}`;
  const today = new Date().toISOString().split('T')[0];

  await supabase.from('transactions').insert({
    user_id: userId,
    amount: amount,
    type: direction === 'in' ? 'income' : 'expense',
    description,
    date: today,
    ai_category: 'Payment Settlement',
    is_verified: true,
    notes: JSON.stringify({
      channel: 'whatsapp_flow',
      provider: params.provider || 'manual', // Designed so Paystack/Moniepoint can be connected later
    }),
    tags: ['whatsapp', 'payment', direction],
  });
}

/**
 * 6. upload_doc: triggers OCR upload flow guidance
 */
async function handleUploadDoc(userId, params) {
  console.log(`📄 OCR Document scan requested for user: ${userId}`);
}

/**
 * 7. get_report: prepares report and dispatches to WhatsApp chat if user has phone
 */
async function handleGetReport(userId, params, userPhone) {
  const reportType = params.report_type || 'pnl_pdf';
  const period = params.report_period || 'today';
  console.log(`📊 Report requested: ${reportType} (${period}) for ${userId}`);

  // If user phone & token available, dispatch WhatsApp message
  const phoneId = process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

  if (userPhone && phoneId && token) {
    try {
      const state = await getDashboardState(userId);
      const text =
        `📊 *ROVA Financial Report (${period.toUpperCase()})*\n\n` +
        `• *Sales*: ₦${state.sales_today}\n` +
        `• *Expenses*: ₦${state.expenses_today}\n` +
        `• *Net Profit*: ₦${state.net_profit}\n` +
        `• *Cash Balance*: ₦${state.cash_balance}\n\n` +
        `🌐 Full P&L statement synced with your ROVA web dashboard at https://www.rovabusiness.com`;

      await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: userPhone,
          type: 'text',
          text: { body: text },
        }),
      });
    } catch (e) {
      console.error('Failed to send report WhatsApp text:', e.message);
    }
  }
}

// ─── EXPRESS ENDPOINT ────────────────────────────────────────────────────────

export const app = express();
app.use(express.json());

/**
 * Main Flow Endpoint: POST /api/whatsapp/flow
 * Seamlessly handles Meta's encrypted exchange AND direct JSON testing!
 */
app.post('/api/whatsapp/flow', async (req, res) => {
  try {
    let payload = req.body;
    let decryptedAesKey = null;
    let iv = null;
    let isEncrypted = false;

    // Check if request is encrypted by Meta Flow
    if (req.body.encrypted_flow_data && req.body.encrypted_aes_key && req.body.initial_vector) {
      isEncrypted = true;
      const decrypted = decryptFlowPayload(
        req.body.encrypted_flow_data,
        req.body.encrypted_aes_key,
        req.body.initial_vector
      );
      payload = decrypted.payload;
      decryptedAesKey = decrypted.decryptedAesKey;
      iv = decrypted.iv;
    }

    console.log(`📥 [ROVA Flow API] action="${payload.action || 'direct'}" screen="${payload.screen || ''}"`);

    // 1. Health check from Meta Flow Manager
    if (payload.action === 'ping') {
      const responsePayload = {
        version: '3.0',
        data: { status: 'active' },
      };
      if (isEncrypted) {
        return res.status(200).type('text/plain').send(encryptFlowResponse(responsePayload, decryptedAesKey, iv));
      }
      return res.status(200).json(responsePayload);
    }

    // Resolve user context from flow_token or phone
    const flowToken = payload.flow_token || '';
    const profile = await getUserByPhone(flowToken || req.body.phone_number);
    const userId = profile?.id || process.env.ROVA_DEFAULT_USER_ID || 'demo_user';
    const userPhone = profile?.phone_number || profile?.whatsapp_phone || '';

    // 2. Flow initialization when user taps "Open Dashboard"
    if (payload.action === 'INIT') {
      const dashboardState = await getDashboardState(userId, profile?.business_name);
      const responsePayload = {
        version: '3.0',
        screen: 'DASHBOARD',
        data: dashboardState,
      };

      if (isEncrypted) {
        return res.status(200).type('text/plain').send(encryptFlowResponse(responsePayload, decryptedAesKey, iv));
      }
      return res.status(200).json(responsePayload);
    }

    // 3. User interaction (data_exchange)
    const actionData = payload.data || payload;
    const requestedAction = actionData.action || payload.action;

    switch (requestedAction) {
      case 'open_section': {
        const targetScreen = actionData.target_section || 'DASHBOARD';
        console.log(`🧭 Navigating user ${userId} to screen: ${targetScreen}`);
        const state = await getDashboardState(userId, profile?.business_name);
        const navPayload = {
          version: '3.0',
          screen: targetScreen,
          data: state,
        };
        if (isEncrypted) {
          return res.status(200).type('text/plain').send(encryptFlowResponse(navPayload, decryptedAesKey, iv));
        }
        return res.status(200).json(navPayload);
      }

      case 'adjust_stock':
        await handleAdjustStock(userId, actionData);
        break;

      case 'record_sale':
        await handleRecordSale(userId, actionData);
        break;

      case 'record_expense':
        await handleRecordExpense(userId, actionData);
        break;

      case 'add_stock':
        await handleAddStock(userId, actionData);
        break;

      case 'record_payment':
        await handleRecordPayment(userId, actionData);
        break;

      case 'upload_doc':
        await handleUploadDoc(userId, actionData);
        break;

      case 'get_report':
        await handleGetReport(userId, actionData, userPhone);
        break;

      default:
        console.log(`ℹ️ Default or unhandled action "${requestedAction}". Returning refreshed dashboard.`);
        break;
    }

    // CRITICAL REQUIREMENT:
    // After each action, call getDashboardState(userId) and return { data: newState }
    // Returning screen: "DASHBOARD" causes the Flow to immediately re-render with updated values!
    const newState = await getDashboardState(userId, profile?.business_name);

    const responsePayload = {
      version: '3.0',
      screen: 'DASHBOARD',
      data: newState,
    };

    if (isEncrypted) {
      const encryptedResponse = encryptFlowResponse(responsePayload, decryptedAesKey, iv);
      return res.status(200).type('text/plain').send(encryptedResponse);
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('💥 Error in /api/whatsapp/flow:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// Run server when called directly
const PORT = process.env.PORT || 3000;
if (process.argv[1] && process.argv[1].endsWith('rova-flow-api.js')) {
  app.listen(PORT, () => {
    console.log(`🚀 ROVA WhatsApp Flow API listening on port ${PORT}`);
    console.log(`   Endpoint: POST http://localhost:${PORT}/api/whatsapp/flow`);
  });
}

export default app;
