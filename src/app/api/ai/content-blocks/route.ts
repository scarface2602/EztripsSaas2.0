import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/api/with-auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';
import { contentBlocksSchema } from '@/lib/schemas/ai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (checkRateLimit(auth.authUser.id)) return rateLimitResponse();

    const body = await request.json();
    const { type, destination } = contentBlocksSchema.parse(body);

    if (type === 'inclusions_exclusions') {
      const prompt = `For a travel proposal, suggest common inclusions and exclusions for a trip. Return JSON: {"inclusions": ["..."], "exclusions": ["..."]}. Include 5-8 items each. Common inclusions: hotel accommodation, transfers, sightseeing, meals as per meal plan, travel insurance. Common exclusions: flights, visa charges, personal expenses, tips, anything not mentioned.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      return NextResponse.json(JSON.parse(completion.choices[0]?.message?.content || '{}'));
    }

    // Dynamic content blocks
    const prompt = `For a trip to ${destination || 'a destination'}, suggest which of these content blocks would be most relevant and useful. Return a JSON array of block types with a draft content object for each. Block types: packing_list, weather, destination_highlights, insurance_upsell, lounge_upsell. Return JSON: {"blocks": [{"type": "...", "content": {...}}]}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    return NextResponse.json(JSON.parse(completion.choices[0]?.message?.content || '{}'));
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
