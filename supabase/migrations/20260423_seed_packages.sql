-- Seed website_packages with hotel-tier pricing

INSERT INTO website_packages (slug, title, subtitle, destination, destination_slug, nights, duration_days, price_3star, price_4star, price_5star, price_from, cover_image, highlights, inclusions, exclusions, published, sort_order) VALUES

-- Thailand
('thailand-4n-bangkok-pattaya', 'Bangkok & Pattaya Explorer', '4 Nights / 5 Days', 'Thailand', 'thailand', 4, 5, 28000, 38000, 55000, 28000, 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800&h=600&fit=crop&q=80', ARRAY['Chao Phraya River cruise','Coral Island day trip','Grand Palace visit','Thai street food tour'], ARRAY['Airport transfers','Daily breakfast','City tour with guide','All sightseeing as per itinerary'], ARRAY['Visa fees','Lunch & dinner','Travel insurance','Personal expenses'], true, 1),
('thailand-6n-bangkok-pattaya-phuket', 'Thailand Grand Tour', '6 Nights / 7 Days', 'Thailand', 'thailand', 6, 7, 42000, 55000, 80000, 42000, 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800&h=600&fit=crop&q=80', ARRAY['Phi Phi Island tour','Pattaya nightlife','Bangkok temples','Floating market visit'], ARRAY['Airport transfers','Daily breakfast','Inter-city transfers','Hotel accommodation'], ARRAY['Visa fees','Meals other than breakfast','Optional activities','Tips & gratuities'], true, 2),

-- Bali
('bali-5n-ubud-seminyak', 'Bali Bliss', '5 Nights / 6 Days', 'Bali', 'bali', 5, 6, 35000, 48000, 72000, 35000, 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&h=600&fit=crop&q=80', ARRAY['Ubud rice terraces','Tanah Lot sunset','Seminyak beach club','Kintamani volcano view'], ARRAY['Airport transfers','Daily breakfast','Private car for sightseeing','Hotel accommodation'], ARRAY['Visa on arrival','Lunch & dinner','Water sports','Personal expenses'], true, 1),
('bali-7n-complete', 'Complete Bali Experience', '7 Nights / 8 Days', 'Bali', 'bali', 7, 8, 48000, 65000, 95000, 48000, 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&h=600&fit=crop&q=80', ARRAY['Nusa Penida day trip','Uluwatu temple & Kecak dance','White water rafting','Spa & wellness day'], ARRAY['Airport transfers','Daily breakfast','All sightseeing transfers','Nusa Penida boat tickets'], ARRAY['Visa on arrival','Meals other than breakfast','Adventure activities','Shopping'], true, 2),

-- Andaman
('andaman-5n-port-blair-havelock', 'Andaman Island Hop', '5 Nights / 6 Days', 'Andaman', 'andaman', 5, 6, 22000, 32000, 48000, 22000, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop&q=80', ARRAY['Radhanagar Beach','Cellular Jail light show','Scuba diving option','Glass bottom boat ride'], ARRAY['Airport transfers','Daily breakfast','Ferry tickets','Hotel accommodation'], ARRAY['Flights','Lunch & dinner','Water sports','Personal expenses'], true, 1),
('andaman-7n-neil-havelock', 'Andaman Complete Explorer', '7 Nights / 8 Days', 'Andaman', 'andaman', 7, 8, 30000, 42000, 62000, 30000, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop&q=80', ARRAY['Neil Island natural bridge','Elephant Beach snorkelling','North Bay coral reef','Baratang limestone caves'], ARRAY['Airport transfers','Daily breakfast','All ferry tickets','Sightseeing as per itinerary'], ARRAY['Flights','Meals other than breakfast','Optional activities','Camera fees'], true, 2),

-- Kashmir
('kashmir-5n-srinagar-pahalgam-gulmarg', 'Kashmir Paradise', '5 Nights / 6 Days', 'Kashmir', 'kashmir', 5, 6, 18000, 28000, 42000, 18000, 'https://images.unsplash.com/photo-1566837945700-30057527ade0?w=800&h=600&fit=crop&q=80', ARRAY['Dal Lake shikara ride','Gulmarg Gondola ride','Pahalgam valley trek','Mughal Gardens visit'], ARRAY['Airport transfers','Daily breakfast','Private cab for sightseeing','Houseboat stay 1 night'], ARRAY['Flights','Lunch & dinner','Gondola tickets','Pony rides'], true, 1),
('kashmir-7n-complete', 'Kashmir Grand Tour', '7 Nights / 8 Days', 'Kashmir', 'kashmir', 7, 8, 25000, 38000, 58000, 25000, 'https://images.unsplash.com/photo-1566837945700-30057527ade0?w=800&h=600&fit=crop&q=80', ARRAY['Sonmarg glacier point','Betaab Valley','Aru Valley exploration','Saffron fields visit'], ARRAY['Airport transfers','Daily breakfast','Private cab throughout','Houseboat 1 night + hotels'], ARRAY['Flights','Meals other than breakfast','Adventure activities','Shopping'], true, 2),

-- Ladakh
('ladakh-6n-leh-nubra-pangong', 'Ladakh Adventure', '6 Nights / 7 Days', 'Ladakh', 'ladakh', 6, 7, 25000, 35000, 52000, 25000, 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&h=600&fit=crop&q=80', ARRAY['Pangong Lake camping','Nubra Valley sand dunes','Khardung La pass','Magnetic Hill & monasteries'], ARRAY['Airport transfers','Daily breakfast','Private vehicle','Inner line permits'], ARRAY['Flights','Lunch & dinner','Camel safari','Personal expenses'], true, 1),
('ladakh-8n-complete', 'Complete Ladakh Explorer', '8 Nights / 9 Days', 'Ladakh', 'ladakh', 8, 9, 35000, 48000, 70000, 35000, 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&h=600&fit=crop&q=80', ARRAY['Tso Moriri Lake','Hemis monastery','Zanskar Valley','Rafting on Indus River'], ARRAY['Airport transfers','Daily breakfast','All permits','Private vehicle throughout'], ARRAY['Flights','Meals other than breakfast','Adventure sports','Tips'], true, 2),

-- Sikkim
('sikkim-5n-gangtok-pelling', 'Sikkim Serenity', '5 Nights / 6 Days', 'Sikkim', 'sikkim', 5, 6, 18000, 26000, 38000, 18000, 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=800&h=600&fit=crop&q=80', ARRAY['Tsomgo Lake excursion','Pelling Skywalk','Rumtek Monastery','Kanchenjunga viewpoint'], ARRAY['Airport transfers from Bagdogra','Daily breakfast','Private cab','Hotel accommodation'], ARRAY['Flights','Lunch & dinner','Permit fees','Yak ride'], true, 1),

-- Bhutan
('bhutan-5n-thimphu-paro-punakha', 'Bhutan Kingdom Tour', '5 Nights / 6 Days', 'Bhutan', 'bhutan', 5, 6, 42000, 55000, 78000, 42000, 'https://images.unsplash.com/photo-1553856622-d1b352e9a211?w=800&h=600&fit=crop&q=80', ARRAY['Tiger''s Nest monastery hike','Punakha Dzong visit','Buddha Dordenma statue','Dochula Pass 108 stupas'], ARRAY['Sustainable development fee','All meals','Licensed guide','Hotel accommodation'], ARRAY['Flights','Travel insurance','Personal expenses','Tips'], true, 1),

-- Vietnam
('vietnam-6n-hanoi-halong-hoian', 'Vietnam Heritage Trail', '6 Nights / 7 Days', 'Vietnam', 'vietnam', 6, 7, 32000, 45000, 68000, 32000, 'https://images.unsplash.com/photo-1528127269322-539801943592?w=800&h=600&fit=crop&q=80', ARRAY['Ha Long Bay cruise overnight','Hoi An ancient town walk','Hanoi street food tour','Cu Chi Tunnels visit'], ARRAY['Airport transfers','Daily breakfast','Ha Long Bay cruise with meals','Domestic flights'], ARRAY['Visa fees','Lunch & dinner (except cruise)','Optional activities','Shopping'], true, 1),

-- Japan
('japan-7n-tokyo-kyoto-osaka', 'Japan Highlights', '7 Nights / 8 Days', 'Japan', 'japan', 7, 8, 95000, 130000, 185000, 95000, 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop&q=80', ARRAY['Mount Fuji day trip','Fushimi Inari shrine','Shibuya & Akihabara','Traditional tea ceremony'], ARRAY['Airport transfers','Daily breakfast','7-day Japan Rail Pass','Hotel accommodation'], ARRAY['International flights','Lunch & dinner','Attraction tickets','Personal expenses'], true, 1),

-- Switzerland
('switzerland-6n-zurich-lucerne-interlaken', 'Swiss Alps Dream', '6 Nights / 7 Days', 'Switzerland', 'switzerland', 6, 7, 120000, 160000, 220000, 120000, 'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?w=800&h=600&fit=crop&q=80', ARRAY['Jungfraujoch Top of Europe','Lake Lucerne cruise','Rhine Falls visit','Interlaken adventure sports'], ARRAY['Airport transfers','Daily breakfast','Swiss Travel Pass','Hotel accommodation'], ARRAY['International flights','Lunch & dinner','Adventure activities','Visa fees'], true, 1),

-- France
('france-6n-paris-nice', 'France Romance', '6 Nights / 7 Days', 'France', 'france', 6, 7, 110000, 145000, 200000, 110000, 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop&q=80', ARRAY['Eiffel Tower summit','Louvre Museum guided tour','French Riviera day','Versailles Palace visit'], ARRAY['Airport transfers','Daily breakfast','City tours with guide','TGV train tickets'], ARRAY['International flights','Meals other than breakfast','Museum tickets','Visa fees'], true, 1),

-- Australia
('australia-7n-sydney-melbourne', 'Australia Explorer', '7 Nights / 8 Days', 'Australia', 'australia', 7, 8, 140000, 180000, 250000, 140000, 'https://images.unsplash.com/photo-1529108190281-9a4f620bc2d8?w=800&h=600&fit=crop&q=80', ARRAY['Sydney Opera House tour','Great Ocean Road drive','Blue Mountains day trip','Melbourne laneways food tour'], ARRAY['Airport transfers','Daily breakfast','Domestic flights','Hotel accommodation'], ARRAY['International flights','Lunch & dinner','Attraction tickets','Visa fees'], true, 1),

-- New Zealand
('new-zealand-7n-north-south', 'New Zealand Adventure', '7 Nights / 8 Days', 'New Zealand', 'new-zealand', 7, 8, 150000, 195000, 270000, 150000, 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=800&h=600&fit=crop&q=80', ARRAY['Milford Sound cruise','Hobbiton movie set','Queenstown bungee','Rotorua geothermal park'], ARRAY['Airport transfers','Daily breakfast','Inter-city transfers','Hotel accommodation'], ARRAY['International flights','Meals other than breakfast','Adventure activities','Visa fees'], true, 1),

-- Kenya
('kenya-6n-safari', 'Kenya Safari Experience', '6 Nights / 7 Days', 'Kenya', 'kenya', 6, 7, 180000, 230000, 320000, 180000, 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=600&fit=crop&q=80', ARRAY['Masai Mara game drives','Lake Nakuru flamingos','Amboseli with Kilimanjaro views','Nairobi National Park'], ARRAY['Airport transfers','All meals on safari','Game drives with guide','Lodge/camp accommodation'], ARRAY['International flights','Visa fees','Travel insurance','Tips for guides'], true, 1),

-- Uttarakhand
('uttarakhand-5n-mussoorie-rishikesh', 'Uttarakhand Retreat', '5 Nights / 6 Days', 'Uttarakhand', 'uttarakhand', 5, 6, 14000, 20000, 32000, 14000, 'https://images.unsplash.com/photo-1588083949404-c4f1ed1323b3?w=800&h=600&fit=crop&q=80', ARRAY['Mussoorie Mall Road & Kempty Falls','Rishikesh Ganga Aarti','Haridwar temple visit','Rajaji National Park safari'], ARRAY['Airport/station transfers','Daily breakfast','Private cab','Hotel accommodation'], ARRAY['Flights/trains','Lunch & dinner','Adventure activities','Personal expenses'], true, 1),

-- Himachal Pradesh
('himachal-6n-shimla-manali', 'Himachal Hills Escape', '6 Nights / 7 Days', 'Himachal Pradesh', 'himachal', 6, 7, 15000, 22000, 35000, 15000, 'https://images.unsplash.com/photo-1598977741571-78c84b92e5f8?w=800&h=600&fit=crop&q=80', ARRAY['Rohtang Pass excursion','Solang Valley adventure','Shimla Mall Road & Ridge','Kullu river rafting'], ARRAY['Volvo bus or transfers','Daily breakfast','Private cab for sightseeing','Hotel accommodation'], ARRAY['Flights/trains','Lunch & dinner','Adventure sport fees','Personal expenses'], true, 1),

-- Nepal
('nepal-5n-kathmandu-pokhara', 'Nepal Himalayan Trail', '5 Nights / 6 Days', 'Nepal', 'nepal', 5, 6, 22000, 30000, 45000, 22000, 'https://images.unsplash.com/photo-1507743617593-0a422c9bb7f5?w=800&h=600&fit=crop&q=80', ARRAY['Pashupatinath Temple','Pokhara lakeside & Sarangkot sunrise','Swayambhunath stupa','Chitwan jungle safari option'], ARRAY['Airport transfers','Daily breakfast','Domestic flight KTM-Pokhara','Hotel accommodation'], ARRAY['International flights','Lunch & dinner','Visa on arrival','Personal expenses'], true, 1),

-- Kazakhstan
('kazakhstan-5n-almaty-astana', 'Kazakhstan Discovery', '5 Nights / 6 Days', 'Kazakhstan', 'kazakhstan', 5, 6, 55000, 72000, 100000, 55000, 'https://images.unsplash.com/photo-1586699253884-e199770f63b9?w=800&h=600&fit=crop&q=80', ARRAY['Big Almaty Lake','Charyn Canyon trek','Astana futuristic city tour','Medeu skating rink & Shymbulak'], ARRAY['Airport transfers','Daily breakfast','Domestic flight','Private city tours'], ARRAY['International flights','Meals other than breakfast','Visa fees','Personal expenses'], true, 1),

-- Russia
('russia-6n-moscow-st-petersburg', 'Russia Imperial Tour', '6 Nights / 7 Days', 'Russia', 'russia', 6, 7, 85000, 110000, 155000, 85000, 'https://images.unsplash.com/photo-1513326738677-b964603b136d?w=800&h=600&fit=crop&q=80', ARRAY['Red Square & Kremlin','Hermitage Museum','Sapsan high-speed train','St Petersburg canals cruise'], ARRAY['Airport transfers','Daily breakfast','Sapsan train tickets','Hotel accommodation'], ARRAY['International flights','Lunch & dinner','Museum tickets','Visa fees'], true, 1),

-- Uzbekistan
('uzbekistan-5n-tashkent-samarkand-bukhara', 'Uzbekistan Silk Road', '5 Nights / 6 Days', 'Uzbekistan', 'uzbekistan', 5, 6, 50000, 65000, 90000, 50000, 'https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=800&h=600&fit=crop&q=80', ARRAY['Registan Square Samarkand','Bukhara old city walk','Tashkent metro architecture','Shah-i-Zinda necropolis'], ARRAY['Airport transfers','Daily breakfast','High-speed train tickets','Hotel accommodation'], ARRAY['International flights','Lunch & dinner','Entrance fees','Personal expenses'], true, 1),

-- Spain
('spain-6n-barcelona-madrid', 'Spain Fiesta', '6 Nights / 7 Days', 'Spain', 'spain', 6, 7, 100000, 135000, 190000, 100000, 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=800&h=600&fit=crop&q=80', ARRAY['Sagrada Familia tour','Flamenco show in Madrid','Park Guell & La Rambla','Toledo day trip'], ARRAY['Airport transfers','Daily breakfast','AVE train tickets','Hotel accommodation'], ARRAY['International flights','Meals other than breakfast','Attraction tickets','Visa fees'], true, 1),

-- Char Dham
('char-dham-10n-yatra', 'Char Dham Yatra Complete', '10 Nights / 11 Days', 'Char Dham', 'char-dham', 10, 11, 32000, 42000, 60000, 32000, 'https://images.unsplash.com/photo-1604928141064-207cea6f571f?w=800&h=600&fit=crop&q=80', ARRAY['Yamunotri & Gangotri darshan','Kedarnath trek/heli','Badrinath temple visit','Haridwar Ganga Aarti'], ARRAY['Haridwar pickup/drop','Daily breakfast & dinner','Hotel/dharamshala stay','Local transfers'], ARRAY['Helicopter tickets','Pony/palki charges','Lunch','Personal expenses'], true, 1),

-- Maharashtra Jyotirlinga
('maharashtra-jyotirlinga-5n', 'Maharashtra Jyotirlinga Circuit', '5 Nights / 6 Days', 'Maharashtra Jyotirlinga', 'maharashtra-jyotirlinga', 5, 6, 16000, 22000, 35000, 16000, 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&h=600&fit=crop&q=80', ARRAY['Trimbakeshwar darshan','Bhimashankar trek temple','Aundha Nagnath visit','Parli Vaijnath darshan'], ARRAY['Pickup from Nashik/Pune','Daily breakfast','AC vehicle throughout','Hotel accommodation'], ARRAY['Flights/trains','Lunch & dinner','Pooja items','Personal expenses'], true, 1),

-- Varanasi Circuit
('varanasi-circuit-5n', 'Varanasi–Ayodhya–Prayagraj–Gaya', '5 Nights / 6 Days', 'Varanasi Circuit', 'varanasi-circuit', 5, 6, 12000, 18000, 28000, 12000, 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=800&h=600&fit=crop&q=80', ARRAY['Ganga Aarti at Dashashwamedh Ghat','Ayodhya Ram Mandir darshan','Triveni Sangam holy dip','Bodh Gaya Mahabodhi Temple'], ARRAY['Station transfers','Daily breakfast','AC vehicle throughout','Hotel accommodation'], ARRAY['Trains/flights','Lunch & dinner','Boat rides','Pooja donations'], true, 1),

-- South India Temples
('south-india-temples-6n', 'Madurai–Rameswaram–Kanyakumari', '6 Nights / 7 Days', 'South India Temples', 'south-india-temples', 6, 7, 15000, 22000, 35000, 15000, 'https://images.unsplash.com/photo-1621996659490-3275b4d0d951?w=800&h=600&fit=crop&q=80', ARRAY['Meenakshi Amman Temple','Rameswaram Jyotirlinga','Kanyakumari sunrise & sunset','Dhanushkodi ghost town'], ARRAY['Airport/station transfers','Daily breakfast','AC vehicle','Hotel accommodation'], ARRAY['Flights/trains','Lunch & dinner','Temple pooja fees','Personal expenses'], true, 1),

-- Omkareshwar-Mahakaleswar
('omkareshwar-mahakaleswar-3n', 'Omkareshwar–Mahakaleswar Darshan', '3 Nights / 4 Days', 'Omkareshwar–Mahakaleswar', 'omkareshwar-mahakaleswar', 3, 4, 10000, 15000, 22000, 10000, 'https://images.unsplash.com/photo-1624461050280-4807e15a6e88?w=800&h=600&fit=crop&q=80', ARRAY['Mahakaleshwar Bhasma Aarti','Omkareshwar island parikrama','Ujjain city temples','Kal Bhairav temple visit'], ARRAY['Station/airport transfers','Daily breakfast','AC vehicle','Hotel accommodation'], ARRAY['Trains/flights','Lunch & dinner','VIP pooja tickets','Personal expenses'], true, 1),

-- Kedarnath-Badrinath
('kedarnath-badrinath-6n', 'Kedarnath–Badrinath Do Dham', '6 Nights / 7 Days', 'Kedarnath–Badrinath', 'kedarnath-badrinath', 6, 7, 22000, 30000, 45000, 22000, 'https://images.unsplash.com/photo-1572978122341-d42368429b55?w=800&h=600&fit=crop&q=80', ARRAY['Kedarnath temple trek','Badrinath hot springs','Mana Village – last Indian village','Rishikesh Ganga Aarti'], ARRAY['Haridwar pickup/drop','Daily breakfast & dinner','Hotel accommodation','Local vehicle transfers'], ARRAY['Helicopter tickets','Pony/palki charges','Lunch','Personal expenses'], true, 1);
