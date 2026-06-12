import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { createOfflineBookingSchema } from '@/lib/schemas/offline-bookings';
import { generateTripIdFromDb, ServiceType } from '@/lib/utils/generateId';
import { getTripIdConfig } from '@/lib/utils/getTripIdConfig';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'bookings.manage' });
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();

    const parsed = createOfflineBookingSchema.safeParse(body);
    if (!parsed.success) {
      const flatErrors = parsed.error.flatten();
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: flatErrors.fieldErrors, formErrors: flatErrors.formErrors },
        { status: 400 }
      );
    }

    const { item_type, client_id, bill_to_client_id, item_details, cost_price, sell_price, notes, payment_schedule } = parsed.data;
    const supabase = createServiceClient();

    // Verify client exists and user has access
    let clientQuery = supabase.from('clients').select('id, full_name').eq('id', client_id);
    if (auth.user.role !== 'super_admin' && auth.user.org_id) {
      const { data: orgUsers } = await supabase.from('users').select('id').eq('org_id', auth.user.org_id);
      const orgUserIds = (orgUsers || []).map((u: { id: string }) => u.id);
      if (orgUserIds.length > 0) {
        clientQuery = clientQuery.in('created_by', orgUserIds);
      }
    } else if (auth.user.role !== 'super_admin') {
      clientQuery = clientQuery.eq('created_by', auth.user.id);
    }

    const { data: client, error: clientError } = await clientQuery.single();
    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    // --- Generate Trip ID ---
    const tripIdConfig = await getTripIdConfig(supabase, auth.user.org_id);
    const serviceTypeMap: Record<string, ServiceType> = { hotel: 'HTL', flight: 'FLT', vehicle: 'TRF' };
    const tripId = await generateTripIdFromDb(supabase, serviceTypeMap[item_type], tripIdConfig);

    // --- Mapping helpers ---
    const bookingTypeMap: Record<string, string> = { hotel: 'hotel', flight: 'flight', vehicle: 'land' };
    const itemTypeMap: Record<string, string> = { hotel: 'hotel_room', flight: 'flight_segment', vehicle: 'vehicle' };

    // Generate label
    let label = '';
    switch (item_type) {
      case 'hotel':
        label = `${item_details.hotel_name} – ${item_details.room_type} (${item_details.city})`;
        break;
      case 'flight':
        label = `${item_details.airline} ${item_details.flight_number} (${item_details.departure_city} → ${item_details.arrival_city})`;
        break;
      case 'vehicle':
        label = `${item_details.vehicle_brand || ''} ${item_details.vehicle_type} (${item_details.pickup_location} → ${item_details.dropoff_location})`;
        break;
    }

    // --- 1. Insert into trips table ---
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        trip_id: tripId,
        status: 'ACTIVE_BOOKING',
        client_id,
        destination: item_details.city || item_details.departure_city || item_details.pickup_location || '',
        travel_start: item_details.check_in || (item_details.departure_datetime as string)?.split('T')[0] || (item_details.pickup_datetime as string)?.split('T')[0],
        travel_end: item_details.check_out || (item_details.arrival_datetime as string)?.split('T')[0] || (item_details.dropoff_datetime as string)?.split('T')[0],
        pax_adults: (item_details.occupancy as Record<string, number> | undefined)?.adults || 1,
        pax_children: (item_details.occupancy as Record<string, number> | undefined)?.children || 0,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (tripError) {
      console.error('Trip creation error:', tripError);
      // Non-fatal — continue without trip record if table doesn't exist yet
    }

    // --- 2. Insert booking ---
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        created_by: auth.user.id,
        client_id,
        bill_to_client_id: bill_to_client_id || null,
        title: `${item_type.charAt(0).toUpperCase() + item_type.slice(1)} Booking - ${client.full_name}`,
        booking_type: bookingTypeMap[item_type],
        destination: item_details.city || item_details.departure_city || item_details.pickup_location || '',
        travel_start: item_details.check_in || item_details.departure_datetime,
        travel_end: item_details.check_out || item_details.arrival_datetime || item_details.dropoff_datetime,
        pax_adults: (item_details.occupancy as Record<string, number> | undefined)?.adults || 1,
        pax_children: (item_details.occupancy as Record<string, number> | undefined)?.children || 0,
        currency: 'INR',
        cost_price,
        sell_price,
        status: 'pending',
        trip_id: tripId,
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error('Booking creation error:', bookingError);
      return NextResponse.json({ error: 'Failed to create booking', details: bookingError?.message }, { status: 500 });
    }

    // Update trip with booking_id
    if (trip) {
      await supabase.from('trips').update({ booking_id: booking.id }).eq('id', trip.id);
    }

    // --- 3. Insert booking item ---
    const { data: bookingItem, error: itemError } = await supabase
      .from('booking_items')
      .insert({
        booking_id: booking.id,
        item_type: itemTypeMap[item_type],
        label: label.trim(),
        start_date: (item_details.check_in as string) || (item_details.departure_datetime as string)?.split('T')[0] || (item_details.pickup_datetime as string)?.split('T')[0],
        end_date: (item_details.check_out as string) || (item_details.arrival_datetime as string)?.split('T')[0] || (item_details.dropoff_datetime as string)?.split('T')[0],
        cost_price,
        sell_price,
        supplier_id: (item_details.supplier_id as string) || null,
        supplier_status: 'confirmation_requested',
        supplier_notes: notes || null,
        details: item_details,
        ...(item_type === 'vehicle' && {
          availability_type: item_details.availability_type as string,
          daily_start_time: (item_details.daily_start_time as string) || null,
          daily_end_time: (item_details.daily_end_time as string) || null,
          driver_name: (item_details.driver_name as string) || null,
          driver_license: (item_details.driver_license as string) || null,
          driver_license_valid_until: (item_details.driver_license_valid_until as string) || null,
          driver_insurance_type: (item_details.driver_insurance_type as string) || null,
          itinerary: (item_details.itinerary as Array<Record<string, string>>) || null,
        }),
      })
      .select()
      .single();

    if (itemError || !bookingItem) {
      console.error('Booking item creation error:', itemError);
      await supabase.from('bookings').delete().eq('id', booking.id);
      return NextResponse.json({ error: 'Failed to create booking item', details: itemError?.message }, { status: 500 });
    }

    // --- 4. Create booking package ---
    const { data: pkg, error: pkgError } = await supabase
      .from('booking_packages')
      .insert({
        booking_id: booking.id,
        type: 'individual',
        supplier_id: (item_details.supplier_id as string) || null,
        booking_items_ids: [bookingItem.id],
        total_cost: cost_price,
        status: 'pending',
      })
      .select('id')
      .single();

    if (pkgError || !pkg) {
      console.error('Package creation error (non-fatal):', pkgError);
    }

    // --- 5. Insert payment schedule into booking_package_payments ---
    if (pkg) {
      const payments: Array<{
        package_id: string;
        sequence: number;
        amount: number;
        due_date: string;
        status: string;
      }> = [];

      if (payment_schedule.mode === 'full') {
        payments.push({
          package_id: pkg.id,
          sequence: 1,
          amount: cost_price,
          due_date: payment_schedule.deposit_due_date,
          status: 'pending',
        });
      } else {
        // Split: deposit + balance
        payments.push({
          package_id: pkg.id,
          sequence: 1,
          amount: payment_schedule.deposit_amount,
          due_date: payment_schedule.deposit_due_date,
          status: 'pending',
        });
        if (payment_schedule.balance_amount > 0) {
          payments.push({
            package_id: pkg.id,
            sequence: 2,
            amount: payment_schedule.balance_amount,
            due_date: payment_schedule.balance_due_date,
            status: 'pending',
          });
        }
      }

      const { error: payError } = await supabase
        .from('booking_package_payments')
        .insert(payments);

      if (payError) {
        console.error('Payment schedule insertion error (non-fatal):', payError);
      }
    }

    return NextResponse.json(
      {
        booking_id: booking.id,
        item_id: bookingItem.id,
        trip_id: tripId,
        message: 'Booking created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating offline booking:', error);
    return NextResponse.json({ error: 'Failed to create offline booking' }, { status: 500 });
  }
}
