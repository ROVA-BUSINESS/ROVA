import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabase } from '../config/supabase';
import { Logger } from '../utils/logger';

export class FlowService {
  private privateKey: string = '';

  constructor() {
    this.initPrivateKey();
  }

  private initPrivateKey() {
    // 1. Try reading from environment variable (ideal for Render/Cloud)
    if (process.env.WHATSAPP_FLOW_PRIVATE_KEY) {
      this.privateKey = process.env.WHATSAPP_FLOW_PRIVATE_KEY.replace(/\\n/g, '\n').trim();
      Logger.info('🔑 Loaded Flow private key from WHATSAPP_FLOW_PRIVATE_KEY env');
      return;
    }

    // 2. Fallback to filesystem lookup
    const possiblePaths = [
      path.resolve(process.cwd(), 'keys/flow_private_key.pem'),
      path.resolve(process.cwd(), 'whatsapp-transaction-pipeline/keys/flow_private_key.pem'),
      path.resolve(__dirname, '../../keys/flow_private_key.pem'),
      path.resolve(__dirname, '../keys/flow_private_key.pem'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          this.privateKey = fs.readFileSync(p, 'utf8').trim();
          Logger.info(`🔑 Loaded Flow private key from ${p}`);
          return;
        } catch (e: any) {
          Logger.error(`Error reading key from ${p}: ${e.message}`);
        }
      }
    }

