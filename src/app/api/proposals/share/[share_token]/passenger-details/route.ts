import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const passengerDetailsSchema = z.object({
  passengers: z.array(z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    gender: z.enum(['male', 'female', 'other']).optional(),
    dateOfBirth: z.string().optional(),
    passportFiles: z.array(z.string()).optional(),
    panFiles: z.array(z.string()).optional(),
    isChild: z.boolean(),
  })),
  skipDocuments: z.boolean().optional(),
});

/**
 * Public POST — save passenger details on the proposal (pre-booking).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { share_token: string } }
) {
  try {
    const body = await request.json();
    const validated = passengerDetailsSchema.parse(body);
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('proposals')
      .update({ passenger_details: validated.passengers })
      .eq('share_token', params.share_token)
      .in('status', ['published', 'confirmed']);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error saving passenger details:', err);
    return NextResponse.json({ error: 'Failed to save passenger details' }, { status: 500 });
  }
}
