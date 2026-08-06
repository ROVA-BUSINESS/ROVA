import express from 'express';
import { env } from './config/env';
import webhookRoutes from './webhook/webhook.routes';
import { TransactionWorker } from './jobs/transaction.worker';

// ── Global crash guards (prevent unhandled rejections from killing the process) ──
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

const app = express();

// ── Health check FIRST — before any middleware so it always responds ──
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Parse JSON bodies, attaching raw body for signature verification
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Register routes
app.use('/webhook', webhookRoutes);

// Start the BullMQ worker — isolated so crashes don't affect the HTTP server
try {
  const worker = new TransactionWorker();
  worker.start();
} catch (err: any) {
  console.error('⚠️  Worker failed to start (HTTP server still running):', err.message);
}

// Bind to 0.0.0.0 so Render's health checker can reach the container
app.listen(Number(env.PORT), '0.0.0.0', () => {
  console.log(`🚀 ROVA WhatsApp Transaction Pipeline running on port ${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
});
