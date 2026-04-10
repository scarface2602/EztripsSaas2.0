import { NextRequest, NextResponse } from 'next/server';
import { checkSanitisation } from '@/lib/utils/sanitisation';

export async function POST(request: NextRequest) {
  const { fields } = await request.json();
  const result = checkSanitisation(fields || {});
  return NextResponse.json(result);
}
