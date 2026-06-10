-- ============================================================
-- City lookup category
--
-- Cities were hardcoded arrays inside the proposal editor (duplicated in
-- two files) and free text on hotel rows. This promotes them to the
-- lookup_items system: CMS-manageable, shared by every city input, and
-- self-growing — distinct cities already present in quoting history are
-- seeded in, and the editor adds new ones as agents type them.
-- ============================================================

-- 1. Seed a sensible starter set (matches the lists the editor had inline).
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

-- 2. Self-seed from quoting history: any city already used in hotels or
--    itineraries becomes a lookup entry automatically.
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
