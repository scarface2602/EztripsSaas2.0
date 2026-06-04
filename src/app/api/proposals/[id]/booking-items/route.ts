import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch booking items for a proposal (hotels, flights, transfers, activities, etc.)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    // Verify user owns the proposal
    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, pax_adults, pax_children')
      .eq('id', proposalId)
      .eq('created_by', auth.user.id)
      .single();

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Fetch hotels with full details
    const { data: hotels } = await supabase
      .from('hotels')
      .select('id, name, city, check_in, check_out, nights, room_type, meal_plan, star_rating, supplier_id, cp_per_night, sp_per_night, cwb_sp, cwb_cp, cnb_sp, cnb_cp')
      .eq('proposal_id', proposalId);

    // Fetch flights with full details
    const { data: flights } = await supabase
      .from('flights')
      .select('id, flight_number, airline, origin_city, origin_iata, destination_city, destination_iata, departure_date, departure_time, arrival_date, arrival_time, cabin_class, supplier_id, cp_total, sp_total')
      .eq('proposal_id', proposalId);

    // Fetch line items (transfers, activities, visa, surcharges, etc.)
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('id, type, description, date, cp, sp, supplier_id, per_person, include_in_total, is_included')
      .eq('proposal_id', proposalId)
      .eq('is_included', true);

    const pax = (proposal.pax_adults || 1) + (proposal.pax_children || 0);

    // Format as booking items for the dialog
    const bookingItems = [
      ...(hotels || []).map((h) => {
        const nights = h.nights || 1;
        const cpTotal = (h.cp_per_night || 0) * nights;
        const spTotal = (h.sp_per_night || 0) * nights;
        return {
          id: h.id,
          source_type: 'hotel' as const,
          label: `${h.name} – ${h.room_type || 'Standard'} (${h.city})`,
          item_type: 'hotel_room' as const,
          vendor_name: h.name,
          supplier_id: h.supplier_id || null,
          cost_price: cpTotal,
          sell_price: spTotal,
          start_date: h.check_in,
          end_date: h.check_out,
          details: {
            hotel_name: h.name,
            city: h.city,
            check_in: h.check_in,
            check_out: h.check_out,
            nights,
            room_type: h.room_type,
            meal_plan: h.meal_plan,
            star_rating: h.star_rating,
            occupancy: { adults: proposal.pax_adults || 1, children: proposal.pax_children || 0 },
          },
        };
      }),
      ...(flights || []).map((f) => ({
        id: f.id,
        source_type: 'flight' as const,
        label: `${f.origin_iata || f.origin_city} → ${f.destination_iata || f.destination_city} (${f.airline} ${f.flight_number || ''})`.trim(),
        item_type: 'flight_segment' as const,
        vendor_name: f.airline,
        supplier_id: f.supplier_id || null,
        cost_price: f.cp_total || 0,
        sell_price: f.sp_total || 0,
        start_date: f.departure_date,
        end_date: f.arrival_date || f.departure_date,
        details: {
          airline: f.airline,
          flight_number: f.flight_number,
          departure_city: f.origin_city,
          departure_iata: f.origin_iata,
          arrival_city: f.destination_city,
          arrival_iata: f.destination_iata,
          departure_date: f.departure_date,
          departure_time: f.departure_time,
          arrival_date: f.arrival_date,
          arrival_time: f.arrival_time,
          cabin_class: f.cabin_class,
        },
      })),
      ...(lineItems || []).map((l) => {
        const itemTypeMap: Record<string, string> = {
          transfer: 'transfer',
          activity: 'activity',
          visa: 'activity',
          surcharge: 'activity',
          ancillary: 'activity',
          other: 'activity',
        };
        const cpAmount = l.per_person ? (l.cp || 0) * pax : (l.cp || 0);
        const spAmount = l.per_person ? (l.sp || 0) * pax : (l.sp || 0);
        return {
          id: l.id,
          source_type: 'line_item' as const,
          label: `${l.description}`,
          item_type: (itemTypeMap[l.type] || 'activity') as string,
          vendor_name: l.type === 'transfer' ? 'Transfer' : l.type,
          supplier_id: l.supplier_id || null,
          cost_price: cpAmount,
          sell_price: spAmount,
          start_date: l.date,
          end_date: l.date,
          details: {
            type: l.type,
            description: l.description,
            per_person: l.per_person,
          },
        };
      }),
    ];

    return NextResponse.json({ bookingItems });
  } catch (error) {
    console.error('Error fetching booking items:', error);
    return NextResponse.json({ error: 'Failed to fetch booking items' }, { status: 500 });
  }
}
