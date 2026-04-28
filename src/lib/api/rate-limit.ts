import { NextResponse } from 'next/server';

const requests = new Map<string, number[]>();

const WINDOW_MS = 60_000; // 60 seconds
const MAX_REQUESTS = 5;

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = requests.get(userId) ?? [];

  // Remove expired entries
  const valid = timestamps.filter((t) => now - t < WINDOW_MS);

  if (valid.length >= MAX_REQUESTS) {
    requests.set(userId, valid);
    return true; // rate limited
  }

  valid.push(now);
  requests.set(userId, valid);
  return false;
}

export function rateLimitResponse() {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429 }
  );
}
