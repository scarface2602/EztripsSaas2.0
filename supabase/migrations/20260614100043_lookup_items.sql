-- Centralized lookup items for all dropdown lists across SaaS and Website
CREATE TABLE IF NOT EXISTS lookup_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  group_name text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(category, value)
);

CREATE INDEX IF NOT EXISTS idx_lookup_category ON lookup_items(category);

-- Seed: Destinations (Holiday)
INSERT INTO lookup_items (category, value, label, group_name, sort_order, metadata) VALUES
('destination', 'thailand', 'Thailand', 'Holiday', 1, '{"region":"Southeast Asia","price":55000}'),
('destination', 'bali', 'Bali', 'Holiday', 2, '{"region":"Indonesia","price":60000}'),
('destination', 'andaman', 'Andaman', 'Holiday', 3, '{"region":"India","price":35000}'),
('destination', 'kashmir', 'Kashmir', 'Holiday', 4, '{"region":"India","price":30000}'),
('destination', 'ladakh', 'Ladakh', 'Holiday', 5, '{"region":"India","price":40000}'),
('destination', 'sikkim', 'Sikkim', 'Holiday', 6, '{"region":"India","price":28000}'),
('destination', 'bhutan', 'Bhutan', 'Holiday', 7, '{"region":"South Asia","price":65000}'),
('destination', 'vietnam', 'Vietnam', 'Holiday', 8, '{"region":"Southeast Asia","price":50000}'),
('destination', 'japan', 'Japan', 'Holiday', 9, '{"region":"East Asia","price":1200000}'),
('destination', 'switzerland', 'Switzerland', 'Holiday', 10, '{"region":"Europe","price":180000}'),
('destination', 'france', 'France', 'Holiday', 11, '{"region":"Europe","price":160000}'),
('destination', 'australia', 'Australia', 'Holiday', 12, '{"region":"Oceania","price":200000}'),
('destination', 'new-zealand', 'New Zealand', 'Holiday', 13, '{"region":"Oceania","price":220000}'),
('destination', 'kenya', 'Kenya', 'Holiday', 14, '{"region":"Africa","price":250000}'),
('destination', 'uttarakhand', 'Uttarakhand', 'Holiday', 15, '{"region":"India","price":22000}'),
('destination', 'himachal', 'Himachal Pradesh', 'Holiday', 16, '{"region":"India","price":20000}'),
('destination', 'nepal', 'Nepal', 'Holiday', 17, '{"region":"South Asia","price":35000}'),
('destination', 'kazakhstan', 'Kazakhstan', 'Holiday', 18, '{"region":"Central Asia","price":90000}'),
('destination', 'russia', 'Russia', 'Holiday', 19, '{"region":"Europe/Asia","price":130000}'),
('destination', 'uzbekistan', 'Uzbekistan', 'Holiday', 20, '{"region":"Central Asia","price":80000}'),
('destination', 'spain', 'Spain', 'Holiday', 21, '{"region":"Europe","price":150000}'),
-- Destinations (Pilgrimage)
('destination', 'char-dham', 'Char Dham Yatra', 'Pilgrimage', 22, '{"region":"Uttarakhand","price":45000}'),
('destination', 'maharashtra-jyotirlinga', 'Maharashtra Jyotirlinga Circuit', 'Pilgrimage', 23, '{"region":"Maharashtra","price":25000}'),
('destination', 'varanasi-circuit', 'Varanasi-Ayodhya-Prayagraj-Gaya', 'Pilgrimage', 24, '{"region":"North India","price":18000}'),
('destination', 'south-india-temples', 'Madurai-Rameswaram-Kanyakumari', 'Pilgrimage', 25, '{"region":"South India","price":20000}'),
('destination', 'omkareshwar-mahakaleswar', 'Omkareshwar-Mahakaleswar', 'Pilgrimage', 26, '{"region":"Madhya Pradesh","price":15000}'),
('destination', 'kedarnath-badrinath', 'Kedarnath-Badrinath', 'Pilgrimage', 27, '{"region":"Uttarakhand","price":35000}')
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Airlines
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('airline', 'indigo', 'IndiGo', 1),
('airline', 'air-india', 'Air India', 2),
('airline', 'spicejet', 'SpiceJet', 3),
('airline', 'vistara', 'Vistara', 4),
('airline', 'airasia', 'AirAsia India', 5),
('airline', 'akasa', 'Akasa Air', 6),
('airline', 'emirates', 'Emirates', 7),
('airline', 'singapore-airlines', 'Singapore Airlines', 8),
('airline', 'thai-airways', 'Thai Airways', 9),
('airline', 'qatar-airways', 'Qatar Airways', 10),
('airline', 'etihad', 'Etihad Airways', 11),
('airline', 'lufthansa', 'Lufthansa', 12)
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Flight classes
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('flight_class', 'economy', 'Economy', 1),
('flight_class', 'premium_economy', 'Premium Economy', 2),
('flight_class', 'business', 'Business', 3),
('flight_class', 'first', 'First Class', 4)
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Trip types
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('trip_type', 'one_way', 'One Way', 1),
('trip_type', 'round_trip', 'Round Trip', 2),
('trip_type', 'multi_city', 'Multi City', 3)
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Hotel categories
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('hotel_category', 'budget', 'Budget', 1),
('hotel_category', 'standard', 'Standard (3 Star)', 2),
('hotel_category', 'deluxe', 'Deluxe (4 Star)', 3),
('hotel_category', 'luxury', 'Luxury (5 Star)', 4),
('hotel_category', 'ultra_luxury', 'Ultra Luxury', 5)
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Transfer modes
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('transfer_mode', 'cab', 'Cab / Car', 1),
('transfer_mode', 'train', 'Train', 2),
('transfer_mode', 'bus', 'Bus', 3)
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Visa categories
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('visa_category', 'tourist', 'Tourist', 1),
('visa_category', 'business', 'Business', 2),
('visa_category', 'medical', 'Medical', 3),
('visa_category', 'transit', 'Transit', 4)
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Visa countries
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('visa_country', 'thailand', 'Thailand', 1),
('visa_country', 'uae', 'UAE / Dubai', 2),
('visa_country', 'singapore', 'Singapore', 3),
('visa_country', 'malaysia', 'Malaysia', 4),
('visa_country', 'sri-lanka', 'Sri Lanka', 5),
('visa_country', 'indonesia', 'Indonesia / Bali', 6),
('visa_country', 'vietnam', 'Vietnam', 7),
('visa_country', 'japan', 'Japan', 8),
('visa_country', 'australia', 'Australia', 9),
('visa_country', 'uk', 'United Kingdom', 10),
('visa_country', 'usa', 'United States', 11),
('visa_country', 'canada', 'Canada', 12),
('visa_country', 'schengen', 'Schengen (Europe)', 13),
('visa_country', 'new-zealand', 'New Zealand', 14),
('visa_country', 'south-korea', 'South Korea', 15),
('visa_country', 'china', 'China', 16),
('visa_country', 'russia', 'Russia', 17),
('visa_country', 'turkey', 'Turkey', 18),
('visa_country', 'egypt', 'Egypt', 19),
('visa_country', 'kenya', 'Kenya', 20)
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Visa entry types
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('visa_entry_type', 'single', 'Single Entry', 1),
('visa_entry_type', 'multiple', 'Multiple Entry', 2)
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Budget ranges
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('budget_range', 'under_50k', 'Under ₹50,000', 1),
('budget_range', '50k_1l', '₹50,000 – ₹1,00,000', 2),
('budget_range', '1l_2l', '₹1,00,000 – ₹2,00,000', 3),
('budget_range', '2l_5l', '₹2,00,000 – ₹5,00,000', 4),
('budget_range', 'above_5l', 'Above ₹5,00,000', 5)
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Lead sources
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('lead_source', 'website', 'Website', 1),
('lead_source', 'phone', 'Phone', 2),
('lead_source', 'whatsapp', 'WhatsApp', 3),
('lead_source', 'referral', 'Referral', 4),
('lead_source', 'walk_in', 'Walk-in', 5),
('lead_source', 'offline', 'Offline', 6),
('lead_source', 'social_media', 'Social Media', 7),
('lead_source', 'google_ads', 'Google Ads', 8)
ON CONFLICT (category, value) DO NOTHING;

-- Seed: Food preferences
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('food_preference', 'vegetarian', 'Vegetarian', 1),
('food_preference', 'non_vegetarian', 'Non-Vegetarian', 2),
('food_preference', 'jain', 'Jain', 3),
('food_preference', 'vegan', 'Vegan', 4)
ON CONFLICT (category, value) DO NOTHING;
