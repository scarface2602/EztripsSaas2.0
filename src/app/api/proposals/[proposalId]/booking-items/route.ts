import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch booking items for a proposal (hotels, flights, transfers, activities, etc.)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  try {
    const { proposalId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    // Verify user owns the proposal
    const { data: proposal } = await supabase
      .from('proposals')
      .select('id')
      .eq('id', proposalId)
      .eq('created_by', auth.user.id)
      .single();

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Fetch hotels
    const { data: hotels } = await supabase
      .from('hotels')
      .select('id, name, city, cp_per_night, sp_per_night, cwb_sp, cnb_sp')
      .eq('proposal_id', proposalId);

    // Fetch flights
    const { data: flights } = await supabase
      .from('flights')
      .select('id, flight_number, airline, origin_city, destination_city, cp_total, sp_total')
      .eq('proposal_id', proposalId);

    // Fetch activities
    const { data: activities } = await supabase
      .from('itinerary_activities')
      .select('id, type, confirmed_sp, pvt_sp, sic_sp')
      .eq('proposal_id', proposalId);

    // Fetch line items
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('id, type, description, sp')
      .eq('proposal_id', proposalId);

    // Format as booking items for the dialog
    const bookingItems = [
      ...(hotels || []).map((h) => ({
        id: h.id,
        label: `Hotel: ${h.name} (${h.city})`,
        item_type: 'hotel_room' as const,
        vendor_name: h.name,
        sell_price: h.cwb_sp || h.sp_per_night || 0,
      })),
      ...(flights || []).map((f) => ({
        id: f.id,
        label: `Flight: ${f.flight_number || 'TBD'} (${f.origin_city} → ${f.destination_city})`,
        item_type: 'flight_segment' as const,
        vendor_name: f.airline,
        sell_price: f.sp_total || 0,
      })),
      ...(activities || []).map((a) => ({
        id: a.id,
        label: `Activity: ${a.type}`,
        item_type: 'activity' as const,
        vendor_name: 'Activity',
        sell_price: a.confirmed_sp || a.pvt_sp || a.sic_sp || 0,
      })),
      ...(lineItems || []).map((l) => ({
        id: l.id,
        label: `${l.type}: ${l.description}`,
        item_type: 'other' as const,
        vendor_name: l.type,
        sell_price: l.sp || 0,
      })),
    ];

    return NextResponse.json({ bookingItems });
  } catch (error) {
    console.error('Error fetching booking items:', error);
    return NextResponse.json({ error: 'Failed to fetch booking items' }, { status: 500 });
  }
}
