-- Centralized lookup items for Vehicle Types
INSERT INTO lookup_items (category, value, label, sort_order) VALUES
('vehicle_type', 'hatchback', 'Hatchback', 1),
('vehicle_type', 'sedan', 'Sedan', 2),
('vehicle_type', 'muv', 'MUV', 3),
('vehicle_type', 'suv', 'SUV', 4),
('vehicle_type', 'luxury', 'Luxury', 5),
('vehicle_type', 'tempo_traveller', 'Tempo Traveller', 6),
('vehicle_type', 'tempo_traveller_urbania', 'Tempo Traveller Urbania', 7)
ON CONFLICT (category, value) DO NOTHING;
