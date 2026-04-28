import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { withAuth } from '@/lib/api/with-auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';

const imageSuggestSchema = z.object({
  destination: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (checkRateLimit(auth.authUser.id)) return rateLimitResponse();

    const body = await request.json();
    const { destination } = imageSuggestSchema.parse(body);

    const accessKey = process.env.UNSPLASH_ACCESS_KEY;

    if (!accessKey) {
      return NextResponse.json({ images: [] });
    }

    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(destination + ' travel landscape')}&per_page=3&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${accessKey}` } }
    );

    if (!res.ok) {
      return NextResponse.json({ images: [] });
    }

    const data = await res.json();
    const images = (data.results || []).map((img: { urls: { regular: string }; alt_description: string }) => ({
      url: img.urls.regular,
      alt: img.alt_description || destination,
    }));

    return NextResponse.json({ images });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
