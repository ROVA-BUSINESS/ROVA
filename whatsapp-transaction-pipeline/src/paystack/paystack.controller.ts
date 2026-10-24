import { Request, Response } from 'express';
import { paystackService } from './paystack.service';
import { supabase } from '../config/supabase';

export class PaystackController {
  /**
   * POST /api/paystack/verify
   * Secure server-side payment verification
   */
  async verify(req: Request, res: Response) {
    try {
      let userId = (req as any).user?.id || req.body.userId;

      // If token provided in header, resolve user
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      }

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User must be authenticated' });
      }

      const { reference, planKey, serviceType, taxYear, filingType, businessName, consentGiven } = req.body;

      if (!reference) {
        return res.status(400).json({ success: false, error: 'Payment reference is required' });
      }

      const result = await paystackService.processVerifiedPayment({
        userId,
        reference,
        planKey,
        serviceType,
        taxYear,
        filingType,
        businessName,
        consentGiven,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('Error in PaystackController.verify:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  }

  /**
   * POST /api/paystack/webhook
   * Webhook endpoint with HMAC SHA512 signature verification
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-paystack-signature'] as string;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      if (signature) {
        const isValid = paystackService.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
          console.warn('❌ Invalid Paystack webhook signature');
          return res.status(400).send('Invalid signature');
        }
      }

      const event = req.body;
      if (!event || !event.event) {
        return res.status(400).send('Invalid webhook event payload');
      }

      // Always acknowledge immediately with 200
      res.status(200).send('Webhook received');

      // Process event in background
      try {
        await paystackService.processWebhookEvent(event);
      } catch (procErr: any) {
        console.error('Error processing webhook event asynchronously:', procErr.message);
      }
    } catch (err: any) {
      console.error('Error in Paystack webhook handler:', err);
      return res.status(500).send('Internal server error');
    }
  }

  /**
   * POST /api/paystack/cancel
   * Cancel subscription endpoint
   */
  async cancel(req: Request, res: Response) {
    try {
      let userId = (req as any).user?.id || req.body.userId;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      }

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User must be authenticated' });
      }

      const { subscriptionId } = req.body;
      if (!subscriptionId) {
        return res.status(400).json({ success: false, error: 'subscriptionId is required' });
      }

      const result = await paystackService.cancelSubscription(userId, subscriptionId);
      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('Error in PaystackController.cancel:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  }
}
