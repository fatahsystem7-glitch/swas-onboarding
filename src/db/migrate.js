import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool } from './pool.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = join(__dirname, '..', '..', 'db', 'schema.sql');
  const sql = await readFile(schemaPath, 'utf8');
  const pool = getPool();
  logger.info('Running migrations…', { schemaPath });
  await pool.query(sql);
  logger.info('Migrations applied successfully.');
  await pool.end();
}

migrate().catch((err) => {
  logger.error('Migration failed', { error: err.message });
  process.exit(1);
});
