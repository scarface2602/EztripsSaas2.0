-- Consent-then-capture: accepting a proposal locks the quoted price for a
-- defined window instead of capturing payment at the exact moment of consent.
-- Within the window the agent verifies availability and the client pays the
-- deposit via the auto-created payment link; past it, re-acceptance at
-- current price is required.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS price_locked_until timestamptz;

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS price_lock_hours integer NOT NULL DEFAULT 48;
