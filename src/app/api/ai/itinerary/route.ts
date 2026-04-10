import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BASE_SYSTEM = `You are a professional travel itinerary writer. Strictly follow day type constraints. Do not add activities, meals, or experiences beyond what is specified. The heading is your only source of truth.`;

export async function POST(request: NextRequest) {
  const { day_number, destination, city, hotel, activities, raw_description, existing_heading, day_type } = await request.json();

  let systemPrompt: string;
  let userContent: string;

  const cityStr = city || destination || '';

  if (raw_description) {
    // Rephrase existing DMC text — do NOT add or remove content
    systemPrompt = `${BASE_SYSTEM} Rephrase the provided day itinerary into polished engaging prose. Do NOT add any activity, place, meal or inclusion not in the source. Do NOT remove anything mentioned. Only improve grammar, flow and tone. Write in second person. Output JSON: {"heading": "<5–7 word heading>", "description": "<3–5 sentences>"}`;
    userContent = `Rephrase this Day ${day_number} itinerary text for ${cityStr}:\n\n${raw_description}`;
  } else if (day_type === 'arrival') {
    systemPrompt = `${BASE_SYSTEM} For ARRIVAL days: ONLY write about airport pickup, hotel transfer, check-in, and a brief evening orientation note. No full sightseeing. No meals beyond a welcome dinner mention. Max 2–3 sentences. Output JSON: {"heading": "<5–7 word heading starting with Arrival in...>", "description": "<2–3 sentences>"}`;
    userContent = `Write Day ${day_number} ARRIVAL in ${cityStr}.${hotel ? ` Hotel: ${hotel}.` : ''}`;
  } else if (day_type === 'departure') {
    systemPrompt = `${BASE_SYSTEM} For DEPARTURE days: ONLY write about breakfast at hotel, checkout, and airport transfer. Mention flight time if available. Max 3–4 sentences. No sightseeing. No activities after checkout. Output JSON: {"heading": "<5–7 word heading starting with Departure from...>", "description": "<3–4 sentences>"}`;
    userContent = `Write Day ${day_number} DEPARTURE from ${cityStr}.`;
  } else if (day_type === 'transfer') {
    systemPrompt = `${BASE_SYSTEM} For TRANSFER days: ONLY write about morning checkout from the first city, the journey to the next city with brief scenic highlights en route, and check-in at the next city. An optional brief stop is allowed only if it fits naturally. Output JSON: {"heading": "<5–7 word heading e.g. Transfer to City B>", "description": "<3–4 sentences>"}`;
    userContent = `Write Day ${day_number} TRANSFER day. City context: ${cityStr}.${hotel ? ` Next hotel: ${hotel}.` : ''}`;
  } else if (day_type === 'flight') {
    systemPrompt = `${BASE_SYSTEM} For FLIGHT days: ONLY write about hotel checkout, airport transfer, the flight itself, landing, transfer from airport to new hotel, and check-in. No activities or sightseeing. Output JSON: {"heading": "<5–7 word heading e.g. Flying to City B>", "description": "<3–4 sentences>"}`;
    userContent = `Write Day ${day_number} FLIGHT day. City context: ${cityStr}.${hotel ? ` New hotel: ${hotel}.` : ''}`;
  } else if (existing_heading) {
    // Tour day with heading — generate description AND return a corrected/formatted heading
    systemPrompt = `${BASE_SYSTEM} For TOUR days: The heading is your ONLY source of truth. Write ONLY about exact places named in the heading — no additional sites, meals, or experiences. 4–6 sentences max. Use real landmarks and local food ONLY for those specific places. ALSO correct and format the heading: apply proper Title Case and add commas/ampersands between place names (e.g. "tanah lot taman ayun ulun danu" → "Tanah Lot, Taman Ayun & Ulun Danu"). Output JSON: {"heading": "<corrected heading in Title Case>", "description": "<4–6 sentences about those specific places only>"}`;
    userContent = `Day ${day_number} tour heading: "${existing_heading}"\nCity: ${cityStr}${destination && city && city !== destination ? `\nDestination: ${destination}` : ''}${hotel ? `\nHotel: ${hotel}` : ''}${activities?.length ? `\nActivities context: ${(activities as string[]).filter(Boolean).join(', ')}` : ''}`;
  } else {
    // No heading, no specific type — generate both heading and description
    systemPrompt = `${BASE_SYSTEM} Write a rich, vivid day itinerary entry. Reference actual landmarks, local experiences, and meal suggestions relevant to the specific city. Write in second person. Be specific — mention actual famous sites, local dishes, and authentic experiences. Do NOT invent hotels, prices, or activities not provided. Output JSON: {"heading": "<5–8 word heading>", "description": "<3–5 sentences of engaging prose>"}`;
    const activityList = (activities || [])
      .filter(Boolean)
      .map((a: unknown) => {
        if (typeof a === 'string') return a;
        if (a && typeof a === 'object') {
          const obj = a as Record<string, unknown>;
          return obj.title || obj.from_location || obj.name || '';
        }
        return '';
      })
      .filter(Boolean)
      .join(', ');

    userContent = `Write Day ${day_number} itinerary for ${destination}.${city ? ` City: ${city}.` : ''}${hotel ? ` Hotel: ${hotel}.` : ''}${activityList ? ` Activities: ${activityList}.` : ''} Reference real landmarks and local experiences for this city.`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.65,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content || '{}';
  return NextResponse.json(JSON.parse(content));
}
