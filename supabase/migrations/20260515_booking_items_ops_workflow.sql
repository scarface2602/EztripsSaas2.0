-- Add new supplier statuses, vendor tracking columns, and dmc_package item type

-- Drop old constraints
ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_supplier_status_check;
ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_item_type_check;

-- Add updated constraints with new values
ALTER TABLE booking_items ADD CONSTRAINT booking_items_supplier_status_check
  CHECK (supplier_status IN ('pending', 'confirmation_requested', 'on_hold', 'confirmed', 'modified', 'cancelled', 'completed'));

ALTER TABLE booking_items ADD CONSTRAINT booking_items_item_type_check
  CHECK (item_type IN ('flight_segment', 'hotel_room', 'transfer', 'activity', 'meal_plan', 'dmc_package'));

-- Add vendor tracking columns
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS vendor_name text;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS vendor_email text;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS portal_name text;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS payment_due_date date;

-- Migrate old 'requested' status to 'confirmation_requested'
UPDATE booking_items SET supplier_status = 'confirmation_requested' WHERE supplier_status = 'requested';
