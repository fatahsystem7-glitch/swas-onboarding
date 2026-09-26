import { query } from './pool.js';

export async function createCall(data) {
  const {
    client_id,
    caller_number,
    recording_url = null,
    transcript = null,
    summary = null,
    is_lead = false,
    duration_seconds = null,
  } = data;

  const { rows } = await query(
    `INSERT INTO calls
       (client_id, caller_number, recording_url, transcript, summary, is_lead, duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [client_id, caller_number, recording_url, transcript, summary, is_lead, duration_seconds],
  );
  return rows[0];
}

export async function listCallsForClient(clientId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT id, caller_number, recording_url, transcript, summary, is_lead, duration_seconds, created_at
       FROM calls
      WHERE client_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [clientId, limit, offset],
  );
  return rows;
}

export async function getCallById(id) {
  const { rows } = await query('SELECT * FROM calls WHERE id = $1', [id]);
  return rows[0] || null;
}
