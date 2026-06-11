import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { withAuth } from '@/lib/api/with-auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse/lib/pdf-parse.js') as (buffer: Buffer) => Promise<{ text: string }>;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `Extract flight segments from the provided text and/or booking screenshots. Output JSON: {"flights": [{
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
Only extract what is present; never invent values. One entry per segment; for a multi-segment journey priced as one, put the price on the first segment only.`;

// POST /api/flights/parse — JSON {text} or multipart FormData with
// `text` and/or `files` (screenshots → GPT-4o vision, PDFs → text).
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (checkRateLimit(auth.authUser.id)) return rateLimitResponse();

  let text = '';
  const images: string[] = []; // data URLs

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    text = (form.get('text') as string) ?? '';
    for (const entry of form.getAll('files')) {
      if (!(entry instanceof File)) continue;
      const buf = Buffer.from(await entry.arrayBuffer());
      if (entry.type === 'application/pdf' || entry.name.toLowerCase().endsWith('.pdf')) {
        try {
          const parsed = await pdf(buf);
          text += `\n\n--- ${entry.name} ---\n${parsed.text}`;
        } catch {
          return NextResponse.json({ error: `Could not read PDF ${entry.name}` }, { status: 422 });
        }
      } else if (entry.type.startsWith('image/')) {
        if (buf.length > 8 * 1024 * 1024) {
          return NextResponse.json({ error: `${entry.name} is too large (max 8MB per image)` }, { status: 413 });
        }
        images.push(`data:${entry.type};base64,${buf.toString('base64')}`);
      }
    }
  } else {
    const body = await request.json().catch(() => ({ text: '' }));
    text = typeof body.text === 'string' ? body.text : '';
  }

  if (text.trim().length < 10 && images.length === 0) {
    return NextResponse.json({ error: 'Paste flight text or attach screenshots/PDF' }, { status: 400 });
  }

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [];
  if (text.trim()) userContent.push({ type: 'text', text: text.slice(0, 12000) });
  for (const url of images.slice(0, 5)) {
    userContent.push({ type: 'image_url', image_url: { url } });
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    return NextResponse.json({ flights: Array.isArray(parsed.flights) ? parsed.flights : [] });
  } catch {
    return NextResponse.json({ error: 'Could not parse flight details' }, { status: 422 });
  }
}
