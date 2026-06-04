import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('payment_links')
    .select('*')
    .eq('booking_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = createServiceClient();
  const body = await req.json();

  const schema = z.object({
    amount: z.number().min(1),
    label: z.string().max(200).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Get booking to find the proposal share_token for the URL
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, proposal_id, currency')
    .eq('id', id)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const { data: link, error } = await supabase
    .from('payment_links')
    .insert({
      booking_id: id,
      amount: parsed.data.amount,
      label: parsed.data.label || null,
      currency: booking.currency || 'INR',
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link });
}
