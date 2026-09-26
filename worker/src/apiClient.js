import { config } from './config.js';

/**
 * POST a completed call's recording/transcript/summary back to the SwaS API,
 * which persists it to the `calls` table and fires a lead-alert email if needed.
 */
export async function postCallResult({
  clientId,
  callerNumber,
  recordingUrl,
  transcript,
  summary,
  isLead,
  durationSeconds,
}) {
  const headers = { 'content-type': 'application/json' };
  if (config.internalApiToken) headers.authorization = `Bearer ${config.internalApiToken}`;

  const res = await fetch(`${config.apiBaseUrl}/api/calls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      client_id: clientId,
      caller_number: callerNumber,
      recording_url: recordingUrl || null,
      transcript: transcript || null,
      summary: summary || null,
      is_lead: Boolean(isLead),
      duration_seconds: durationSeconds ?? null,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`POST /api/calls failed (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * Very small heuristic to flag actionable leads from the transcript/summary.
 * Replace with your LLM's structured output in production.
 */
export function detectLead(text = '') {
  const t = text.toLowerCase();
  const signals = ['book', 'quote', 'appointment', 'call me back', 'callback', 'emergency', 'leak', 'broken', 'estimate', 'visit'];
  return signals.some((s) => t.includes(s));
}
