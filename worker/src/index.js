import { fileURLToPath } from 'node:url';
import {
  WorkerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as silero from '@livekit/agents-plugin-silero';

import { config } from './config.js';
import { loadClientConfig } from './db.js';
import { postCallResult, detectLead } from './apiClient.js';
import { summariseTranscript } from './summarise.js';

/**
 * sitering-receptionist — LiveKit voice agent worker.
 *
 * Flow per inbound call:
 *   1. Dispatch rule (created during onboarding) routes the SIP call here and
 *      passes { client_id } in job metadata.
 *   2. We load that client's prompt settings (greeting, hours, emergency fwd)
 *      from PostgreSQL and build the agent instructions.
 *   3. A voice pipeline (Deepgram STT → OpenAI LLM → OpenAI TTS, Silero VAD)
 *      handles the conversation and we accumulate the transcript.
 *   4. On call end we summarise, detect if it's a lead, and POST everything to
 *      the SwaS API (/api/calls), which persists it and emails a lead alert.
 */
export default defineAgent({
  // Load the VAD model once per worker process for speed.
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx) => {
    // Dispatch metadata carries the client_id we injected at onboarding time.
    let clientId = null;
    try {
      const meta = JSON.parse(ctx.job?.metadata || '{}');
      clientId = meta.client_id || null;
    } catch {
      /* ignore malformed metadata */
    }

    // Load per-client configuration from Postgres.
    const client = clientId ? await loadClientConfig(clientId) : null;
    const businessName = client?.business_name || 'the business';
    const greeting =
      client?.ai_greeting || `Thanks for calling ${businessName}. How can I help you today?`;
    const emergencyNumber = client?.emergency_number || null;
    const businessHours = client?.business_hours
      ? JSON.stringify(client.business_hours)
      : 'standard business hours';

    const instructions = [
      `You are the friendly AI receptionist for ${businessName}, a UK trade contractor.`,
      `Business hours: ${businessHours}.`,
      emergencyNumber
        ? `If the caller has an emergency, offer to forward them to the emergency line ${emergencyNumber}.`
        : `If the caller has an emergency, take their details and mark it urgent.`,
      'Capture the caller\'s name, phone number, postcode, and the job they need.',
      'If they want a quote, booking, or callback, confirm the details clearly.',
      'Keep replies short and natural for a phone conversation. Speak in British English.',
    ].join(' ');

    await ctx.connect();

    // Identify the caller (SIP participant). Number arrives in attributes.
    const participant = await ctx.waitForParticipant();
    const callerNumber =
      participant?.attributes?.['sip.phoneNumber'] ||
      participant?.attributes?.['sip.from_number'] ||
      participant?.identity ||
      'unknown';

    // Build the voice pipeline.
    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad,
      stt: new deepgram.STT({ model: 'nova-3' }),
      llm: new openai.LLM({ model: 'gpt-4o-mini' }),
      tts: new openai.TTS({ voice: 'ash' }),
    });

    // Accumulate the transcript from both sides of the conversation.
    const lines = [];
    session.on('user_input_transcribed', (ev) => {
      if (ev?.isFinal && ev.transcript) lines.push(`Caller: ${ev.transcript}`);
    });
    session.on('conversation_item_added', (ev) => {
      const item = ev?.item;
      if (item?.role === 'assistant' && item.textContent) {
        lines.push(`AI: ${item.textContent}`);
      }
    });

    const startedAt = Date.now();

    const agent = new voice.Agent({ instructions });
    await session.start({ agent, room: ctx.room });

    // Open with the client's configured greeting.
    await session.say(greeting, { allowInterruptions: true });

    // When the room closes (caller hangs up), finalise and report the call.
    ctx.room.on('disconnected', async () => {
      try {
        const transcript = lines.join('\n');
        const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
        const summary = await summariseTranscript(transcript);
        const isLead = detectLead(`${summary}\n${transcript}`);

        await postCallResult({
          clientId,
          callerNumber,
          // recording_url is attached separately by the LiveKit egress webhook →
          // /api/calls, or pass one here if the worker manages egress itself.
          recordingUrl: null,
          transcript,
          summary,
          isLead,
          durationSeconds,
        });
        console.log(`[sitering-receptionist] call reported (lead=${isLead}) for client ${clientId}`);
      } catch (err) {
        console.error('[sitering-receptionist] failed to report call:', err.message);
      }
    });
  },
});

// Register the worker with LiveKit under the dispatched agent name.
cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: config.agentName,
  }),
);
