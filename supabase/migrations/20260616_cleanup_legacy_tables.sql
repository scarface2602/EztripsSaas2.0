-- Drop deprecated legacy financial tables
-- These tables were used by the old online booking flow and have been superseded 
-- by booking_packages and booking_package_payments.

DROP TABLE IF EXISTS receivables CASCADE;
DROP TABLE IF EXISTS payables CASCADE;
DROP TABLE IF EXISTS booking_payments CASCADE;

-- ==============================================================================
-- FACTORY RESET OPTION
-- ==============================================================================
-- If you want to wipe all your test data to start fresh, UNCOMMENT the lines below
-- before running this script in your Supabase SQL editor.
-- This will delete all trips, bookings, packages, and proposals, giving you a completely clean slate.

-- TRUNCATE TABLE 
--   trips,
--   bookings, 
--   booking_packages, 
--   booking_package_payments, 
--   booking_items, 
--   proposals, 
--   hotels, 
--   flights, 
--   itinerary_activities, 
--   line_items
-- CASCADE;