    Logger.error('❌ Flow private key not found in environment or filesystem');
  }

  /**
   * Decrypts the incoming Meta WhatsApp Flow payload.
   */
  decryptPayload(encryptedFlowDataB64: string, encryptedAesKeyB64: string, initialVectorB64: string) {
    if (!this.privateKey) {
      throw new Error('Flow private key not found');
    }

    // 1. Decrypt AES key with RSA private key (RSA-OAEP with SHA-256)
    const decryptedAesKey = crypto.privateDecrypt(
      {
        key: this.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encryptedAesKeyB64, 'base64')
    );

    // 2. Decrypt flow data with AES-128-GCM
    const flowDataBuffer = Buffer.from(encryptedFlowDataB64, 'base64');
    const iv = Buffer.from(initialVectorB64, 'base64');
    const authTag = flowDataBuffer.subarray(flowDataBuffer.length - 16);
    const encryptedData = flowDataBuffer.subarray(0, flowDataBuffer.length - 16);

    const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, iv);
    decipher.setAuthTag(authTag);
    const decryptedString = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]).toString('utf8');

    return {
      payload: JSON.parse(decryptedString),
      decryptedAesKey,
      iv,
    };
  }

  /**
   * Encrypts the response for Meta WhatsApp Flow.
   */
  encryptResponse(responseObj: any, decryptedAesKey: Buffer, iv: Buffer): string {
    const flippedIv = Buffer.alloc(iv.length);
    for (let i = 0; i < iv.length; i++) {
      flippedIv[i] = ~iv[i];
    }

    const cipher = crypto.createCipheriv('aes-128-gcm', decryptedAesKey, flippedIv);
    const responseString = JSON.stringify(responseObj);
    const encrypted = Buffer.concat([
      cipher.update(responseString, 'utf8'),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    return encrypted.toString('base64');
  }

  /**
   * Finds the user profile by phone number (or from flow_token).
   */
  async getUserByPhone(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const suffix = cleanPhone.slice(-10); // match last 10 digits

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, business_name, email, phone_number')
      .or(`phone_number.ilike.%${suffix}%,whatsapp_phone.ilike.%${suffix}%`)
      .limit(1)
      .maybeSingle();

    return profile;
  }

  /**
   * Compiles the live dashboard state from Supabase.
   */
  async getDashboardState(userId: string, businessName?: string) {
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch Today's Transactions
    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, type, description, date, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    let salesToday = 0;
    let expensesToday = 0;
    let paymentsIn = 0;
    let paymentsOut = 0;

    (txs || []).forEach((t: any) => {
      const isToday = t.date === today || (t.created_at && t.created_at.startsWith(today));
      if (t.type === 'income') {
        if (isToday) salesToday += Number(t.amount) || 0;
        paymentsIn += Number(t.amount) || 0;
      } else if (t.type === 'expense') {
        if (isToday) expensesToday += Number(t.amount) || 0;
        paymentsOut += Number(t.amount) || 0;
      }
    });

    const profitToday = salesToday - expensesToday;
    const balance = paymentsIn - paymentsOut;

    // 2. Fetch Inventory Items
    const { data: items } = await supabase
      .from('inventory_items')
      .select('id, name, quantity_on_hand, unit, unit_price')
      .eq('user_id', userId)
      .limit(10);

    const inventoryLines = (items && items.length > 0)
      ? items.map((i: any) => `• ${i.name}: ${i.quantity_on_hand} ${i.unit || 'units'}`).join('\n')
      : '• No inventory recorded yet';

    // 3. Recent activity from latest 3 transactions
    const recentLines = (txs && txs.length > 0)
      ? txs.slice(0, 3).map((t: any) => {
          const sign = t.type === 'income' ? '+' : '-';
          return `• ${sign}₦${Number(t.amount).toLocaleString()} — ${t.description || t.type}`;
        }).join('\n')
      : '• No transactions yet';

    return {
      business_name: businessName || 'ROVA Business',
      kpi_summary: `💰 Sales Today: ₦${salesToday.toLocaleString()}\n💸 Expenses Today: ₦${expensesToday.toLocaleString()}\n📈 Net Profit: ₦${profitToday.toLocaleString()}\n🏦 Cash Balance: ₦${balance.toLocaleString()}`,
      payments_summary: `📥 Total In: ₦${paymentsIn.toLocaleString()} | 📤 Total Out: ₦${paymentsOut.toLocaleString()}`,
      inventory_summary: inventoryLines,
      recent_activity: recentLines,
    };
  }

  /**
   * Fetches customer balances summary for the Sales screen.
   */
  async getCustomersSummary(userId: string) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, balance')
      .eq('user_id', userId)
      .limit(5);

    if (!customers || customers.length === 0) {
      return '• All customer balances are currently settled.';
    }

    return customers
      .map((c: any) => `• ${c.name}: Owes ₦${(Number(c.balance) || 0).toLocaleString()}`)
      .join('\n');
  }

  /**
   * Fetches products dropdown list for the Expenses & Inventory screen.
   */
  async getProductsList(userId: string) {
    const { data: items } = await supabase
      .from('inventory_items')
      .select('id, name, quantity_on_hand, unit')
      .eq('user_id', userId)
      .limit(20);

    if (!items || items.length === 0) {
      return [
        { id: 'general_stock', title: 'General Inventory', description: 'Default stock item' }
      ];
    }

    return items.map((item: any) => ({
      id: item.id,
      title: item.name,
      description: `In stock: ${item.quantity_on_hand} ${item.unit || 'units'}`
    }));
  }

  /**
   * Adjusts stock quantity for an inventory item.
   */
  async adjustStock(userId: string, productId: string, change: number) {
    const { data: item } = await supabase
      .from('inventory_items')
      .select('id, name, quantity_on_hand')
      .eq('user_id', userId)
      .eq('id', productId)
      .maybeSingle();

    if (item) {
      const newQty = Math.max(0, (item.quantity_on_hand || 0) + change);
      await supabase
        .from('inventory_items')
        .update({ quantity_on_hand: newQty })
        .eq('id', item.id);
      Logger.info(`Updated stock for ${item.name}: ${newQty} (change: ${change})`);
      return { name: item.name, newQty };
    }
    return null;
  }

  /**
   * Records a sale transaction and auto-updates inventory if matching product exists.
   */
  async recordSale(userId: string, productName: string, qty: number, pricePerUnit: number, customerName?: string, paymentStatus?: string) {
    const total = qty * pricePerUnit;
    const today = new Date().toISOString().split('T')[0];

    // 1. Record transaction in ROVA ledger
    const { data: tx, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: total,
        type: 'income',
        description: `Sale: ${qty}x ${productName}${customerName ? ` (${customerName})` : ''}`,
        date: today,
        ai_category: 'Sales',
        ai_confidence: 1.0,
        is_verified: true,
        notes: JSON.stringify({
          source: 'whatsapp_flow',
          product: productName,
          quantity: qty,
          price_per_unit: pricePerUnit,
          payment_status: paymentStatus || 'PAID_CASH',
          customer: customerName || null,
        }),
        tags: ['whatsapp', 'flow', 'sale'],
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to insert sale transaction: ${error.message}`);
    }

    // 2. Reduce product inventory if exists
    const { data: product } = await supabase
      .from('inventory_items')
      .select('id, quantity_on_hand')
      .eq('user_id', userId)
      .ilike('name', productName.trim())
      .maybeSingle();

    if (product) {
      const newQty = Math.max(0, (product.quantity_on_hand || 0) - qty);
      await supabase
        .from('inventory_items')
        .update({ quantity_on_hand: newQty })
        .eq('id', product.id);
    }

    return { txId: tx.id, total };
  }

  /**
   * Records an expense transaction.
   */
  async recordExpense(userId: string, title: string, amount: number, category: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data: tx, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount,
        type: 'expense',
        description: title,
        date: today,
        ai_category: category || 'General Expense',
        ai_confidence: 1.0,
        is_verified: true,
        notes: JSON.stringify({ source: 'whatsapp_flow', category }),
        tags: ['whatsapp', 'flow', 'expense', category.toLowerCase()],
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to insert expense: ${error.message}`);
    }

    return tx.id;
  }
}
