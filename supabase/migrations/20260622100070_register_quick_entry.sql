-- ============================================================
-- Register / quick entry: trains, insurance and DMC packages can
-- now be sold as one-line bookings (the "query sheet" workflow).
--
-- Also re-asserts the full item_type list: the 20260515 rebuild of
-- the check dropped 'vehicle', and 20260528 skipped re-adding it
-- because the constraint already existed.
-- ============================================================

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_type_check
  CHECK (booking_type IN ('package', 'hotel', 'land', 'flight', 'train', 'insurance'));

ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_item_type_check;
ALTER TABLE booking_items ADD CONSTRAINT booking_items_item_type_check
  CHECK (item_type IN (
    'flight_segment', 'hotel_room', 'transfer', 'activity', 'meal_plan',
    'dmc_package', 'vehicle', 'train', 'insurance'
  ));
