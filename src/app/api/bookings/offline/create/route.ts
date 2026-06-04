import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { createOfflineBookingSchema } from '@/lib/schemas/offline-bookings';
import { NextRequest, NextResponse } from 'next/server';

// POST: Create offline booking with single item
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();

    // Validate request body
    const parsed = createOfflineBookingSchema.safeParse(body);
    if (!parsed.success) {
      const flatErrors = parsed.error.flatten();
      console.error('Validation failed:', {
        fieldErrors: flatErrors.fieldErrors,
        formErrors: flatErrors.formErrors,
        body: body
      });
      return NextResponse.json(
        {
          error: 'Validation failed',
          fieldErrors: flatErrors.fieldErrors,
          formErrors: flatErrors.formErrors,
        },
        { status: 400 }
      );
    }

    const { item_type, client_id, item_details, cost_price, sell_price, notes } = parsed.data;

    const supabase = createServiceClient();

    // Verify client exists and user has access (org-wide)
    let clientQuery = supabase
      .from('clients')
      .select('id, full_name')
      .eq('id', client_id);

    // Non-super_admin: verify client belongs to same org
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
      console.error('Client verification failed:', { clientError, clientId: auth.user.id });
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    // Map item_type to booking_type (hotel, flight, or vehicle -> land)
    const bookingTypeMap: Record<string, string> = {
      hotel: 'hotel',
      flight: 'flight',
      vehicle: 'land',
    };

    // Create booking record
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        created_by: auth.user.id,
        client_id,
        title: `${item_type.charAt(0).toUpperCase() + item_type.slice(1)} Booking - ${client.full_name}`,
        booking_type: bookingTypeMap[item_type],
        destination: item_details.city || item_details.departure_city || item_details.pickup_location || '',
        travel_start: item_details.check_in || item_details.departure_datetime || item_details.pickup_datetime,
        travel_end: item_details.check_out || item_details.arrival_datetime || item_details.dropoff_datetime,
        pax_adults: (item_details.occupancy as Record<string, number> | undefined)?.adults || 1,
        pax_children: (item_details.occupancy as Record<string, number> | undefined)?.children || 0,
        currency: 'INR',
        cost_price,
        sell_price,
        status: 'pending',
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error('Booking creation error:', {
        error: bookingError?.message,
        code: bookingError?.code,
        hint: bookingError?.hint,
        details: bookingError?.details,
        fullError: JSON.stringify(bookingError)
      });
      return NextResponse.json({
        error: 'Failed to create booking',
        details: bookingError?.message || 'Unknown error'
      }, { status: 500 });
    }

    // Map item_type names for database
    const itemTypeMap: Record<string, string> = {
      hotel: 'hotel_room',
      flight: 'flight_segment',
      vehicle: 'vehicle',
    };

    // Generate appropriate label based on type
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

    // Create booking item
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
        supplier_status: 'pending',
        supplier_notes: notes || null,
        details: item_details,
        // Vehicle-specific fields
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
      console.error('Booking item creation error:', {
        error: itemError?.message,
        code: itemError?.code,
        hint: itemError?.hint,
        details: itemError?.details,
        fullError: JSON.stringify(itemError),
        item_type,
        itemDetails: JSON.stringify(item_details)
      });
      // Clean up booking if item creation fails
      await supabase.from('bookings').delete().eq('id', booking.id);
      return NextResponse.json({
        error: 'Failed to create booking item',
        details: itemError?.message || 'Unknown error'
      }, { status: 500 });
    }

    // Auto-create booking package for payment schedule tracking
    const { error: pkgError } = await supabase
      .from('booking_packages')
      .insert({
        booking_id: booking.id,
        type: 'individual',
        supplier_id: (item_details.supplier_id as string) || null,
        booking_items_ids: [bookingItem.id],
        total_cost: cost_price,
        status: 'pending',
      });

    if (pkgError) {
      console.error('Package auto-creation error (non-fatal):', pkgError);
      // Non-fatal — booking still created, user can set up payments manually
    }

    return NextResponse.json(
      {
        booking_id: booking.id,
        item_id: bookingItem.id,
        message: 'Booking created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating offline booking:', error);
    return NextResponse.json(
      { error: 'Failed to create offline booking' },
      { status: 500 }
    );
  }
}
