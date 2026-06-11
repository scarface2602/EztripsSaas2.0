import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { withAuth } from '@/lib/api/with-auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/flights/parse — extract structured flight segments from
// pasted text (GDS dumps, airline emails, OTA confirmations, WhatsApp).
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (checkRateLimit(auth.authUser.id)) return rateLimitResponse();

  const { text } = await request.json().catch(() => ({ text: '' }));
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return NextResponse.json({ error: 'Paste the flight details text' }, { status: 400 });
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Extract flight segments from the text. Output JSON: {"flights": [{
"airline": "<marketing airline name>",
"flight_number": "<e.g. 6E-1473>",
"origin": "<IATA or city>",
"destination": "<IATA or city>",
"depart_at": "<YYYY-MM-DDTHH:mm or null>",
"arrive_at": "<YYYY-MM-DDTHH:mm or null>",
"duration": "<e.g. 5h 35m or null>",
"layover": "<e.g. 2h 10m in KUL, or null for nonstop>",
"operated_by": "<operating carrier if codeshare, else null>",
"fare_type": "<e.g. Saver/Flexi/Economy Light, or null>",
"baggage": "<e.g. 20kg + 7kg cabin, or null>",
"price": <number or null — the fare for this segment/journey if stated>
}]}
Only extract what is present; never invent values. One entry per segment; for a multi-segment journey priced as one, put the price on the first segment only.`,
      },
      { role: 'user', content: text.slice(0, 12000) },
    ],
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    return NextResponse.json({ flights: Array.isArray(parsed.flights) ? parsed.flights : [] });
  } catch {
    return NextResponse.json({ error: 'Could not parse flight details' }, { status: 422 });
  }
}
