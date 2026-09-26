# sitering-receptionist (LiveKit agent worker)

The AI voice agent that answers inbound calls provisioned by the SwaS onboarding
engine. It's a **separate process** from the API service — deploy it as its own
Railway service (or any always-on host) pointing at the same LiveKit project and
PostgreSQL database.

## How it fits together

```
Caller ──PSTN──► Telnyx ──SIP──► LiveKit Cloud
                                   │  (dispatch rule created at onboarding,
                                   │   metadata = { client_id })
                                   ▼
                        sitering-receptionist worker
                         1. load client config from Postgres (by client_id)
                         2. Deepgram STT → OpenAI LLM → OpenAI TTS voice loop
                         3. on hangup: summarise + detect lead
                         4. POST /api/calls on the SwaS API
```

## Run locally

```bash
cd worker
cp .env.example .env      # fill in LiveKit + Deepgram + OpenAI + DATABASE_URL
npm install
npm run dev               # connects to LiveKit and waits for dispatched calls
```

The worker registers under `AGENT_NAME` (default `sitering-receptionist`) — this
**must** match the `agentName` used in the dispatch rule the API creates in
`src/services/livekit.service.js`.

## Recording

Two supported patterns:

1. **LiveKit Egress (recommended):** enable room/track egress to S3 in your
   LiveKit project; its completion webhook (or your egress handler) POSTs the
   resulting `recording_url` to `/api/calls`.
2. **Worker-managed:** start egress via `livekit-server-sdk`'s `EgressClient`
   inside `entry()` and include the resulting URL in `postCallResult(...)`.

## Notes

- This is a reference implementation of the LiveKit Agents v1.x voice pipeline.
  Swap STT/LLM/TTS providers/models to taste (plugins for Cartesia, ElevenLabs,
  etc. are available).
- Lead detection here is a keyword heuristic (`detectLead`); replace it with your
  LLM's structured output for production.
- Requires provider API keys — without them the pipeline can't run (unlike the API
  service, which has a full mock mode).

## Install note

`@livekit/agents-plugin-silero` depends on `onnxruntime-node`, whose postinstall
downloads a native runtime (~hundreds of MB). On low-memory build environments this
can be OOM-killed. If `npm install` fails on `onnxruntime-node`, install on a host
with more memory, or swap Silero VAD for a server-side VAD / turn-detection option.

