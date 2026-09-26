import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { resolve } from 'node:path';

import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { healthcheck } from './db/pool.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

import onboardRouter from './routes/onboard.js';
import webhooksRouter from './routes/webhooks.js';
import clientsRouter from './routes/clients.js';
import callsRouter from './routes/calls.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('tiny'));

// IMPORTANT: Telnyx webhook signature verification needs the RAW body, so we
// mount the raw parser on that path BEFORE the global json parser.
app.use('/api/webhooks/telnyx', express.raw({ type: '*/*', limit: '2mb' }));

// JSON + urlencoded parsers for everything else.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve locally-stored recordings (fallback when S3 isn't configured).
app.use('/recordings', express.static(resolve(env.storage.localDir)));

// Health endpoints.
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'swas-onboarding' }));
app.get('/health/db', async (_req, res) => {
  const ok = await healthcheck();
  res.status(ok ? 200 : 503).json({ database: ok ? 'ok' : 'unavailable' });
});

// API routes.
app.use('/api', onboardRouter);
app.use('/api', clientsRouter);
app.use('/api', callsRouter);
app.use('/api/webhooks', webhooksRouter);

// 404 + error handling.
app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, '0.0.0.0', () => {
  logger.info('server.listening', {
    port: env.port,
    env: env.nodeEnv,
    mockProviders: env.mockProviders,
    livekitUrl: env.livekit.url,
  });
});

// Graceful shutdown.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    logger.info('server.shutdown', { signal: sig });
    server.close(() => process.exit(0));
  });
}

export default app;
