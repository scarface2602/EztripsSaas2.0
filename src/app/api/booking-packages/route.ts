import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

// POST: Create a booking package
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { booking_id, type, supplier_id, booking_items_ids, total_cost, payment_schedule_id } = body;

    if (!booking_id || !type) {
      return NextResponse.json(
        { error: 'booking_id and type are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Verify user owns the booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('created_by')
      .eq('id', booking_id)
      .single();

    if (!booking || booking.created_by !== auth.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create package
    const { data: pkg, error } = await supabase
      .from('booking_packages')
      .insert([
        {
          booking_id,
          type,
          supplier_id: supplier_id || null,
          booking_items_ids: booking_items_ids || [],
          total_cost: total_cost || 0,
          payment_schedule_id: payment_schedule_id || null,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    console.error('Error creating booking package:', error);
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 });
  }
}
