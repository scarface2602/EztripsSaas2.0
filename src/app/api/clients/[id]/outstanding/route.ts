import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

export const dynamic = 'force-dynamic';

// GET /api/clients/[id]/outstanding — bookings this payer owes money on:
// billed to them directly, or their own travel with no separate biller.
// Powers the receipt allocation list, oldest first.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await withAuth(request, { permission: 'payments.manage' });
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('id, trip_id, title, booking_type, created_at, sell_price, total_paid, currency')
      .or(`bill_to_client_id.eq.${id},and(client_id.eq.${id},bill_to_client_id.is.null)`)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || [])
      .map((b) => {
        const sell = Number(b.sell_price) || 0;
        const paid = Number(b.total_paid) || 0;
        return {
          id: b.id,
          trip_id: b.trip_id,
          title: b.title,
          booking_type: b.booking_type,
          created_at: b.created_at,
          sell_price: sell,
          total_paid: paid,
          due: Math.max(0, Math.round((sell - paid) * 100) / 100),
        };
      })
      .filter((b) => b.due > 0);

    return NextResponse.json(rows);
  } catch (err) {
    console.error('Outstanding error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
