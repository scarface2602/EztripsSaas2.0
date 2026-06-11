-- ============================================================
-- Builder v2 day-wise itinerary
--
-- Reuses the existing itinerary_days table (so the share page / PDF
-- snapshot shape is unchanged) with two tweaks:
--   - per-day transfer mode (SIC = seat-in-coach shared, PVT = private)
--   - date becomes nullable so days can be drafted before travel dates
--     are fixed
-- ============================================================

ALTER TABLE itinerary_days ALTER COLUMN date DROP NOT NULL;

ALTER TABLE itinerary_days ADD COLUMN IF NOT EXISTS transfer_mode text
  CHECK (transfer_mode IN ('SIC', 'PVT', 'NONE'));
