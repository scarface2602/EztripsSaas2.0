import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/api/with-auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';
import { hotelDescriptionSchema } from '@/lib/schemas/ai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (checkRateLimit(auth.authUser.id)) return rateLimitResponse();

    const body = await request.json();
    const { hotel_name, city, country } = hotelDescriptionSchema.parse(body);

    const prompt = `Write a 3-4 sentence luxury travel description of ${hotel_name}, ${city}${country ? `, ${country}` : ''}. Mention its location, ambience, and key features. Do not mention prices or room rates. Return JSON: {"description": "..."}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return NextResponse.json(JSON.parse(content));
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
