import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { destination } = await request.json();
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
}
