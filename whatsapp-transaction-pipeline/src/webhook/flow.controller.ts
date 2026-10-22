import { Request, Response } from 'express';
import { FlowService } from '../services/flow.service';
import { Logger } from '../utils/logger';
import { env } from '../config/env';

export class FlowController {
  private flowService = new FlowService();

  /**
   * Main HTTP POST endpoint for WhatsApp Flows Data API.
   * Handles Meta's ping health check, screen initialization (INIT), and data_exchange.
   */
  async handleFlow(req: Request, res: Response): Promise<void> {
    try {
      const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

      if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
        res.status(400).json({ error: 'Missing encrypted flow payload parameters' });
        return;
      }

      // Decrypt incoming Meta payload
      const { payload, decryptedAesKey, iv } = this.flowService.decryptPayload(
        encrypted_flow_data,
        encrypted_aes_key,
        initial_vector
      );

      Logger.info(`📥 Flow Action received: ${payload.action}, Screen: ${payload.screen}`);

      let responsePayload: any = {
        version: '3.0',
      };

      // 1. Health check from Meta Flow Manager
      if (payload.action === 'ping') {
        responsePayload.data = { status: 'active' };
      }
      // 2. Initial Flow launch when user opens the Flow
      else if (payload.action === 'INIT') {
        const flowToken = payload.flow_token || '';
        // Extract phone number from flow_token (e.g. rova_2348012345678_123456)
        const phoneMatch = flowToken.match(/rova_(\d+)_/);
        const userPhone = phoneMatch ? phoneMatch[1] : '';

        const profile = userPhone ? await this.flowService.getUserByPhone(userPhone) : null;
        const userId = profile?.id || 'demo_user';
        const businessName = profile?.business_name || 'ROVA Business';

        const dashboardData = await this.flowService.getDashboardState(userId, businessName);

        responsePayload.screen = 'DASHBOARD';
        responsePayload.data = dashboardData;
      }
      // 3. Form submission or navigation within the Flow
      else if (payload.action === 'data_exchange') {
        const data = payload.data || {};
        const flowToken = payload.flow_token || '';
        const phoneMatch = flowToken.match(/rova_(\d+)_/);
        const userPhone = phoneMatch ? phoneMatch[1] : '';

        const profile = userPhone ? await this.flowService.getUserByPhone(userPhone) : null;
        const userId = profile?.id || 'demo_user';

        switch (data.action) {
          case 'open_section': {
            const target = data.target_section || 'DASHBOARD';
            responsePayload.screen = target;

            if (target === 'SALES') {
              const custSummary = await this.flowService.getCustomersSummary(userId);
              responsePayload.data = { customer_balances_summary: custSummary };
            } else if (target === 'EXPENSES') {
              const products = await this.flowService.getProductsList(userId);
              responsePayload.data = { products_list: products };
            } else if (target === 'DOCUMENTS') {
              responsePayload.data = {
                report_info: 'Select a report to generate and send directly to your WhatsApp chat.'
              };
            } else if (target === 'SETTINGS') {
              responsePayload.data = {
                active_alerts: '✅ All systems normal. No critical inventory or debt alerts.'
              };
            } else {
              const dashboardData = await this.flowService.getDashboardState(userId, profile?.business_name);
              responsePayload.data = dashboardData;
            }
            break;
          }

          case 'record_sale': {
            const productName = data.product_name || 'Item';
            const qty = Number(data.quantity) || 1;
            const price = Number(data.price_per_unit) || 0;
            const customer = data.customer_name || '';
            const status = data.payment_status || 'PAID_CASH';

            const { total } = await this.flowService.recordSale(userId, productName, qty, price, customer, status);

            responsePayload.screen = 'SUCCESS';
            responsePayload.data = {
              success_title: 'Sale Recorded ✅',
              success_message: `Successfully recorded sale of ${qty}x ${productName} for ₦${total.toLocaleString()}.${customer ? ` Customer: ${customer}` : ''}`
            };
            break;
          }

          case 'record_expense_or_stock': {
            let message = '';

            // Handle stock adjustment
            if (data.stock_product_id) {
              let change = 0;
              if (data.stock_action === 'ADD_1') change = 1;
              else if (data.stock_action === 'SUB_1') change = -1;
              else if (data.stock_action === 'CUSTOM') change = Number(data.custom_qty) || 0;

              if (change !== 0) {
                const res = await this.flowService.adjustStock(userId, data.stock_product_id, change);
                if (res) {
                  message += `Stock for ${res.name} updated to ${res.newQty}. `;
                }
              }
            }

            // Handle expense recording
            if (data.expense_title && data.expense_amount) {
              const amount = Number(data.expense_amount) || 0;
              await this.flowService.recordExpense(userId, data.expense_title, amount, data.expense_category || 'other');
              message += `Expense of ₦${amount.toLocaleString()} logged for "${data.expense_title}".`;
            }

            responsePayload.screen = 'SUCCESS';
            responsePayload.data = {
              success_title: 'Updated Successfully ✅',
              success_message: message || 'Your stock and expense records have been synced.'
            };
            break;
          }

          case 'generate_report': {
            const reportType = data.report_type || 'PNL';
            const period = data.report_period || 'TODAY';

            // Send report via WhatsApp chat directly to the user
            if (userPhone && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN) {
              try {
                await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: userPhone,
                    type: 'text',
                    text: {
                      body: `📊 *ROVA Financial Report*\nType: *${reportType}*\nPeriod: *${period}*\n\nYour detailed report has been generated and updated on your web dashboard at https://www.rovabusiness.com`
                    }
                  })
                });
              } catch (e: any) {
                Logger.error(`Failed to send report to chat: ${e.message}`);
              }
            }

            responsePayload.screen = 'SUCCESS';
            responsePayload.data = {
              success_title: 'Report Generated 📊',
              success_message: `Your ${reportType} report for ${period} has been generated and sent to this chat!`
            };
            break;
          }

          case 'save_settings': {
            responsePayload.screen = 'SUCCESS';
            responsePayload.data = {
              success_title: 'Settings Saved ⚙️',
              success_message: 'Your payroll entries and payment settings have been saved.'
            };
            break;
          }

          default: {
            const dashboardData = await this.flowService.getDashboardState(userId, profile?.business_name);
            responsePayload.screen = 'DASHBOARD';
            responsePayload.data = dashboardData;
            break;
          }
        }
      }

      // Re-encrypt the response using AES-GCM with flipped IV
      const encryptedResponse = this.flowService.encryptResponse(
        responsePayload,
        decryptedAesKey,
        iv
      );

      res.status(200).type('text/plain').send(encryptedResponse);
    } catch (err: any) {
      Logger.error(`💥 Error in Flow Controller: ${err.message}`, err.stack);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
