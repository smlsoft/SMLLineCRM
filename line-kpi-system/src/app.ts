import './config'; // load dotenv first
import express, { Request, Response, NextFunction } from 'express';
import { connectDatabase } from './config/database';
import { masterIdCache } from './services/MasterIdCache';
import { oaRegistry } from './services/OaRegistry';
import { groupRegistry } from './services/GroupRegistry';
import { webhookRouter } from './webhook/router';
import { apiRouter } from './api/router';
import { startScheduler } from './jobs/scheduler';
import { config } from './config';

const app = express();

// Parse raw body for LINE signature verification BEFORE JSON parsing
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);

// Health check (no auth)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    masterIdCacheSize: masterIdCache.size,
    oaRegistrySize: oaRegistry.size,
    groupRegistrySize: groupRegistry.size,
    timestamp: new Date().toISOString(),
  });
});

// LINE webhook routes (signature-verified, no API key auth)
app.use('/webhook', webhookRouter);

// Management API routes (API key auth applied inside router)
app.use('/api/v1', apiRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[App] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function bootstrap(): Promise<void> {
  await connectDatabase();

  // Warm up all caches before accepting traffic
  await Promise.all([
    masterIdCache.initialize(),
    oaRegistry.initialize(),
    groupRegistry.initialize(),
  ]);

  startScheduler();

  app.listen(config.port, () => {
    console.log(`[App] LINE KPI System running on port ${config.port}`);
    console.log(`[App] Webhook base: POST /webhook/:channelId`);
    console.log(`[App] API base:     /api/v1  (X-API-Key required)`);
  });
}

bootstrap().catch((err) => {
  console.error('[App] Fatal startup error:', err);
  process.exit(1);
});
