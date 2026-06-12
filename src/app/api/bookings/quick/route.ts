import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { createQuickBookingSchema } from '@/lib/schemas/quick-booking';
import { generateTripIdFromDb, type ServiceType } from '@/lib/utils/generateId';
import { getTripIdConfig } from '@/lib/utils/getTripIdConfig';

// item_type → trip-ID service code / bookings.booking_type
const SERVICE_TYPE_MAP: Record<string, ServiceType> = {
  flight_segment: 'FLT', hotel_room: 'HTL', vehicle: 'TRF', transfer: 'TRF',
  activity: 'MISC', train: 'TRN', insurance: 'INS', dmc_package: 'PKG',
};
const BOOKING_TYPE_MAP: Record<string, string> = {
  flight_segment: 'flight', hotel_room: 'hotel', vehicle: 'land', transfer: 'land',
  activity: 'land', train: 'train', insurance: 'insurance', dmc_package: 'package',
};

// POST /api/bookings/quick — one-line register entry: trip + booking +
// single item in one call. Supplier status derives from the reference:
// a tracker/PNR present means the supplier already confirmed it.
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'bookings.manage' });
    if (auth instanceof NextResponse) return auth;

    const parsed = createQuickBookingSchema.safeParse(await request.json());
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: flat.fieldErrors },
        { status: 400 },
      );
    }
    const d = parsed.data;
    const supabase = createServiceClient();

    const { data: client } = await supabase
      .from('clients').select('id, full_name').eq('id', d.client_id).single();
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const tripIdConfig = await getTripIdConfig(supabase, auth.user.org_id);
    const tripId = await generateTripIdFromDb(supabase, SERVICE_TYPE_MAP[d.item_type], tripIdConfig);

    const startDate = d.start_date || null;
    const endDate = d.end_date || d.start_date || null;
    const confirmed = Boolean(d.supplier_reference);

    const { data: trip } = await supabase.from('trips').insert({
      trip_id: tripId,
      status: 'ACTIVE_BOOKING',
      client_id: d.client_id,
      destination: d.destination || '',
      travel_start: startDate,
      travel_end: endDate,
      pax_adults: d.pax_adults || 1,
      pax_children: d.pax_children || 0,
      created_by: auth.user.id,
    }).select('id').single();

    const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
      created_by: auth.user.id,
      client_id: d.client_id,
      bill_to_client_id: d.bill_to_client_id || null,
      title: d.label,
      booking_type: BOOKING_TYPE_MAP[d.item_type],
      destination: d.destination || '',
      travel_start: startDate,
      travel_end: endDate,
      pax_adults: d.pax_adults || 1,
      pax_children: d.pax_children || 0,
      currency: 'INR',
      cost_price: d.cost_price ?? 0,
      sell_price: d.sell_price,
      status: 'confirmed',
      trip_id: tripId,
    }).select('id').single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Failed to create booking', details: bookingError?.message },
        { status: 500 },
      );
    }
    if (trip) await supabase.from('trips').update({ booking_id: booking.id }).eq('id', trip.id);

    const { data: item, error: itemError } = await supabase.from('booking_items').insert({
      booking_id: booking.id,
      item_type: d.item_type,
      label: d.label,
      start_date: startDate,
      end_date: endDate,
      cost_price: d.cost_price ?? 0,
      sell_price: d.sell_price,
      vendor_name: d.vendor_name || null,
      supplier_reference: d.supplier_reference || null,
      supplier_status: confirmed ? 'confirmed' : 'pending',
      supplier_confirmed_at: confirmed ? new Date().toISOString() : null,
      supplier_notes: d.notes || null,
      details: { source: 'quick_entry' },
    }).select('id').single();

    if (itemError || !item) {
      await supabase.from('bookings').delete().eq('id', booking.id);
      return NextResponse.json(
        { error: 'Failed to create booking item', details: itemError?.message },
        { status: 500 },
      );
    }

    await supabase.from('booking_logs').insert({
      booking_id: booking.id,
      user_id: auth.user.id,
      action: 'booking_created',
      details: { source: 'quick_entry', trip_id: tripId, item_type: d.item_type },
    });

    return NextResponse.json({ booking_id: booking.id, trip_id: tripId }, { status: 201 });
  } catch (err) {
    console.error('Quick booking error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
