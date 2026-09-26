import { query } from './pool.js';

// Records a provider event. Returns { inserted: boolean } — inserted=false means
// the event was a duplicate (idempotency guard).
export async function recordEvent({ provider, event_type, external_id, payload }) {
  const { rows } = await query(
    `INSERT INTO provider_events (provider, event_type, external_id, payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [provider, event_type || null, external_id || null, payload ? JSON.stringify(payload) : null],
  );
  return { inserted: rows.length > 0, id: rows[0]?.id };
}
