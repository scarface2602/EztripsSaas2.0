import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkSanitisation, SANITISATION_SYSTEM_PROMPT } from '@/lib/utils/sanitisation';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EXTRACTION_PROMPT = `You are a travel proposal extraction assistant.
Extract all structured data from the following supplier quote.
Return ONLY valid JSON. No markdown, no explanation.

${SANITISATION_SYSTEM_PROMPT}

Return this exact shape:
{
  "supplier_name": string,
  "destination": string,
  "travel_start": "YYYY-MM-DD" | null,
  "travel_end": "YYYY-MM-DD" | null,
  "currency": string,
  "pax_adults": number | null,
  "pax_children": number | null,
  "hotels": [{
    "name": string,
    "city": string,
    "check_in": "YYYY-MM-DD" | null,
    "check_out": "YYYY-MM-DD" | null,
    "room_type": string | null,
    "meal_plan": "RO"|"BB"|"HB"|"FB"|"AI" | null,
    "cp_per_night": number | null,
    "description": string | null,
    "cancellation_policy": string | null
  }],
  "flights": [{
    "flight_number": string,
    "cp_total": number | null,
    "refundable_status": "refundable"|"non_refundable"|"partially_refundable",
    "cancellation_policy_text": string | null
  }],
  "itinerary_days": [{
    "day_number": number,
    "date": "YYYY-MM-DD" | null,
    "city": string | null,
    "heading": string,
    "description": string,
    "activities": [{"type": "transfer"|"sightseeing"|"activity"|"other", "description": string}]
  }],
  "cancellation_policy": [{
    "days_before": number,
    "charge_pct": number,
    "notes": string | null
  }],
  "inclusions": string[],
  "exclusions": string[],
  "activities": [{
    "day": number | null,
    "description": string,
    "type": "transfer"|"sightseeing"|"activity"|"other"
  }],
  "payment_terms": string | null,
  "validity": string | null
}

IMPORTANT extraction rules:
- itinerary_days: Extract the VERBATIM day-wise itinerary text from the DMC quote. Each day MUST have: day_number (integer), city (city name for that day, e.g. "Dubai"), date (if a specific date is mentioned), heading (short title e.g. "Arrival in Bali"), and the full description paragraph exactly as written by the DMC. Extract all activities mentioned for that day.
- cancellation_policy: Extract the general/land cancellation policy as an array of slabs with days_before, charge_pct, and notes.
- hotels[].cancellation_policy: If the quote mentions per-hotel cancellation terms, extract them as text.
- flights[].refundable_status: Extract whether each flight is refundable, non_refundable, or partially_refundable.
- flights[].cancellation_policy_text: Extract verbatim flight cancellation/refund policy text if mentioned.
- inclusions: Extract ALL items listed under "Inclusions" or "Included" as an array of strings.
- exclusions: Extract ALL items listed under "Exclusions" or "Not included" as an array of strings.
- payment_terms: Extract the full payment terms text verbatim.`;

export async function POST(request: NextRequest) {
  const { text } = await request.json();

  if (!text) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 });
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  // Run sanitisation check on description fields
  const descriptionFields: Record<string, string> = {};
  if (parsed.hotels) {
    parsed.hotels.forEach((h: { description?: string }, i: number) => {
      if (h.description) descriptionFields[`hotels[${i}].description`] = h.description;
    });
  }
  if (parsed.activities) {
    parsed.activities.forEach((a: { description?: string }, i: number) => {
      if (a.description) descriptionFields[`activities[${i}].description`] = a.description;
    });
  }

  const sanitisationResult = checkSanitisation(descriptionFields);

  return NextResponse.json({
    parsed,
    sanitisation_flags: sanitisationResult.flaggedFields,
  });
}
