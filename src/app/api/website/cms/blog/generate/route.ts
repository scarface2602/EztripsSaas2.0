import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireApiAdmin } from '@/lib/auth/require-api-admin';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const { topic, destination, tone } = await request.json();
  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are a travel content writer for EzTrips, an Indian travel agency specialising in pilgrimages and leisure travel. Write engaging, SEO-friendly blog posts. Output valid JSON only: {"title": "<string>", "excerpt": "<1-2 sentence summary>", "content": "<full markdown blog post, 800-1200 words>", "seo_title": "<60 char max>", "seo_description": "<155 char max>", "tags": ["<tag1>", "<tag2>", ...]}`,
        },
        {
          role: 'user',
          content: `Write a blog post about: ${topic}${destination ? `\nDestination: ${destination}` : ''}${tone ? `\nTone: ${tone}` : ''}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || '';
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate blog post';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
