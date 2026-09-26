import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

let pool = null;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 4,
    });
  }
  return pool;
}

/**
 * Load a client's prompt/config so the agent can personalise the call.
 * Called at the start of every job using the client_id from dispatch metadata.
 */
export async function loadClientConfig(clientId) {
  const { rows } = await getPool().query(
    `SELECT id, business_name, ai_greeting, business_hours, emergency_number, telnyx_number, status
       FROM clients WHERE id = $1`,
    [clientId],
  );
  return rows[0] || null;
}
