-- Seed website_destinations from existing hardcoded data

INSERT INTO website_destinations (slug, title, country, region, price_from, cover_image, is_pilgrimage, published, sort_order) VALUES
-- Holiday destinations
('thailand', 'Thailand', 'Thailand', 'Southeast Asia', 55000, 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800&h=600&fit=crop&q=80', false, true, 1),
('bali', 'Bali', 'Indonesia', 'Indonesia', 60000, 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&h=600&fit=crop&q=80', false, true, 2),
('andaman', 'Andaman', 'India', 'India', 35000, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop&q=80', false, true, 3),
('kashmir', 'Kashmir', 'India', 'India', 30000, 'https://images.unsplash.com/photo-1566837945700-30057527ade0?w=800&h=600&fit=crop&q=80', false, true, 4),
('ladakh', 'Ladakh', 'India', 'India', 40000, 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&h=600&fit=crop&q=80', false, true, 5),
('sikkim', 'Sikkim', 'India', 'India', 28000, 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=800&h=600&fit=crop&q=80', false, true, 6),
('bhutan', 'Bhutan', 'Bhutan', 'South Asia', 65000, 'https://images.unsplash.com/photo-1553856622-d1b352e9a211?w=800&h=600&fit=crop&q=80', false, true, 7),
('vietnam', 'Vietnam', 'Vietnam', 'Southeast Asia', 50000, 'https://images.unsplash.com/photo-1528127269322-539801943592?w=800&h=600&fit=crop&q=80', false, true, 8),
('japan', 'Japan', 'Japan', 'East Asia', 1200000, 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop&q=80', false, true, 9),
('switzerland', 'Switzerland', 'Switzerland', 'Europe', 180000, 'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?w=800&h=600&fit=crop&q=80', false, true, 10),
('france', 'France', 'France', 'Europe', 160000, 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop&q=80', false, true, 11),
('australia', 'Australia', 'Australia', 'Oceania', 200000, 'https://images.unsplash.com/photo-1529108190281-9a4f620bc2d8?w=800&h=600&fit=crop&q=80', false, true, 12),
('new-zealand', 'New Zealand', 'New Zealand', 'Oceania', 220000, 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=800&h=600&fit=crop&q=80', false, true, 13),
('kenya', 'Kenya', 'Kenya', 'Africa', 250000, 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=600&fit=crop&q=80', false, true, 14),
('uttarakhand', 'Uttarakhand', 'India', 'India', 22000, 'https://images.unsplash.com/photo-1588083949404-c4f1ed1323b3?w=800&h=600&fit=crop&q=80', false, true, 15),
('himachal', 'Himachal Pradesh', 'India', 'India', 20000, 'https://images.unsplash.com/photo-1598977741571-78c84b92e5f8?w=800&h=600&fit=crop&q=80', false, true, 16),
('nepal', 'Nepal', 'Nepal', 'South Asia', 35000, 'https://images.unsplash.com/photo-1507743617593-0a422c9bb7f5?w=800&h=600&fit=crop&q=80', false, true, 17),
('kazakhstan', 'Kazakhstan', 'Kazakhstan', 'Central Asia', 90000, 'https://images.unsplash.com/photo-1586699253884-e199770f63b9?w=800&h=600&fit=crop&q=80', false, true, 18),
('russia', 'Russia', 'Russia', 'Europe/Asia', 130000, 'https://images.unsplash.com/photo-1513326738677-b964603b136d?w=800&h=600&fit=crop&q=80', false, true, 19),
('uzbekistan', 'Uzbekistan', 'Uzbekistan', 'Central Asia', 80000, 'https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=800&h=600&fit=crop&q=80', false, true, 20),
('spain', 'Spain', 'Spain', 'Europe', 150000, 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=800&h=600&fit=crop&q=80', false, true, 21),
-- Pilgrimage destinations
('char-dham', 'Char Dham Yatra', 'India', 'Uttarakhand', 45000, 'https://images.unsplash.com/photo-1604928141064-207cea6f571f?w=800&h=600&fit=crop&q=80', true, true, 22),
('maharashtra-jyotirlinga', 'Maharashtra Jyotirlinga Circuit', 'India', 'Maharashtra', 25000, 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&h=600&fit=crop&q=80', true, true, 23),
('varanasi-circuit', 'Varanasi–Ayodhya–Prayagraj–Gaya', 'India', 'North India', 18000, 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=800&h=600&fit=crop&q=80', true, true, 24),
('south-india-temples', 'Madurai–Rameswaram–Kanyakumari', 'India', 'South India', 20000, 'https://images.unsplash.com/photo-1621996659490-3275b4d0d951?w=800&h=600&fit=crop&q=80', true, true, 25),
('omkareshwar-mahakaleswar', 'Omkareshwar–Mahakaleswar', 'India', 'Madhya Pradesh', 15000, 'https://images.unsplash.com/photo-1624461050280-4807e15a6e88?w=800&h=600&fit=crop&q=80', true, true, 26),
('kedarnath-badrinath', 'Kedarnath–Badrinath', 'India', 'Uttarakhand', 35000, 'https://images.unsplash.com/photo-1572978122341-d42368429b55?w=800&h=600&fit=crop&q=80', true, true, 27);
