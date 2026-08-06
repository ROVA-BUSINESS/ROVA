import express from 'express';
import { env } from './config/env';
import webhookRoutes from './webhook/webhook.routes';
import { TransactionWorker } from './jobs/transaction.worker';

const app = express();

// Parse JSON bodies, but we also need the raw body for signature verification.
// We'll use a middleware to attach rawBody to the request object.
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register routes
app.use('/webhook', webhookRoutes);

// Start the BullMQ worker in the same process (can be split to a separate process in production)
const worker = new TransactionWorker();
worker.start();

app.listen(env.PORT, () => {
  console.log(`🚀 ROVA WhatsApp Transaction Pipeline running on port ${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
});
