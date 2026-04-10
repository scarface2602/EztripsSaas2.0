import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Used when no heading exists — generate both heading and description
const GENERATE_BOTH_PROMPT = `You are a professional travel writer. Write a rich, vivid day itinerary entry. Reference actual landmarks, local experiences, and meal suggestions relevant to the specific city. Write in second person. Be specific — mention actual famous sites, local dishes, and authentic experiences. Do NOT invent hotels, prices, or activities not provided. Output JSON: {"heading": "<5–8 word heading>", "description": "<3–5 sentences of engaging prose>"}`;

// Used when heading already exists — generate only the description
const GENERATE_DESC_ONLY_PROMPT = `You are a professional travel writer. You are given a day heading for a travel itinerary. Write a rich, detailed description (3–5 sentences) that matches the heading. Reference actual landmarks, local experiences, and meal suggestions relevant to the specific city. Write in second person. Be specific and vivid. Do NOT invent hotels, prices, or inclusions not provided. Output JSON: {"description": "<3–5 sentences of engaging prose>"}`;

export async function POST(request: NextRequest) {
  const { day_number, destination, city, hotel, activities, raw_description, existing_heading } = await request.json();

  let systemPrompt: string;
  let userContent: string;

  if (raw_description) {
    // Rephrase existing DMC text — do NOT add or remove content
    systemPrompt = `You are a professional travel writer. Rephrase the provided day itinerary into polished engaging prose. Do NOT add any activity, place, meal or inclusion not in the source. Do NOT remove anything mentioned. Only improve grammar, flow and tone. Write in second person. Output JSON: {"heading": "<5–7 word heading>", "description": "<3–5 sentences>"}`;
    userContent = `Rephrase this Day ${day_number} itinerary text for ${city || destination}:\n\n${raw_description}`;
  } else if (existing_heading) {
    // Heading already set — generate description only without overwriting heading
    systemPrompt = GENERATE_DESC_ONLY_PROMPT;
    userContent = `Day ${day_number} heading: "${existing_heading}"\nCity: ${city || destination}${destination && city !== destination ? `\nDestination: ${destination}` : ''}${hotel ? `\nHotel: ${hotel}` : ''}${activities?.length ? `\nActivities context: ${(activities as string[]).filter(Boolean).join(', ')}` : ''}`;
  } else {
    // No heading — generate both from context
    systemPrompt = GENERATE_BOTH_PROMPT;
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
