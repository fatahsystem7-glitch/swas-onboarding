-- ─────────────────────────────────────────────────────────────
-- SwaS Onboarding & Telephony Engine — PostgreSQL schema
-- ─────────────────────────────────────────────────────────────

-- gen_random_uuid() lives in pgcrypto on older PG; built-in on PG13+.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clients (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name            VARCHAR(255) NOT NULL,
    contact_name             VARCHAR(255),
    email                    VARCHAR(255) UNIQUE NOT NULL,
    phone_number             VARCHAR(50) NOT NULL,
    telnyx_number            VARCHAR(50),
    telnyx_number_order_id   VARCHAR(255),
    telnyx_requirement_group_id VARCHAR(255),
    livekit_trunk_id         VARCHAR(255),
    livekit_dispatch_rule_id VARCHAR(255),
    status                   VARCHAR(50) DEFAULT 'PENDING_REGULATORY_APPROVAL',
    ai_greeting              TEXT,
    business_hours           JSONB,
    emergency_number         VARCHAR(50),
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calls (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id      UUID REFERENCES clients(id) ON DELETE CASCADE,
    caller_number  VARCHAR(50) NOT NULL,
    recording_url  TEXT,
    transcript     TEXT,
    summary        TEXT,
    is_lead        BOOLEAN DEFAULT FALSE,
    duration_seconds INTEGER,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optional: raw provider events for audit/debugging & idempotency
CREATE TABLE IF NOT EXISTS provider_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider      VARCHAR(50) NOT NULL,
    event_type    VARCHAR(120),
    external_id   VARCHAR(255),
    payload       JSONB,
    received_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calls_client_id ON calls(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_telnyx_number ON clients(telnyx_number);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_events_dedupe
    ON provider_events(provider, external_id, event_type)
    WHERE external_id IS NOT NULL;

-- keep updated_at fresh on clients
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
