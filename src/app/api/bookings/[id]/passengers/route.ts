import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { BookingPassengerSchema } from '@/lib/schemas/passengers';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('booking_passengers')
    .select('*')
    .eq('booking_id', id)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ passengers: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const body = await req.json();

  const schema = z.object({
    passengers: z.array(BookingPassengerSchema),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rows = parsed.data.passengers.map(p => ({
    booking_id: id,
    type: p.type,
    title: p.title || null,
    first_name: p.first_name,
    last_name: p.last_name || null,
    dob: p.dob || null,
    passport_number: p.passport_number || null,
    passport_expiry: p.passport_expiry || null,
    passport_document_url: p.passport_document_url || null,
  }));

  const { data, error } = await supabase
    .from('booking_passengers')
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ passengers: data });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const body = await req.json();

  const { passenger_id, ...updates } = body;
  if (!passenger_id) return NextResponse.json({ error: 'passenger_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('booking_passengers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', passenger_id)
    .eq('booking_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ passenger: data });
}
