import crypto from 'crypto';
import dotenv from 'dotenv';
import { getDashboardState, getUserByPhone } from './rova-flow-api.js';

dotenv.config();

/**
 * Sends the ROVA Interactive WhatsApp Flow (Mini Business Management App)
 *
 * @param {string} recipientPhone - Phone number in international format without + (e.g. "2348012345678")
 * @param {string} customUserId - Optional specific Supabase user_id
 */
export async function sendDashboardFlow(recipientPhone, customUserId = null) {
  const phoneId = process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  // Use user's Flow ID (ROVA Business Hub)
  const flowId = process.env.WHATSAPP_BUSINESS_HUB_FLOW_ID || process.env.WHATSAPP_FLOW_ID || '2497408190738308';

  if (!phoneId || !token) {
    throw new Error('Missing PHONE_NUMBER_ID or WHATSAPP_TOKEN in .env file.');
  }

  // Clean phone number
  const cleanPhone = recipientPhone.replace(/\D/g, '');

  // Resolve user profile from Supabase
  let userId = customUserId;
  let businessName = 'ROVA Business';

  if (!userId) {
    const profile = await getUserByPhone(cleanPhone);
    if (profile) {
      userId = profile.id;
      businessName = profile.business_name || 'ROVA Business';
    } else {
      userId = process.env.ROVA_DEFAULT_USER_ID || 'demo_user';
    }
  }

  // Get current live dashboard state
  const dashboardState = await getDashboardState(userId, businessName);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'interactive',
    interactive: {
      type: 'flow',
      header: {
        type: 'text',
        text: 'ROVA Business OS 🚀',
      },
      body: {
        text: `Manage ${businessName} directly inside WhatsApp.\nTrack sales, expenses, inventory, and generate P&L reports live.`,
      },
      footer: {
        text: 'Powered by ROVA AI',
      },
      action: {
        name: 'flow',
        parameters: {
          mode: process.env.WHATSAPP_FLOW_MODE || 'draft',
          flow_message_version: '3',
          flow_token: `rova_${cleanPhone}_${Date.now()}`,
          flow_id: flowId,
          flow_cta: 'Open Dashboard',
          flow_action: 'navigate',
          flow_action_payload: {
            screen: 'DASHBOARD',
            data: {
              sales_today: String(dashboardState.sales_today || '0'),
              expenses_today: String(dashboardState.expenses_today || '0'),
              net_profit: String(dashboardState.net_profit || '0'),
              cash_balance: String(dashboardState.cash_balance || '0'),
              total_in: String(dashboardState.total_in || '0'),
              total_out: String(dashboardState.total_out || '0'),
            },
          },
        },
      },
    },
  };

  console.log(`📤 Sending ROVA Dashboard Flow to ${cleanPhone} (Flow ID: ${flowId})...`);

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (response.ok) {
    console.log(`✅ Flow successfully sent to ${cleanPhone}! Message ID:`, result.messages?.[0]?.id);
  } else {
    console.error(`❌ Meta API Error:`, JSON.stringify(result, null, 2));
  }

  return result;
}

// Standalone execution: node send-dashboard-flow.js 2348012345678
if (process.argv[1] && process.argv[1].endsWith('send-dashboard-flow.js')) {
  const targetPhone = process.argv[2] || process.env.TEST_PHONE || '2349132957881';
  sendDashboardFlow(targetPhone).catch(console.error);
}
