-- Add check-in/check-out tracking to booking items
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_booking_items_checkin ON booking_items(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_booking_items_checkout ON booking_items(checked_out_at);
