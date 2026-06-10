-- Webhook idempotency ledger.
-- Razorpay (and most providers) retry webhook delivery; processing the same
-- event twice must never double-credit a payment. Every handler inserts its
-- event id here first — a unique violation means "already processed, ack and exit".

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'razorpay',
  event_id text NOT NULL,
  event_type text,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_webhook_events_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- Service-role only: no anon/authenticated policies on purpose.
