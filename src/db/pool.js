import pg from 'pg';
import { env, isProd } from '../config/env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (pool) return pool;

  if (!env.databaseUrl) {
    logger.warn('DATABASE_URL is not set — database features will fail until configured.');
  }

  pool = new Pool({
    connectionString: env.databaseUrl,
    // Railway managed Postgres requires SSL in production.
    ssl: isProd() ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected PG pool error', { error: err.message });
  });

  return pool;
}

export async function query(text, params) {
  const p = getPool();
  const start = Date.now();
  const res = await p.query(text, params);
  logger.debug('db.query', { ms: Date.now() - start, rows: res.rowCount });
  return res;
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function healthcheck() {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
