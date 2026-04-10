import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const { text } = await request.json();

  if (!text) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 });
  }

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
}
