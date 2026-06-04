import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

interface CreateBookingRequest {
  proposal_id: string;
  client_id: string;
  sell_price?: number;
  packages: Array<{
    type: 'full_dmc' | 'partial_dmc' | 'mixed' | 'individual';
    supplier_id?: string;
    booking_items_ids: string[];
    total_cost: number;
  }>;
}

// POST: Create booking with packages
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body: CreateBookingRequest = await request.json();
    const { proposal_id, client_id, packages, sell_price: clientSellPrice } = body;

    if (!proposal_id || !client_id || !Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json(
        { error: 'proposal_id, client_id, and packages array are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Verify user owns the proposal
    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, destination, travel_start, travel_end, pax_adults, pax_children, currency')
      .eq('id', proposal_id)
      .eq('created_by', auth.user.id)
      .single();

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Calculate total booking cost
    const totalBookingCost = packages.reduce((sum, pkg) => sum + pkg.total_cost, 0);

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([
        {
          proposal_id,
          client_id,
          created_by: auth.user.id,
          booking_type: 'package',
          title: `${proposal.destination} - Booking`,
          destination: proposal.destination,
          travel_start: proposal.travel_start,
          travel_end: proposal.travel_end,
          pax_adults: proposal.pax_adults,
          pax_children: proposal.pax_children,
          currency: proposal.currency,
          cost_price: totalBookingCost,
          sell_price: clientSellPrice || totalBookingCost,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (bookingError || !booking) throw bookingError || new Error('Failed to create booking');

    // Create booking packages
    const packageIds: string[] = [];
    for (const pkg of packages) {
      const { data: createdPkg, error: pkgError } = await supabase
        .from('booking_packages')
        .insert([
          {
            booking_id: booking.id,
            type: pkg.type,
            supplier_id: pkg.supplier_id || null,
            booking_items_ids: pkg.booking_items_ids,
            total_cost: pkg.total_cost,
            status: 'pending',
          },
        ])
        .select('id')
        .single();

      if (pkgError || !createdPkg) throw pkgError || new Error('Failed to create package');
      packageIds.push(createdPkg.id);
    }

    return NextResponse.json(
      {
        booking,
        packageIds,
        message: 'Booking created successfully. You can now set up payment schedules for each package.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
