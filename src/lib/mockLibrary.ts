// Mock content library for Silent Harvesting
// Hotels and itinerary blocks tagged by city_id (using city name as id for simplicity)

export interface LibraryHotel {
  id: string;
  name: string;
  city_id: string;
  description?: string;
  star_rating?: number;
}

export interface LibraryItineraryBlock {
  id: string;
  title: string;
  city_id: string;
  description?: string;
}

export const libraryHotels: LibraryHotel[] = [
  { id: '1', name: 'Taj Palace', city_id: 'delhi', description: 'Luxury 5-star hotel in the heart of New Delhi', star_rating: 5 },
  { id: '2', name: 'The Oberoi', city_id: 'delhi', description: 'Iconic luxury hotel on Zakir Hussain Marg', star_rating: 5 },
  { id: '3', name: 'ITC Maurya', city_id: 'delhi', description: 'Grand luxury hotel with award-winning dining', star_rating: 5 },
  { id: '4', name: 'Taj Lake Palace', city_id: 'udaipur', description: 'Floating palace hotel on Lake Pichola', star_rating: 5 },
  { id: '5', name: 'The Oberoi Udaivilas', city_id: 'udaipur', description: 'Sprawling luxury resort with lake views', star_rating: 5 },
  { id: '6', name: 'Taj Mahal Palace', city_id: 'mumbai', description: 'Iconic heritage hotel overlooking the Gateway of India', star_rating: 5 },
  { id: '7', name: 'The Leela Palace', city_id: 'jaipur', description: 'Royal luxury hotel with Rajasthani architecture', star_rating: 5 },
  { id: '8', name: 'Rambagh Palace', city_id: 'jaipur', description: 'Former royal residence turned luxury hotel', star_rating: 5 },
  { id: '9', name: 'Wildflower Hall', city_id: 'shimla', description: 'Mountain retreat in the Himalayas', star_rating: 5 },
  { id: '10', name: 'Kumarakom Lake Resort', city_id: 'kumarakom', description: 'Luxury backwater resort in Kerala', star_rating: 5 },
  { id: '11', name: 'Brunton Boatyard', city_id: 'kochi', description: 'Heritage hotel on Fort Kochi waterfront', star_rating: 4 },
  { id: '12', name: 'Evolve Back', city_id: 'coorg', description: 'Luxury plantation resort', star_rating: 5 },
];

export const libraryItineraryBlocks: LibraryItineraryBlock[] = [
  { id: '1', title: 'Old Delhi Heritage Walk', city_id: 'delhi', description: 'Explore Chandni Chowk, Jama Masjid, and the spice markets on a guided walking tour.' },
  { id: '2', title: 'New Delhi Monuments Tour', city_id: 'delhi', description: 'Visit India Gate, Humayun\'s Tomb, Qutub Minar, and Lotus Temple.' },
  { id: '3', title: 'City Palace & Lake Pichola', city_id: 'udaipur', description: 'Explore the grand City Palace complex and enjoy a boat ride on Lake Pichola.' },
  { id: '4', title: 'Amber Fort & Jaipur City Tour', city_id: 'jaipur', description: 'Visit Amber Fort, Hawa Mahal, City Palace, and Jantar Mantar.' },
  { id: '5', title: 'Gateway of India & Elephanta Caves', city_id: 'mumbai', description: 'Ferry to Elephanta Caves, explore Colaba, and visit the Gateway of India.' },
  { id: '6', title: 'Backwater Houseboat Cruise', city_id: 'kumarakom', description: 'Full-day houseboat cruise through Kerala backwaters with traditional lunch.' },
  { id: '7', title: 'Fort Kochi Walking Tour', city_id: 'kochi', description: 'Chinese fishing nets, St. Francis Church, Jewish Synagogue, and spice markets.' },
  { id: '8', title: 'Coffee Plantation Visit', city_id: 'coorg', description: 'Guided tour of coffee and spice plantations with tasting session.' },
  { id: '9', title: 'Mall Road & Ridge Walk', city_id: 'shimla', description: 'Stroll along the colonial-era Mall Road and visit Christ Church.' },
  { id: '10', title: 'Sunset at Monsoon Palace', city_id: 'udaipur', description: 'Drive up to Sajjangarh Palace for panoramic sunset views over the city.' },
];

// Silent Harvester: upsert new entries found in proposal data
export function harvestLibraryContent(payload: {
  hotels?: Array<{ name: string; city: string; description?: string }>;
  itineraryDays?: Array<{ title?: string; city?: string; description?: string }>;
}) {
  const { hotels = [], itineraryDays = [] } = payload;

  // Harvest hotels
  for (const h of hotels) {
    if (!h.name || !h.city) continue;
    const cityId = h.city.trim().toLowerCase();
    const exists = libraryHotels.find(
      (lh) => lh.name.toLowerCase() === h.name.trim().toLowerCase() && lh.city_id === cityId
    );
    if (!exists) {
      const newEntry: LibraryHotel = {
        id: crypto.randomUUID(),
        name: h.name.trim(),
        city_id: cityId,
        description: h.description,
      };
      libraryHotels.push(newEntry);
      console.log('[Silent Harvester] New hotel added to library:', newEntry.name, '(', cityId, ')');
    }
  }

  // Harvest itinerary blocks
  for (const day of itineraryDays) {
    if (!day.title || !day.city) continue;
    const cityId = day.city.trim().toLowerCase();
    const exists = libraryItineraryBlocks.find(
      (lb) => lb.title.toLowerCase() === day.title!.trim().toLowerCase() && lb.city_id === cityId
    );
    if (!exists) {
      const newEntry: LibraryItineraryBlock = {
        id: crypto.randomUUID(),
        title: day.title.trim(),
        city_id: cityId,
        description: day.description,
      };
      libraryItineraryBlocks.push(newEntry);
      console.log('[Silent Harvester] New itinerary block added to library:', newEntry.title, '(', cityId, ')');
    }
  }
}

// Get filtered suggestions for comboboxes
export function getHotelSuggestions(cityId: string): LibraryHotel[] {
  if (!cityId) return libraryHotels;
  return libraryHotels.filter((h) => h.city_id === cityId.trim().toLowerCase());
}

export function getItinerarySuggestions(cityId: string): LibraryItineraryBlock[] {
  if (!cityId) return libraryItineraryBlocks;
  return libraryItineraryBlocks.filter((b) => b.city_id === cityId.trim().toLowerCase());
}
