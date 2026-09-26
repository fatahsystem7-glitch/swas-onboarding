import { config } from './config.js';

/**
 * Produce a short AI summary of the call transcript using OpenAI.
 * Falls back to a naive summary if no key is configured, so the worker still
 * runs in development.
 */
export async function summariseTranscript(transcript) {
  if (!transcript || !transcript.trim()) return '';

  if (!config.openaiApiKey) {
    // Dev fallback: first ~200 chars.
    return transcript.trim().slice(0, 200);
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You summarise phone calls for a UK trade contractor. In 2-3 sentences capture: caller intent, location/postcode if given, urgency, and any callback/booking request. Be concise and factual.',
        },
        { role: 'user', content: transcript.slice(0, 8000) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI summary failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || '';
}
