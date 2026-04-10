import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const { hotel_name, city, country } = await request.json();

  const prompt = `Write a 3-4 sentence luxury travel description of ${hotel_name}, ${city}${country ? `, ${country}` : ''}. Mention its location, ambience, and key features. Do not mention prices or room rates. Return JSON: {"description": "..."}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content || '{}';
  return NextResponse.json(JSON.parse(content));
}
