-- ============================================================
-- Quoted vs actual costs on booking items
--
-- "As sold" (quoted_*) is frozen at booking creation and never edited;
-- ops works against cost_price / vendor_name (the actuals). The delta is
-- the negotiated margin improvement — computed, never entered.
-- ============================================================

ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS quoted_cost numeric(12,2);
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS quoted_vendor_name text;

-- Freeze the baseline for existing items at their current values.
UPDATE booking_items SET quoted_cost = cost_price WHERE quoted_cost IS NULL;
UPDATE booking_items SET quoted_vendor_name = vendor_name WHERE quoted_vendor_name IS NULL;

-- Every new item freezes its baseline at insert time, regardless of
-- which code path created it.
CREATE OR REPLACE FUNCTION set_booking_item_quoted_baseline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quoted_cost IS NULL THEN
    NEW.quoted_cost := NEW.cost_price;
  END IF;
  IF NEW.quoted_vendor_name IS NULL THEN
    NEW.quoted_vendor_name := NEW.vendor_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_items_quoted_baseline ON booking_items;
CREATE TRIGGER trg_booking_items_quoted_baseline
  BEFORE INSERT ON booking_items
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_item_quoted_baseline();
