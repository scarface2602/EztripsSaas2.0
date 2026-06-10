-- ============================================================
-- 1. RESTORE API ROLE GRANTS (run once, fixes all API access)
--
-- This database was cloned from another project, and the clone lost
-- Supabase's default permissions for the API roles — which is why every
-- REST/API call returns "permission denied for schema public" no matter
-- which key is used. This restores the standard Supabase grants.
-- RLS policies still apply to anon/authenticated exactly as before.
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Future tables/functions get the same grants automatically.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ============================================================
-- 2. CITY LOOKUPS for the proposal editor dropdowns
-- ============================================================

INSERT INTO lookup_items (category, value, label, group_name, sort_order) VALUES
('city', 'delhi', 'Delhi', 'India', 1),
('city', 'mumbai', 'Mumbai', 'India', 2),
('city', 'jaipur', 'Jaipur', 'India', 3),
('city', 'udaipur', 'Udaipur', 'India', 4),
('city', 'goa', 'Goa', 'India', 5),
('city', 'kerala', 'Kerala', 'India', 6),
('city', 'kochi', 'Kochi', 'India', 7),
('city', 'munnar', 'Munnar', 'India', 8),
('city', 'alleppey', 'Alleppey', 'India', 9),
('city', 'shimla', 'Shimla', 'India', 10),
('city', 'manali', 'Manali', 'India', 11),
('city', 'coorg', 'Coorg', 'India', 12),
('city', 'agra', 'Agra', 'India', 13),
('city', 'varanasi', 'Varanasi', 'India', 14),
('city', 'rishikesh', 'Rishikesh', 'India', 15),
('city', 'darjeeling', 'Darjeeling', 'India', 16),
('city', 'leh', 'Leh', 'India', 17),
('city', 'srinagar', 'Srinagar', 'India', 18),
('city', 'port-blair', 'Port Blair', 'India', 19),
('city', 'havelock', 'Havelock', 'India', 20),
('city', 'bangkok', 'Bangkok', 'Thailand', 30),
('city', 'phuket', 'Phuket', 'Thailand', 31),
('city', 'krabi', 'Krabi', 'Thailand', 32),
('city', 'pattaya', 'Pattaya', 'Thailand', 33),
('city', 'koh-samui', 'Koh Samui', 'Thailand', 34),
('city', 'ubud', 'Ubud', 'Bali', 40),
('city', 'seminyak', 'Seminyak', 'Bali', 41),
('city', 'kuta', 'Kuta', 'Bali', 42),
('city', 'nusa-dua', 'Nusa Dua', 'Bali', 43),
('city', 'singapore', 'Singapore', 'Singapore', 50),
('city', 'kuala-lumpur', 'Kuala Lumpur', 'Malaysia', 51),
('city', 'dubai', 'Dubai', 'UAE', 52),
('city', 'abu-dhabi', 'Abu Dhabi', 'UAE', 53),
('city', 'male', 'Malé', 'Maldives', 54),
('city', 'colombo', 'Colombo', 'Sri Lanka', 60),
('city', 'kandy', 'Kandy', 'Sri Lanka', 61),
('city', 'galle', 'Galle', 'Sri Lanka', 62),
('city', 'hanoi', 'Hanoi', 'Vietnam', 70),
('city', 'ho-chi-minh', 'Ho Chi Minh', 'Vietnam', 71),
('city', 'da-nang', 'Da Nang', 'Vietnam', 72),
('city', 'paris', 'Paris', 'Europe', 80),
('city', 'rome', 'Rome', 'Europe', 81),
('city', 'zurich', 'Zurich', 'Europe', 82),
('city', 'amsterdam', 'Amsterdam', 'Europe', 83),
('city', 'london', 'London', 'Europe', 84)
ON CONFLICT (category, value) DO NOTHING;

-- Self-seed from quoting history (no-op on an empty database).
INSERT INTO lookup_items (category, value, label, sort_order)
SELECT DISTINCT
  'city',
  lower(regexp_replace(trim(city), '\s+', '-', 'g')),
  initcap(trim(city)),
  500
FROM (
  SELECT city FROM hotels WHERE city IS NOT NULL AND trim(city) <> ''
  UNION
  SELECT city FROM itinerary_days WHERE city IS NOT NULL AND trim(city) <> ''
) src
ON CONFLICT (category, value) DO NOTHING;

-- Verification
SELECT
  has_schema_privilege('service_role', 'public', 'USAGE') AS service_role_ok,
  has_schema_privilege('anon', 'public', 'USAGE')         AS anon_ok,
  (SELECT count(*) FROM lookup_items WHERE category = 'city') AS cities_seeded;
