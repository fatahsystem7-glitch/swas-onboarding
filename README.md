# SwaS Automated Onboarding & Telephony Engine

A fully automated, background-driven **Software-with-a-Service** platform for UK trade
contractors. It automates end-to-end client onboarding: local UK number purchasing,
Ofcom regulatory document submission via **Telnyx**, **LiveKit Cloud** SIP trunk
provisioning, transactional email autoresponders, and call recording / transcript
management for client dashboards.

Built to deploy on **Railway** with managed PostgreSQL.

---

## Architecture

```
[ Client Onboarding Form ]
        │ (Business info + compliance docs + payment)
        ▼
[ POST /api/onboard ]
        ├──► 1. Telnyx: search & purchase local UK number
        ├──► 2. Telnyx: upload ID/address docs + submit requirement group (Ofcom)
        ├──► 3. Telnyx: assign number to LiveKit SIP connection
        ├──► 4. LiveKit: create inbound SIP trunk + dispatch rule → sitering-receptionist
        ├──► 5. DB: save client profile (PENDING_REGULATORY_APPROVAL)
        └──► 6. Email: "Onboarding Received — Pending Activation"

[ POST /api/webhooks/telnyx ]  ← requirement_group.status_updated / number.order.status
        └──► on approved/active: set client ACTIVE + send Activation email

[ POST /api/calls ]  ← from sitering-receptionist worker / LiveKit egress
        └──► store recording + transcript + summary; email lead alert if actionable
```

## Tech stack

- **Node.js 20 + Express** (ES modules)
- **PostgreSQL** via `pg`
- **Telnyx** (`telnyx` SDK) — numbers, documents, requirement groups, webhooks
- **LiveKit** (`@livekit/server-sdk`) — SIP inbound trunks & dispatch rules
- **Resend** (`resend`) — transactional autoresponders
- **S3** (`@aws-sdk/client-s3`) or a Railway volume — recording storage

## Project layout

```
db/schema.sql              PostgreSQL schema
src/index.js               Express app entry
src/config/env.js          Environment config
src/db/                    Pool, migrate, seed, repositories
src/services/              telnyx, livekit, email, storage, onboarding orchestration
src/routes/                onboard, webhooks, clients, calls
src/middleware/            upload (multer), validate (zod), auth, error handling
src/utils/                 logger, Telnyx Ed25519 signature verification
```

## Getting started (local)

```bash
cp .env.example .env          # fill in values, or keep MOCK_PROVIDERS=true
npm install
npm run migrate               # applies db/schema.sql
npm run seed                  # optional demo data
npm run dev                   # http://localhost:3000
```

### Mock mode

With `MOCK_PROVIDERS=true` (the default), Telnyx / LiveKit / Resend / S3 calls are
**stubbed** so the server boots and every endpoint responds without live credentials.
Each provider also auto-mocks if its own credentials are missing. Set
`MOCK_PROVIDERS=false` in production and provide real keys.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/onboard` | Multipart onboarding (fields + `proof_of_id`, `proof_of_address`) |
| POST | `/api/webhooks/telnyx` | Telnyx webhook (Ed25519-verified, raw body) |
| POST | `/api/calls` | Call ingest from the receptionist worker (optional bearer token) |
| GET | `/api/clients/:id` | Client profile |
| GET | `/api/clients/:id/calls` | Calls list for the dashboard |
| GET | `/health`, `/health/db` | Health checks |

### Example: onboarding request

```bash
curl -X POST http://localhost:3000/api/onboard \
  -F business_name="Bradford Boiler Bros" \
  -F contact_name="Dave Sutcliffe" \
  -F email="dave@example.co.uk" \
  -F phone_number="+447700900123" \
  -F target_area_code="01274" \
  -F ai_greeting="Thanks for calling, how can I help?" \
  -F business_hours='{"mon_fri":"08:00-18:00"}' \
  -F emergency_forward_number="+447700900999" \
  -F proof_of_id=@./passport.jpg \
  -F proof_of_address=@./utility_bill.pdf
```

## Environment variables

See [`.env.example`](./.env.example) for the full list. On Railway set these in the
service **Variables** tab. `DATABASE_URL` is injected automatically by the Railway
PostgreSQL plugin.

## Deploy on Railway

1. Create a Railway project and add the **PostgreSQL** plugin.
2. Deploy this repo (Railway auto-detects Nixpacks; `railway.json` sets the start
   command to run migrations then boot).
3. Add the environment variables from `.env.example`.
4. Point your Telnyx webhook to `https://<your-service>.up.railway.app/api/webhooks/telnyx`.

## The `sitering-receptionist` worker

This service provisions the telephony + persistence layer. The AI voice agent itself
(`sitering-receptionist`) runs as a separate LiveKit agent worker. Dispatch rules
created here pass `{ "client_id": "<uuid>" }` in room/agent metadata so the worker can
load per-client prompt settings (`ai_greeting`, `business_hours`, `emergency_number`)
from PostgreSQL at call time, then POST the recording/transcript/summary back to
`/api/calls` when the call ends.

## Security notes

- Telnyx webhooks are verified with Ed25519 (`TELNYX_PUBLIC_KEY`) over the raw body,
  with a 5-minute replay window.
- Provider events are de-duplicated for idempotency (`provider_events` table).
- `/api/calls` can be locked down with `INTERNAL_API_TOKEN` (Bearer).
- Never commit `.env`; secrets live in Railway Variables.

## License

Proprietary — © SiteRing.
