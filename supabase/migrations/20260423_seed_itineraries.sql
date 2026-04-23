-- Thailand 4N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Bangkok","description":"Arrive at Suvarnabhumi Airport. Private transfer to hotel. Evening free to explore Khao San Road or Asiatique night market."},
  {"day":2,"title":"Bangkok City Tour","description":"Visit the Grand Palace, Wat Pho (Reclining Buddha), and Wat Arun. Afternoon Chao Phraya river cruise. Evening at Jodd Fairs night market."},
  {"day":3,"title":"Transfer to Pattaya","description":"Drive to Pattaya. Visit Coral Island (Koh Larn) for snorkelling and beach activities. Evening Walking Street visit."},
  {"day":4,"title":"Pattaya Attractions","description":"Visit Nong Nooch Tropical Garden and Art in Paradise 3D museum. Optional Alcazar Cabaret show in the evening."},
  {"day":5,"title":"Departure","description":"Breakfast at hotel. Transfer to Suvarnabhumi Airport for your return flight."}
]'::jsonb, sample_hotels = '[
  {"name":"Pratunam Hotel","stars":3,"location":"Bangkok","image":"https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop"},
  {"name":"Amari Pattaya","stars":4,"location":"Pattaya","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Centara Grand","stars":5,"location":"Bangkok","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'thailand-4n-bangkok-pattaya';

-- Thailand 6N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Bangkok","description":"Airport pickup and hotel check-in. Evening free for Asiatique Riverfront or rooftop dining."},
  {"day":2,"title":"Bangkok Temples & Culture","description":"Grand Palace, Wat Pho, Wat Arun tour. Afternoon canal boat ride through old Bangkok. Evening Chinatown food walk."},
  {"day":3,"title":"Bangkok to Pattaya","description":"Drive to Pattaya. Coral Island beach day with speedboat transfer, parasailing and banana boat options."},
  {"day":4,"title":"Pattaya Exploration","description":"Nong Nooch Garden, Big Buddha Hill viewpoint, and Floating Market. Evening free for nightlife."},
  {"day":5,"title":"Fly to Phuket","description":"Morning flight to Phuket. Check in and relax at Patong Beach. Evening Bangla Road night market."},
  {"day":6,"title":"Phi Phi Island Day Trip","description":"Full-day Phi Phi Islands tour — Maya Bay, Pileh Lagoon, Viking Cave, snorkelling at Monkey Beach. Seafood dinner."},
  {"day":7,"title":"Departure from Phuket","description":"Breakfast. Free morning for last-minute shopping. Transfer to Phuket Airport."}
]'::jsonb, sample_hotels = '[
  {"name":"Ibis Bangkok Siam","stars":3,"location":"Bangkok","image":"https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop"},
  {"name":"Hilton Pattaya","stars":4,"location":"Pattaya","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Banyan Tree Phuket","stars":5,"location":"Phuket","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'thailand-6n-bangkok-pattaya-phuket';

-- Bali 5N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Bali","description":"Arrive at Ngurah Rai Airport. Private transfer to Ubud. Evening walk through Ubud Market and Monkey Forest."},
  {"day":2,"title":"Ubud Art & Nature","description":"Visit Tegallalang Rice Terraces, Tirta Empul holy spring temple, and Tegenungan Waterfall. Afternoon at Ubud Art Market."},
  {"day":3,"title":"Kintamani & Transfer to Seminyak","description":"Morning visit to Kintamani for Mount Batur volcano views. Lunch overlooking the caldera. Afternoon transfer to Seminyak."},
  {"day":4,"title":"Tanah Lot & Beach Day","description":"Morning at Tanah Lot Temple for iconic photos. Afternoon free at Seminyak Beach. Sunset at a beach club."},
  {"day":5,"title":"Uluwatu & Kecak Dance","description":"Visit Uluwatu Temple perched on cliffs. Watch the mesmerising Kecak fire dance at sunset. Seafood dinner at Jimbaran Bay."},
  {"day":6,"title":"Departure","description":"Breakfast and free time for last-minute shopping. Transfer to airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Ubud Village Hotel","stars":3,"location":"Ubud","image":"https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=300&fit=crop"},
  {"name":"Alaya Resort Ubud","stars":4,"location":"Ubud","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"The Mulia Seminyak","stars":5,"location":"Seminyak","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'bali-5n-ubud-seminyak';

-- Bali 7N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Bali","description":"Airport transfer to Ubud. Evening Monkey Forest walk and Ubud Palace area exploration."},
  {"day":2,"title":"Ubud Temples & Terraces","description":"Tegallalang Rice Terraces, Tirta Empul, Gunung Kawi Temple. Coffee plantation visit with luwak coffee tasting."},
  {"day":3,"title":"Kintamani & Waterfalls","description":"Mount Batur viewpoint, Tukad Cepung Waterfall, and Tibumana Waterfall. Traditional Balinese lunch."},
  {"day":4,"title":"Nusa Penida Day Trip","description":"Speedboat to Nusa Penida. Visit Kelingking Beach, Angel''s Billabong, Broken Beach. Snorkelling with manta rays."},
  {"day":5,"title":"Transfer to Seminyak","description":"Morning white water rafting on Ayung River. Afternoon transfer to Seminyak. Evening beach club sunset."},
  {"day":6,"title":"Tanah Lot & Uluwatu","description":"Morning Tanah Lot Temple. Afternoon Uluwatu Temple with Kecak dance at sunset. Jimbaran Bay seafood dinner."},
  {"day":7,"title":"Spa & Leisure Day","description":"Morning Balinese spa treatment. Afternoon free for shopping at Seminyak or Canggu. Farewell dinner."},
  {"day":8,"title":"Departure","description":"Breakfast. Airport transfer for return flight."}
]'::jsonb, sample_hotels = '[
  {"name":"Puri Garden Hotel","stars":3,"location":"Ubud","image":"https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=300&fit=crop"},
  {"name":"Maya Ubud Resort","stars":4,"location":"Ubud","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"St. Regis Bali","stars":5,"location":"Nusa Dua","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'bali-7n-complete';

-- Kashmir 5N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Srinagar","description":"Arrive at Srinagar Airport. Transfer to houseboat on Dal Lake. Evening shikara ride through floating gardens and markets."},
  {"day":2,"title":"Srinagar Mughal Gardens","description":"Visit Nishat Bagh, Shalimar Bagh, and Chashme Shahi gardens. Afternoon visit to Shankaracharya Temple for panoramic city views."},
  {"day":3,"title":"Srinagar to Pahalgam","description":"Drive to Pahalgam (2.5 hrs) through saffron fields and apple orchards. Visit Betaab Valley, Aru Valley, and Chandanwari."},
  {"day":4,"title":"Pahalgam to Gulmarg","description":"Drive to Gulmarg (4 hrs). Ride the Gulmarg Gondola (Phase 1 & 2) for stunning Himalayan views. Pony ride on the meadows."},
  {"day":5,"title":"Gulmarg to Srinagar","description":"Morning free in Gulmarg for golf course walk or shopping. Drive back to Srinagar. Evening free at Dal Lake boulevard."},
  {"day":6,"title":"Departure","description":"Early morning shikara ride. Breakfast and transfer to Srinagar Airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel & Houseboat","stars":3,"location":"Srinagar","image":"https://images.unsplash.com/photo-1566837945700-30057527ade0?w=400&h=300&fit=crop"},
  {"name":"Vivanta Dal View","stars":4,"location":"Srinagar","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"The Lalit Grand Palace","stars":5,"location":"Srinagar","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'kashmir-5n-srinagar-pahalgam-gulmarg';

-- Kashmir 7N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Srinagar","description":"Airport pickup. Houseboat check-in on Dal Lake. Evening shikara ride watching the sunset over the Zabarwan hills."},
  {"day":2,"title":"Srinagar Gardens & Old City","description":"Mughal Gardens tour — Nishat, Shalimar, Chashme Shahi. Afternoon old city walk through Jama Masjid and local bazaars."},
  {"day":3,"title":"Srinagar to Sonmarg","description":"Day excursion to Sonmarg (80 km). Visit Thajiwas Glacier, enjoy pony rides through alpine meadows. Return to Srinagar."},
  {"day":4,"title":"Srinagar to Pahalgam","description":"Drive to Pahalgam. En route visit saffron fields of Pampore. Explore Betaab Valley and Aru Valley."},
  {"day":5,"title":"Pahalgam Leisure Day","description":"Full day in Pahalgam. Visit Chandanwari, Baisaran meadow (Mini Switzerland), and Lidder River walk. Optional horse riding."},
  {"day":6,"title":"Pahalgam to Gulmarg","description":"Drive to Gulmarg. Gondola ride Phase 1 & 2 to Apharwat Peak (4,200m). Evening walk through the meadows."},
  {"day":7,"title":"Gulmarg to Srinagar","description":"Morning free in Gulmarg. Drive back to Srinagar. Afternoon shopping for Pashmina shawls and dry fruits at Lal Chowk."},
  {"day":8,"title":"Departure","description":"Breakfast. Transfer to Srinagar Airport. Tour ends with beautiful memories."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Heevan","stars":3,"location":"Srinagar","image":"https://images.unsplash.com/photo-1566837945700-30057527ade0?w=400&h=300&fit=crop"},
  {"name":"Radisson Srinagar","stars":4,"location":"Srinagar","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Khyber Himalayan Resort","stars":5,"location":"Gulmarg","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'kashmir-7n-complete';

-- Andaman 5N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Port Blair","description":"Arrive at Veer Savarkar Airport. Visit Cellular Jail and attend the evening Light & Sound show depicting India''s freedom struggle."},
  {"day":2,"title":"Port Blair to Havelock","description":"Ferry to Havelock Island. Check in and visit Radhanagar Beach (Asia''s best beach). Sunset by the shore."},
  {"day":3,"title":"Havelock Island","description":"Morning scuba diving or snorkelling at Elephant Beach. Afternoon kayaking through mangroves. Glass bottom boat ride."},
  {"day":4,"title":"Havelock to Neil Island","description":"Ferry to Neil Island. Visit Natural Bridge (Howrah Bridge), Bharatpur Beach for snorkelling, Laxmanpur Beach sunset."},
  {"day":5,"title":"Neil to Port Blair","description":"Morning at leisure on Neil Island. Ferry back to Port Blair. Visit Samudrika Marine Museum and Aberdeen Bazaar shopping."},
  {"day":6,"title":"Departure","description":"Breakfast. Transfer to airport for departure flight."}
]'::jsonb, sample_hotels = '[
  {"name":"TSG Emerald","stars":3,"location":"Port Blair","image":"https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop"},
  {"name":"Symphony Palms","stars":4,"location":"Havelock","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Taj Exotica","stars":5,"location":"Havelock","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'andaman-5n-port-blair-havelock';

-- Andaman 7N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Port Blair","description":"Airport transfer. Cellular Jail visit and Light & Sound show."},
  {"day":2,"title":"Ross Island & North Bay","description":"Boat to Ross Island (Netaji Subhas Chandra Bose Island) and North Bay for coral viewing and snorkelling."},
  {"day":3,"title":"Port Blair to Havelock","description":"Ferry to Havelock. Afternoon at iconic Radhanagar Beach — swim and watch the sunset."},
  {"day":4,"title":"Elephant Beach","description":"Speedboat to Elephant Beach. Snorkelling, sea walking, jet ski, and glass bottom boat ride."},
  {"day":5,"title":"Havelock to Neil Island","description":"Ferry to Neil Island. Visit Natural Bridge, Bharatpur Beach, and Laxmanpur Beach at sunset."},
  {"day":6,"title":"Neil to Port Blair via Baratang","description":"Return to Port Blair. En route visit Baratang Island for limestone caves and mud volcano."},
  {"day":7,"title":"Chidiya Tapu & Leisure","description":"Visit Chidiya Tapu (Bird Island) for sunset point. Afternoon Anthropological Museum and Chatham Saw Mill."},
  {"day":8,"title":"Departure","description":"Breakfast. Transfer to airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Sentinel","stars":3,"location":"Port Blair","image":"https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop"},
  {"name":"Havelock Island Beach Resort","stars":4,"location":"Havelock","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Munjoh Ocean Resort","stars":5,"location":"Havelock","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'andaman-7n-neil-havelock';

-- Ladakh 6N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Leh","description":"Fly into Leh. Rest and acclimatise to the high altitude (3,500m). Short walk to Leh Market and Shanti Stupa at sunset."},
  {"day":2,"title":"Leh Local Sightseeing","description":"Visit Leh Palace, Hall of Fame (Army Museum), Magnetic Hill, Gurudwara Pathar Sahib, and Sangam (Indus-Zanskar confluence)."},
  {"day":3,"title":"Leh to Nubra Valley","description":"Drive over Khardung La (5,359m — world''s highest motorable pass). Descend to Nubra Valley. Camel safari on Hunder sand dunes."},
  {"day":4,"title":"Nubra to Pangong Lake","description":"Drive to Pangong Tso via Shyok Route. Arrive at the stunning blue lake (4,350m). Overnight in lakeside camps."},
  {"day":5,"title":"Pangong to Leh","description":"Sunrise at Pangong Lake. Drive back to Leh via Chang La pass. En route visit Hemis Monastery and Thiksey Monastery."},
  {"day":6,"title":"Leisure & Markets","description":"Free morning for shopping — Pashmina shawls, turquoise jewellery, Ladakhi souvenirs. Visit Stok Palace Museum."},
  {"day":7,"title":"Departure","description":"Early morning transfer to Leh Airport. Depart with Himalayan memories."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Ladakh Residency","stars":3,"location":"Leh","image":"https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&h=300&fit=crop"},
  {"name":"The Grand Dragon","stars":4,"location":"Leh","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"The Chamba Camp Thiksey","stars":5,"location":"Thiksey","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'ladakh-6n-leh-nubra-pangong';

-- Ladakh 8N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Leh","description":"Arrive and acclimatise. Light walk to Shanti Stupa for sunset views over Leh town."},
  {"day":2,"title":"Leh Sightseeing","description":"Leh Palace, Namgyal Tsemo, Hall of Fame, Magnetic Hill, Sangam confluence point, and Gurudwara Pathar Sahib."},
  {"day":3,"title":"Leh to Nubra Valley","description":"Cross Khardung La pass. Hunder sand dunes camel safari. Diskit Monastery with giant Maitreya Buddha statue."},
  {"day":4,"title":"Nubra Valley to Turtuk","description":"Drive to Turtuk — India''s last village before Pakistan border. Explore Balti culture, apricot orchards, and ancient mosque."},
  {"day":5,"title":"Nubra to Pangong Lake","description":"Drive to Pangong via Shyok road. Stunning blue lake stretching into Tibet. Overnight camp by the lake."},
  {"day":6,"title":"Pangong to Tso Moriri","description":"Drive to the remote Tso Moriri Lake via Chumur route. Spot Tibetan wild ass and migratory birds."},
  {"day":7,"title":"Tso Moriri to Leh","description":"Morning by the lake. Drive back to Leh via Chumathang hot springs and Hemis Monastery."},
  {"day":8,"title":"Rafting & Leisure","description":"Morning Indus River rafting from Phey to Nimmo. Afternoon free for shopping or Stok Palace visit."},
  {"day":9,"title":"Departure","description":"Transfer to Leh Airport. Departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Omasila","stars":3,"location":"Leh","image":"https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&h=300&fit=crop"},
  {"name":"The Zen Ladakh","stars":4,"location":"Leh","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"The Ultimate Travelling Camp","stars":5,"location":"Nubra","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'ladakh-8n-complete';

-- Sikkim 5N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Gangtok","description":"Arrive at Bagdogra Airport. Scenic drive to Gangtok (4 hrs). Evening MG Marg walk and local food tasting."},
  {"day":2,"title":"Gangtok Sightseeing","description":"Visit Rumtek Monastery, Do Drul Chorten, Namgyal Institute of Tibetology, and Ganesh Tok viewpoint."},
  {"day":3,"title":"Tsomgo Lake & Baba Mandir","description":"Excursion to Tsomgo Lake (12,400 ft) and Baba Harbhajan Singh Mandir. Yak ride at the frozen lake."},
  {"day":4,"title":"Gangtok to Pelling","description":"Drive to Pelling (5 hrs). En route visit Temi Tea Garden. Evening Pelling Skywalk with Kanchenjunga views."},
  {"day":5,"title":"Pelling Sightseeing","description":"Pemayangtse Monastery, Rabdentse Ruins, Kanchenjunga Falls, and Khecheopalri Wishing Lake."},
  {"day":6,"title":"Departure","description":"Drive to Bagdogra Airport (5 hrs). Departure with Himalayan memories."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Sonam Delek","stars":3,"location":"Gangtok","image":"https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=400&h=300&fit=crop"},
  {"name":"Mayfair Gangtok","stars":4,"location":"Gangtok","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Elgin Nor-Khill","stars":5,"location":"Gangtok","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'sikkim-5n-gangtok-pelling';

-- Bhutan 5N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Paro","description":"Fly into Paro with stunning Himalayan views on descent. Visit Paro Rinpung Dzong and National Museum. Evening town walk."},
  {"day":2,"title":"Tiger''s Nest Hike","description":"Hike to Taktsang Monastery (Tiger''s Nest) — Bhutan''s most iconic site at 3,120m. 5-6 hour round trip through pine forests."},
  {"day":3,"title":"Paro to Thimphu","description":"Drive to capital Thimphu (1.5 hrs). Visit Buddha Dordenma (169 ft statue), Memorial Chorten, Tashichho Dzong, and Folk Heritage Museum."},
  {"day":4,"title":"Thimphu to Punakha","description":"Cross Dochula Pass (3,100m) with 108 memorial chortens and Himalayan panorama. Visit magnificent Punakha Dzong at river confluence."},
  {"day":5,"title":"Punakha to Paro","description":"Morning visit Chimi Lhakhang (Fertility Temple). Drive back to Paro via Thimphu. Evening farewell dinner."},
  {"day":6,"title":"Departure","description":"Transfer to Paro Airport. Depart Bhutan."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Olathang","stars":3,"location":"Paro","image":"https://images.unsplash.com/photo-1553856622-d1b352e9a211?w=400&h=300&fit=crop"},
  {"name":"Le Meridien Thimphu","stars":4,"location":"Thimphu","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Uma by COMO Paro","stars":5,"location":"Paro","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'bhutan-5n-thimphu-paro-punakha';

-- Vietnam 6N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Hanoi","description":"Arrive at Noi Bai Airport. Transfer to Old Quarter hotel. Evening street food walking tour — pho, bun cha, egg coffee."},
  {"day":2,"title":"Hanoi City Tour","description":"Ho Chi Minh Mausoleum, Temple of Literature, Hoan Kiem Lake, Ngoc Son Temple. Evening water puppet show."},
  {"day":3,"title":"Ha Long Bay Cruise","description":"Drive to Ha Long Bay. Board overnight cruise. Kayaking through limestone karsts, swimming, and cave exploration. Sunset on deck."},
  {"day":4,"title":"Ha Long Bay to Hoi An","description":"Morning tai chi on cruise deck. Disembark and fly to Da Nang. Transfer to Hoi An ancient town. Evening lantern-lit streets walk."},
  {"day":5,"title":"Hoi An Exploration","description":"Walking tour of Japanese Bridge, Chinese Assembly Halls, and silk shops. Afternoon cooking class or Basket Boat ride at Cam Thanh."},
  {"day":6,"title":"Marble Mountains & Leisure","description":"Morning Marble Mountains excursion. Afternoon free for tailoring pickup, An Bang Beach, or spa."},
  {"day":7,"title":"Departure","description":"Transfer to Da Nang Airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hanoi La Siesta","stars":3,"location":"Hanoi","image":"https://images.unsplash.com/photo-1528127269322-539801943592?w=400&h=300&fit=crop"},
  {"name":"Allegro Hoi An","stars":4,"location":"Hoi An","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Four Seasons Nam Hai","stars":5,"location":"Hoi An","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'vietnam-6n-hanoi-halong-hoian';

-- Japan 7N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Tokyo","description":"Arrive at Narita/Haneda Airport. Activate Japan Rail Pass. Transfer to hotel in Shinjuku. Evening Shibuya crossing and Harajuku walk."},
  {"day":2,"title":"Tokyo Highlights","description":"Senso-ji Temple in Asakusa, Meiji Shrine, Akihabara electronics district. Afternoon at teamLab Borderless. Evening Shinjuku Golden Gai."},
  {"day":3,"title":"Mount Fuji Day Trip","description":"Bullet train to Hakone area. Visit Fuji Five Lakes, Chureito Pagoda for iconic Fuji views. Onsen (hot spring) experience."},
  {"day":4,"title":"Tokyo to Kyoto","description":"Shinkansen to Kyoto (2.5 hrs). Visit Fushimi Inari (10,000 torii gates), Kiyomizu-dera Temple. Evening Gion geisha district walk."},
  {"day":5,"title":"Kyoto Temples & Culture","description":"Arashiyama Bamboo Grove, Golden Pavilion (Kinkaku-ji), Nijo Castle. Traditional tea ceremony experience."},
  {"day":6,"title":"Nara Day Trip","description":"Train to Nara. Todai-ji Temple with Great Buddha, friendly deer park, Kasuga Taisha Shrine. Return to Kyoto."},
  {"day":7,"title":"Kyoto to Osaka","description":"Train to Osaka. Osaka Castle visit. Afternoon in Dotonbori — street food paradise (takoyaki, okonomiyaki). Evening Shinsekai area."},
  {"day":8,"title":"Departure from Osaka","description":"Morning free for last shopping at Shinsaibashi. Transfer to Kansai Airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Tokyu Stay Shinjuku","stars":3,"location":"Tokyo","image":"https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=300&fit=crop"},
  {"name":"Hotel Granvia Kyoto","stars":4,"location":"Kyoto","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"The Ritz-Carlton Osaka","stars":5,"location":"Osaka","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'japan-7n-tokyo-kyoto-osaka';

-- Switzerland 6N
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Zurich","description":"Arrive at Zurich Airport. City walk — Bahnhofstrasse, Lake Zurich, Old Town. Activate Swiss Travel Pass."},
  {"day":2,"title":"Zurich to Lucerne","description":"Train to Lucerne (1 hr). Chapel Bridge, Lion Monument, and Lake Lucerne cruise. Optional Mt. Pilatus golden round trip."},
  {"day":3,"title":"Lucerne to Interlaken","description":"Golden Pass train to Interlaken through stunning scenery. Afternoon Harder Kulm funicular for panoramic views of Eiger, Mönch & Jungfrau."},
  {"day":4,"title":"Jungfraujoch — Top of Europe","description":"Train to Jungfraujoch (3,454m). Visit Ice Palace, Sphinx observation deck, Aletsch Glacier views. Return to Interlaken."},
  {"day":5,"title":"Interlaken Adventure","description":"Free day for adventure — paragliding, skydiving, or lake cruise. Visit Grindelwald First for cliff walk. Evening in town."},
  {"day":6,"title":"Rhine Falls & Zurich","description":"Day trip to Rhine Falls (Europe''s largest waterfall). Return to Zurich for last-minute shopping and farewell dinner."},
  {"day":7,"title":"Departure","description":"Transfer to Zurich Airport. Departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Alpina Lucerne","stars":3,"location":"Lucerne","image":"https://images.unsplash.com/photo-1527668752968-14dc70a27c95?w=400&h=300&fit=crop"},
  {"name":"Victoria Jungfrau","stars":4,"location":"Interlaken","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"The Dolder Grand","stars":5,"location":"Zurich","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'switzerland-6n-zurich-lucerne-interlaken';

-- Remaining packages — shorter itineraries
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Paris","description":"Arrive at CDG Airport. Transfer to hotel. Evening Eiffel Tower illumination and Seine River walk."},
  {"day":2,"title":"Paris Icons","description":"Eiffel Tower summit, Arc de Triomphe, Champs-Élysées. Afternoon Louvre Museum guided tour. Evening Montmartre & Sacré-Cœur."},
  {"day":3,"title":"Versailles Day Trip","description":"Full day at Palace of Versailles — Hall of Mirrors, gardens, Marie Antoinette''s Estate. Evening Latin Quarter dinner."},
  {"day":4,"title":"Paris to Nice","description":"TGV to Nice (5.5 hrs). Promenade des Anglais walk, Old Town exploration, and Cours Saleya flower market."},
  {"day":5,"title":"French Riviera","description":"Day trip along the Côte d''Azur — Èze village, Monaco, Monte Carlo Casino. Afternoon in Cannes."},
  {"day":6,"title":"Nice Leisure","description":"Morning at Nice beaches. Afternoon Matisse Museum or Cimiez Monastery gardens. Farewell dinner with Niçoise cuisine."},
  {"day":7,"title":"Departure","description":"Transfer to Nice Airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Tourisme Paris","stars":3,"location":"Paris","image":"https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&h=300&fit=crop"},
  {"name":"Hyatt Regency Paris","stars":4,"location":"Paris","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Le Negresco Nice","stars":5,"location":"Nice","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'france-6n-paris-nice';

-- Remaining packages with basic itineraries
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Sydney","description":"Airport transfer. Afternoon Sydney Harbour Bridge walk and Opera House exterior tour. Evening Darling Harbour dinner."},
  {"day":2,"title":"Sydney Exploration","description":"Sydney Opera House guided tour, Bondi to Coogee coastal walk. Afternoon Taronga Zoo ferry ride. Evening The Rocks area."},
  {"day":3,"title":"Blue Mountains Day Trip","description":"Three Sisters lookout, Scenic Railway, and bushwalking. Visit Featherdale Wildlife Park for koala encounter."},
  {"day":4,"title":"Fly to Melbourne","description":"Morning flight. Afternoon Melbourne laneways and street art tour. Evening at Federation Square and Southbank."},
  {"day":5,"title":"Great Ocean Road","description":"Full day drive — Twelve Apostles, Loch Ard Gorge, London Arch, koala spotting at Kennett River."},
  {"day":6,"title":"Melbourne Culture","description":"Queen Victoria Market, Royal Botanic Gardens, MCG tour. Afternoon in trendy Fitzroy for coffee and vintage shopping."},
  {"day":7,"title":"Phillip Island","description":"Day trip to Phillip Island for the famous Penguin Parade at sunset. Visit Churchill Island Heritage Farm."},
  {"day":8,"title":"Departure","description":"Transfer to Melbourne Airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Travelodge Sydney","stars":3,"location":"Sydney","image":"https://images.unsplash.com/photo-1529108190281-9a4f620bc2d8?w=400&h=300&fit=crop"},
  {"name":"Pullman Melbourne","stars":4,"location":"Melbourne","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Park Hyatt Sydney","stars":5,"location":"Sydney","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'australia-7n-sydney-melbourne';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Auckland","description":"Airport transfer. Sky Tower visit for panoramic views. Evening Viaduct Harbour waterfront dinner."},
  {"day":2,"title":"Hobbiton & Rotorua","description":"Drive to Hobbiton Movie Set tour. Continue to Rotorua. Te Puia geothermal park — geysers and Māori cultural performance."},
  {"day":3,"title":"Rotorua Adventures","description":"Wai-O-Tapu thermal wonderland, Redwoods Treewalk, and optional luge rides. Evening Polynesian Spa soak."},
  {"day":4,"title":"Fly to Queenstown","description":"Flight to Queenstown. Afternoon Skyline Gondola and luge. Evening Fergburger and lakefront walk."},
  {"day":5,"title":"Milford Sound Cruise","description":"Full day cruise through Milford Sound — waterfalls, dolphins, seals, and sheer cliff faces. One of the world''s most scenic fjords."},
  {"day":6,"title":"Queenstown Adventure Day","description":"Choose your adventure — bungee at Kawarau Bridge, jet boat on Shotover River, or skydiving. Afternoon Arrowtown heritage village."},
  {"day":7,"title":"Wanaka & Glaciers","description":"Drive to Wanaka. Famous Wanaka Tree, Puzzling World. Continue to Fox/Franz Josef Glacier area (helicopter option)."},
  {"day":8,"title":"Departure","description":"Transfer to Queenstown Airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Scenic Hotel Auckland","stars":3,"location":"Auckland","image":"https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=400&h=300&fit=crop"},
  {"name":"Millennium Queenstown","stars":4,"location":"Queenstown","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Eichardt''s Private Hotel","stars":5,"location":"Queenstown","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'new-zealand-7n-north-south';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Nairobi","description":"Arrive at JKIA. Transfer to hotel. Afternoon Nairobi National Park game drive — lions with city skyline backdrop."},
  {"day":2,"title":"Nairobi to Amboseli","description":"Drive to Amboseli National Park. Afternoon game drive with Mount Kilimanjaro views. Elephant herds and wildebeest sightings."},
  {"day":3,"title":"Amboseli Full Day Safari","description":"Morning and afternoon game drives. Spot lions, cheetahs, zebras, giraffes. Visit Maasai village for cultural experience."},
  {"day":4,"title":"Amboseli to Lake Nakuru","description":"Drive to Lake Nakuru National Park. Famous for flamingos, rhinos, and leopards. Afternoon game drive."},
  {"day":5,"title":"Lake Nakuru to Masai Mara","description":"Drive to the legendary Masai Mara. Afternoon game drive — Big Five territory. Sundowner drinks on the savannah."},
  {"day":6,"title":"Masai Mara Full Day","description":"Full day game drives. Optional hot air balloon safari at dawn. Mara River crossing point. Bush dinner under the stars."},
  {"day":7,"title":"Departure via Nairobi","description":"Morning game drive. Drive or fly back to Nairobi. Transfer to JKIA for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Sentrim Amboseli Lodge","stars":3,"location":"Amboseli","image":"https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400&h=300&fit=crop"},
  {"name":"Mara Serena Safari Lodge","stars":4,"location":"Masai Mara","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Angama Mara","stars":5,"location":"Masai Mara","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'kenya-6n-safari';

-- India domestic packages
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Dehradun","description":"Arrive at Jolly Grant Airport. Drive to Mussoorie (1.5 hrs). Evening Mall Road walk and Camel''s Back Road sunset."},
  {"day":2,"title":"Mussoorie Sightseeing","description":"Kempty Falls, Gun Hill by cable car, Company Garden, and Lal Tibba viewpoint. Evening Landour bakehouse visit."},
  {"day":3,"title":"Mussoorie to Rishikesh","description":"Drive to Rishikesh (3 hrs). Visit Ram Jhula, Laxman Jhula, Beatles Ashram. Evening Triveni Ghat Ganga Aarti."},
  {"day":4,"title":"Rishikesh Adventure","description":"Morning white water rafting on the Ganges. Afternoon bungee jumping or cliff jumping option. Evening yoga session."},
  {"day":5,"title":"Rishikesh to Haridwar","description":"Drive to Haridwar (45 min). Visit Mansa Devi Temple by cable car, Chandi Devi. Evening Har Ki Pauri Ganga Aarti."},
  {"day":6,"title":"Departure","description":"Morning visit Rajaji National Park for jungle safari. Transfer to Dehradun Airport."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Padmini Nivas","stars":3,"location":"Mussoorie","image":"https://images.unsplash.com/photo-1588083949404-c4f1ed1323b3?w=400&h=300&fit=crop"},
  {"name":"JW Marriott Mussoorie","stars":4,"location":"Mussoorie","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Taj Rishikesh","stars":5,"location":"Rishikesh","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'uttarakhand-5n-mussoorie-rishikesh';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Shimla","description":"Arrive at Chandigarh/Shimla. Transfer to hotel. Evening Mall Road walk, Christ Church, and Ridge."},
  {"day":2,"title":"Shimla Sightseeing","description":"Kufri adventure (horse riding, yak ride), Jakhoo Temple, and Indian Institute of Advanced Study. Evening Lakkar Bazaar shopping."},
  {"day":3,"title":"Shimla to Manali","description":"Scenic drive to Manali (7-8 hrs) through Kullu Valley. En route stop at Pandoh Dam and Vaishno Devi Temple Kullu."},
  {"day":4,"title":"Manali Local Tour","description":"Hadimba Temple, Manu Temple, Vashisht Hot Springs, Tibetan Monastery, and Club House. Evening Old Manali cafes."},
  {"day":5,"title":"Solang Valley","description":"Full day at Solang Valley — paragliding, zorbing, rope activities. Winter: skiing and snowboarding."},
  {"day":6,"title":"Rohtang Pass / Atal Tunnel","description":"Excursion to Rohtang Pass (permit required) or Sissu via Atal Tunnel. Snow point activities and stunning views."},
  {"day":7,"title":"Departure","description":"Morning Kullu river rafting option. Transfer to Chandigarh/Bhuntar Airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Willow Banks","stars":3,"location":"Shimla","image":"https://images.unsplash.com/photo-1598977741571-78c84b92e5f8?w=400&h=300&fit=crop"},
  {"name":"Span Resort Manali","stars":4,"location":"Manali","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"The Himalayan Manali","stars":5,"location":"Manali","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'himachal-6n-shimla-manali';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Kathmandu","description":"Arrive at Tribhuvan Airport. Transfer to Thamel hotel. Evening Thamel market walk and Nepali dinner."},
  {"day":2,"title":"Kathmandu Valley","description":"Pashupatinath Temple, Boudhanath Stupa, Swayambhunath (Monkey Temple), and Kathmandu Durbar Square."},
  {"day":3,"title":"Fly to Pokhara","description":"Scenic mountain flight to Pokhara. Afternoon Phewa Lake boating, Davis Falls, Gupteshwor Cave. Evening lakeside stroll."},
  {"day":4,"title":"Sarangkot & Pokhara","description":"Pre-dawn drive to Sarangkot for Annapurna sunrise. Visit International Mountain Museum, Peace Pagoda, and paragliding option."},
  {"day":5,"title":"Pokhara to Kathmandu","description":"Fly back to Kathmandu. Afternoon Patan Durbar Square and Bhaktapur pottery area. Evening farewell dinner."},
  {"day":6,"title":"Departure","description":"Transfer to airport. Optional early morning Everest scenic flight (subject to weather)."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Yak & Yeti","stars":3,"location":"Kathmandu","image":"https://images.unsplash.com/photo-1507743617593-0a422c9bb7f5?w=400&h=300&fit=crop"},
  {"name":"Temple Tree Resort","stars":4,"location":"Pokhara","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Dwarika''s Hotel","stars":5,"location":"Kathmandu","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'nepal-5n-kathmandu-pokhara';

-- Central Asia & Europe
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Almaty","description":"Airport transfer. Green Bazaar visit, Panfilov Park, Zenkov Cathedral. Evening Kok-Tobe hill cable car for city views."},
  {"day":2,"title":"Big Almaty Lake & Mountains","description":"Drive to Big Almaty Lake (2,500m) — turquoise glacial lake. Visit Medeu skating rink and Shymbulak ski resort by gondola."},
  {"day":3,"title":"Charyn Canyon","description":"Full day trip to Charyn Canyon — Kazakhstan''s Grand Canyon. Hike through Valley of Castles. Picnic lunch by the river."},
  {"day":4,"title":"Fly to Astana","description":"Flight to capital Astana. Baiterek Tower, Khan Shatyr mall, Hazrat Sultan Mosque. Futuristic cityscape tour."},
  {"day":5,"title":"Astana Sightseeing","description":"National Museum, EXPO site, Palace of Peace and Reconciliation pyramid. Evening Ishim River embankment walk."},
  {"day":6,"title":"Departure","description":"Transfer to Astana Airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Rahat Palace Almaty","stars":3,"location":"Almaty","image":"https://images.unsplash.com/photo-1586699253884-e199770f63b9?w=400&h=300&fit=crop"},
  {"name":"Rixos Almaty","stars":4,"location":"Almaty","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"The St. Regis Astana","stars":5,"location":"Astana","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'kazakhstan-5n-almaty-astana';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Moscow","description":"Airport transfer. Evening Red Square walk — St. Basil''s Cathedral and GUM department store illuminated at night."},
  {"day":2,"title":"Moscow Highlights","description":"Kremlin tour (Armoury Chamber, Diamond Fund), Red Square, Lenin Mausoleum. Afternoon Moscow Metro art tour. Evening Bolshoi area."},
  {"day":3,"title":"Moscow Culture","description":"Tretyakov Gallery, Christ the Saviour Cathedral, Gorky Park. Evening river cruise on the Moskva River."},
  {"day":4,"title":"Sapsan to St. Petersburg","description":"High-speed Sapsan train to St. Petersburg (4 hrs). Afternoon Nevsky Prospekt walk, Kazan Cathedral. Evening canal cruise."},
  {"day":5,"title":"St. Petersburg Imperial","description":"Hermitage Museum (Winter Palace), St. Isaac''s Cathedral dome climb, Church of the Savior on Spilled Blood."},
  {"day":6,"title":"Peterhof & Farewell","description":"Hydrofoil to Peterhof Palace — Russian Versailles with golden fountains. Return for final evening at Palace Square."},
  {"day":7,"title":"Departure","description":"Transfer to Pulkovo Airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Izmailovo Delta","stars":3,"location":"Moscow","image":"https://images.unsplash.com/photo-1513326738677-b964603b136d?w=400&h=300&fit=crop"},
  {"name":"Radisson Royal Moscow","stars":4,"location":"Moscow","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Four Seasons St. Petersburg","stars":5,"location":"St. Petersburg","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'russia-6n-moscow-st-petersburg';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Tashkent","description":"Airport transfer. Visit Chorsu Bazaar, Khast Imam Complex (oldest Quran manuscript), and Tashkent Metro (ornate Soviet stations)."},
  {"day":2,"title":"Train to Samarkand","description":"High-speed Afrosiyob train to Samarkand (2 hrs). Afternoon at Registan Square — three magnificent madrasas. Evening light show."},
  {"day":3,"title":"Samarkand Exploration","description":"Shah-i-Zinda necropolis (Avenue of Mausoleums), Bibi-Khanym Mosque, Ulugh Beg Observatory, and Siab Bazaar."},
  {"day":4,"title":"Train to Bukhara","description":"Train to Bukhara (1.5 hrs). Afternoon Lyabi-Hauz ensemble, Ark Fortress, Bolo-Hauz Mosque, and carpet workshop."},
  {"day":5,"title":"Bukhara Old City","description":"Poi Kalyan complex (Kalyan Minaret & Mosque), Chor-Minor, trading domes shopping. Evening rooftop dinner overlooking the old city."},
  {"day":6,"title":"Departure via Tashkent","description":"Train back to Tashkent. Last shopping at Tashkent City Mall. Transfer to airport."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Malika Samarkand","stars":3,"location":"Samarkand","image":"https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=400&h=300&fit=crop"},
  {"name":"Wyndham Tashkent","stars":4,"location":"Tashkent","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Hyatt Regency Tashkent","stars":5,"location":"Tashkent","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'uzbekistan-5n-tashkent-samarkand-bukhara';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Barcelona","description":"Airport transfer. Afternoon La Rambla walk, Boqueria Market food tasting. Evening Gothic Quarter tapas tour."},
  {"day":2,"title":"Barcelona Gaudi Tour","description":"Sagrada Familia guided tour, Park Güell, Casa Batlló. Afternoon Barceloneta Beach. Evening flamenco show."},
  {"day":3,"title":"Montserrat Day Trip","description":"Train to Montserrat monastery. Black Madonna visit, boys'' choir performance, hiking trails with panoramic views."},
  {"day":4,"title":"AVE to Madrid","description":"High-speed train to Madrid (2.5 hrs). Afternoon Prado Museum, Retiro Park boating. Evening Plaza Mayor and Sol."},
  {"day":5,"title":"Madrid Royal Tour","description":"Royal Palace, Almudena Cathedral. Afternoon Santiago Bernabéu Stadium tour. Evening Gran Vía and rooftop bars."},
  {"day":6,"title":"Toledo Day Trip","description":"Day trip to medieval Toledo — Cathedral, Alcázar, El Greco Museum, Synagogue. Famous marzipan tasting. Return to Madrid."},
  {"day":7,"title":"Departure","description":"Transfer to Madrid Barajas Airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel 1898 Barcelona","stars":3,"location":"Barcelona","image":"https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=400&h=300&fit=crop"},
  {"name":"NH Collection Madrid","stars":4,"location":"Madrid","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"The Westin Palace Madrid","stars":5,"location":"Madrid","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'spain-6n-barcelona-madrid';

-- Pilgrimage packages
UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Haridwar","description":"Arrive at Haridwar. Visit Har Ki Pauri for evening Ganga Aarti. Overnight in Haridwar."},
  {"day":2,"title":"Haridwar to Barkot","description":"Drive to Barkot (7 hrs) en route to Yamunotri. Evening at leisure with Himalayan views."},
  {"day":3,"title":"Yamunotri Darshan","description":"Drive to Janki Chatti, trek 6 km to Yamunotri Temple. Holy dip in Surya Kund hot spring. Return to Barkot."},
  {"day":4,"title":"Barkot to Uttarkashi","description":"Drive to Uttarkashi (4 hrs). Visit Vishwanath Temple and Shakti Temple. Overnight in Uttarkashi."},
  {"day":5,"title":"Gangotri Darshan","description":"Drive to Gangotri (3.5 hrs). Darshan at Gangotri Temple — origin of River Ganga. Return to Uttarkashi."},
  {"day":6,"title":"Uttarkashi to Guptkashi","description":"Drive to Guptkashi (8 hrs) via Tehri. Visit Ardh Narishwar Temple. Overnight in Guptkashi."},
  {"day":7,"title":"Kedarnath Darshan","description":"Drive to Sonprayag, trek 16 km to Kedarnath (or helicopter). Darshan at Kedarnath Temple. Overnight near temple."},
  {"day":8,"title":"Kedarnath to Pipalkoti","description":"Trek down from Kedarnath. Drive to Pipalkoti (5 hrs). Rest and overnight."},
  {"day":9,"title":"Badrinath Darshan","description":"Drive to Badrinath (2.5 hrs). Darshan at Badrinath Temple. Visit Mana Village, Vyas Gufa, Bheem Pul. Return to Pipalkoti."},
  {"day":10,"title":"Pipalkoti to Rishikesh","description":"Drive to Rishikesh (8 hrs). Evening Triveni Ghat Aarti. Last night dinner."},
  {"day":11,"title":"Departure","description":"Transfer to Dehradun Airport or Haridwar station. Char Dham Yatra complete."}
]'::jsonb, sample_hotels = '[
  {"name":"GMVN Guesthouses","stars":3,"location":"Various","image":"https://images.unsplash.com/photo-1604928141064-207cea6f571f?w=400&h=300&fit=crop"},
  {"name":"Sarovar Premiere Badrinath","stars":4,"location":"Badrinath","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Leisure Hotels Rishikesh","stars":5,"location":"Rishikesh","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'char-dham-10n-yatra';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Nashik","description":"Arrive in Nashik. Visit Trimbakeshwar Jyotirlinga Temple. Evening aarti and temple town walk."},
  {"day":2,"title":"Nashik to Bhimashankar","description":"Drive to Bhimashankar (4 hrs). Trek to Bhimashankar Jyotirlinga through dense forest. Darshan and return."},
  {"day":3,"title":"Bhimashankar to Pune/Aundha","description":"Drive to Aundha Nagnath (6 hrs). Darshan at Aundha Nagnath Jyotirlinga — one of the oldest temples."},
  {"day":4,"title":"Aundha to Parli Vaijnath","description":"Drive to Parli Vaijnath (3 hrs). Darshan at Vaijnath Jyotirlinga Temple. Evening temple parikrama."},
  {"day":5,"title":"Parli to Shirdi","description":"Drive to Shirdi (6 hrs). Visit Sai Baba Temple, Dwarkamai, Chavadi. Evening aarti."},
  {"day":6,"title":"Departure","description":"Morning darshan. Transfer to Nashik/Pune airport or station."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Padma Nashik","stars":3,"location":"Nashik","image":"https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=400&h=300&fit=crop"},
  {"name":"Radisson Nashik","stars":4,"location":"Nashik","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Express Inn Nashik","stars":5,"location":"Nashik","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'maharashtra-jyotirlinga-5n';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Varanasi","description":"Arrive at Varanasi Airport. Transfer to hotel. Evening boat ride on the Ganges for Dashashwamedh Ghat Ganga Aarti."},
  {"day":2,"title":"Varanasi Temples","description":"Early morning boat ride for sunrise. Visit Kashi Vishwanath Temple, Annapurna Temple, Sankat Mochan. Afternoon Sarnath excursion."},
  {"day":3,"title":"Varanasi to Ayodhya","description":"Drive to Ayodhya (5 hrs). Visit Ram Janmabhoomi Mandir, Hanuman Garhi, Kanak Bhawan. Evening Saryu Ghat aarti."},
  {"day":4,"title":"Ayodhya to Prayagraj","description":"Drive to Prayagraj (3 hrs). Holy dip at Triveni Sangam (confluence of Ganga, Yamuna, Saraswati). Visit Anand Bhawan."},
  {"day":5,"title":"Prayagraj to Gaya","description":"Drive to Bodh Gaya (5 hrs). Visit Mahabodhi Temple (UNESCO), Bodhi Tree where Buddha attained enlightenment. Vishnupad Temple."},
  {"day":6,"title":"Departure from Gaya","description":"Morning pind daan rituals (if applicable). Transfer to Gaya Airport/station for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Surya Varanasi","stars":3,"location":"Varanasi","image":"https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=400&h=300&fit=crop"},
  {"name":"Ramada Plaza Varanasi","stars":4,"location":"Varanasi","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Taj Ganges Varanasi","stars":5,"location":"Varanasi","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'varanasi-circuit-5n';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Madurai","description":"Arrive at Madurai Airport. Evening visit to Meenakshi Amman Temple — one of India''s grandest temples. Witness the night ceremony."},
  {"day":2,"title":"Madurai to Rameswaram","description":"Drive to Rameswaram (3.5 hrs) over Pamban Bridge. Visit Ramanathaswamy Temple (one of 12 Jyotirlingas), Agni Theertham holy bath."},
  {"day":3,"title":"Rameswaram & Dhanushkodi","description":"Visit Dhanushkodi ghost town — India''s last point before Sri Lanka. APJ Abdul Kalam Memorial. Evening temple darshan."},
  {"day":4,"title":"Rameswaram to Kanyakumari","description":"Drive to Kanyakumari (5 hrs). Sunset at the confluence of three oceans. Vivekananda Rock Memorial (if time permits)."},
  {"day":5,"title":"Kanyakumari Sunrise","description":"Early morning sunrise over the ocean. Visit Thiruvalluvar Statue, Vivekananda Rock by ferry, Kumari Amman Temple, Gandhi Memorial."},
  {"day":6,"title":"Kanyakumari to Trivandrum","description":"Optional visit to Padmanabhaswamy Temple, Trivandrum. Transfer to Trivandrum Airport."},
  {"day":7,"title":"Departure","description":"Transfer to airport for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Germanus Madurai","stars":3,"location":"Madurai","image":"https://images.unsplash.com/photo-1621996659490-3275b4d0d951?w=400&h=300&fit=crop"},
  {"name":"Hyatt Rameswaram","stars":4,"location":"Rameswaram","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Sparsa Resort Kanyakumari","stars":5,"location":"Kanyakumari","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'south-india-temples-6n';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Indore/Ujjain","description":"Arrive at Indore Airport. Transfer to Ujjain. Evening Mahakaleshwar Temple darshan and Kshipra River aarti."},
  {"day":2,"title":"Ujjain Temples & Bhasma Aarti","description":"Pre-dawn Bhasma Aarti at Mahakaleshwar (4 AM). Visit Kal Bhairav Temple, Harsiddhi Temple, Ram Ghat."},
  {"day":3,"title":"Ujjain to Omkareshwar","description":"Drive to Omkareshwar (3 hrs). Visit Omkareshwar Jyotirlinga on island shaped like Om. Parikrama of the island. Evening aarti."},
  {"day":4,"title":"Departure","description":"Morning darshan. Drive to Indore Airport (2.5 hrs) for departure."}
]'::jsonb, sample_hotels = '[
  {"name":"Hotel Avnika Ujjain","stars":3,"location":"Ujjain","image":"https://images.unsplash.com/photo-1624461050280-4807e15a6e88?w=400&h=300&fit=crop"},
  {"name":"Radisson Ujjain","stars":4,"location":"Ujjain","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"Marriott Indore","stars":5,"location":"Indore","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'omkareshwar-mahakaleswar-3n';

UPDATE website_packages SET itinerary_days = '[
  {"day":1,"title":"Arrival in Haridwar","description":"Arrive at Haridwar. Evening Har Ki Pauri Ganga Aarti. Overnight in Haridwar."},
  {"day":2,"title":"Haridwar to Guptkashi","description":"Drive to Guptkashi (8 hrs) through scenic Himalayan roads. Visit Ardh Narishwar Temple. Overnight."},
  {"day":3,"title":"Kedarnath Trek","description":"Drive to Sonprayag, then Gaurikund. Trek 16 km to Kedarnath (or helicopter option). Evening darshan if time permits."},
  {"day":4,"title":"Kedarnath Darshan","description":"Early morning darshan at Kedarnath Temple (one of 12 Jyotirlingas). Visit Adi Shankaracharya Samadhi. Trek back down."},
  {"day":5,"title":"Guptkashi to Joshimath","description":"Drive to Joshimath (6 hrs). Visit Narsingh Temple and Shankaracharya Math. Rest and prepare for Badrinath."},
  {"day":6,"title":"Badrinath Darshan","description":"Drive to Badrinath (1.5 hrs). Darshan at Badrinath Temple. Visit Tapt Kund hot spring, Mana Village, Vyas Gufa, Bheem Pul."},
  {"day":7,"title":"Departure via Rishikesh","description":"Drive to Rishikesh/Haridwar (10 hrs). Evening Ganga Aarti. Transfer to station/airport."}
]'::jsonb, sample_hotels = '[
  {"name":"GMVN Tourist Rest House","stars":3,"location":"Guptkashi","image":"https://images.unsplash.com/photo-1572978122341-d42368429b55?w=400&h=300&fit=crop"},
  {"name":"Sarovar Portico Badrinath","stars":4,"location":"Badrinath","image":"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"},
  {"name":"JW Marriott Mussoorie","stars":5,"location":"Post-trip Mussoorie","image":"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop"}
]'::jsonb WHERE slug = 'kedarnath-badrinath-6n';
