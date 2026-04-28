import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/api/with-auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';
import { parsePolicySchema } from '@/lib/schemas/ai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (checkRateLimit(auth.authUser.id)) return rateLimitResponse();

    const body = await request.json();
    const { text } = parsePolicySchema.parse(body);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Extract and clean up the flight cancellation policy from the text below into clear, structured bullet points. Remove any supplier names, internal codes, or confidential terms. Return only the cleaned policy text, no markdown.',
        },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const cleaned = completion.choices[0]?.message?.content || text;
    return NextResponse.json({ cleaned });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
