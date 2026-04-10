import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a professional travel writer. Rephrase the provided day itinerary into polished engaging prose. Do NOT add any activity, place, meal or inclusion not in the source. Do NOT remove anything mentioned. Only improve grammar, flow and tone. Write in second person. Output: one heading 5-7 words then one paragraph 3-5 sentences. Return JSON: {"heading": "...", "description": "..."}`;

export async function POST(request: NextRequest) {
  const { day_number, destination, city, hotel, activities, raw_description } = await request.json();

  let userContent: string;

  if (raw_description) {
    // Rephrase existing DMC text — do NOT add or remove content
    userContent = `Rephrase this Day ${day_number} itinerary text for ${city || destination}:\n\n${raw_description}`;
  } else {
    // Generate from available context — use only what is provided, do not invent
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

    userContent = `Write Day ${day_number} itinerary for ${destination}.${city ? ` City: ${city}.` : ''}${hotel ? ` Hotel: ${hotel}.` : ''}${activityList ? ` Activities: ${activityList}.` : ''} Use only the details provided. Do not invent activities, places or meals not listed.`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content || '{}';
  return NextResponse.json(JSON.parse(content));
}
