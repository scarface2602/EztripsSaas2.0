import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

// GET /api/register — the bookings daybook, one row per booking across
// online + offline + quick-entry sales. Dues and payment status are
// derived here, never stored.
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'bookings.view' });
    if (auth instanceof NextResponse) return auth;

    const sp = request.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim();
    const type = sp.get('type') || '';
    const from = sp.get('from') || '';
    const to = sp.get('to') || '';
    const page = Math.max(1, Number(sp.get('page')) || 1);

    const supabase = createServiceClient();

    let query = supabase
      .from('bookings')
      .select(
        `id, trip_id, title, booking_type, destination, status, created_at,
         travel_start, travel_end, sell_price, total_paid, currency,
         client:clients!bookings_client_id_fkey(id, full_name),
         bill_to:clients!bookings_bill_to_client_id_fkey(id, full_name, client_kind, gstin),
         booking_items(id, item_type, label, vendor_name, portal_name, supplier_reference, supplier_status),
         creator:users!bookings_created_by_fkey(full_name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    // Org scoping — same convention as /api/clients
    if (auth.user.role !== 'super_admin') {
      if (auth.user.org_id) {
        const { data: orgUsers } = await supabase.from('users').select('id').eq('org_id', auth.user.org_id);
        const ids = (orgUsers || []).map((u: { id: string }) => u.id);
        query = query.in('created_by', ids.length > 0 ? ids : [auth.authUser.id]);
      } else {
        query = query.eq('created_by', auth.authUser.id);
      }
    }

    if (type) query = query.eq('booking_type', type);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to + 'T23:59:59');
    if (q) {
      const safe = q.replace(/[%,()]/g, '');
      query = query.or(`trip_id.ilike.%${safe}%,title.ilike.%${safe}%,destination.ilike.%${safe}%`);
    }

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []).map((b) => {
      const sell = Number(b.sell_price) || 0;
      const paid = Number(b.total_paid) || 0;
      const due = Math.max(0, Math.round((sell - paid) * 100) / 100);
      const items = (b.booking_items || []) as Array<Record<string, unknown>>;
      const first = items[0] || {};
      return {
        id: b.id,
        trip_id: b.trip_id,
        date: b.created_at,
        title: b.title,
        booking_type: b.booking_type,
        destination: b.destination,
        booking_status: b.status,
        guest: (b.client as { full_name?: string } | null)?.full_name || '—',
        bill_to: (b.bill_to as { full_name?: string } | null)?.full_name || null,
        bill_to_kind: (b.bill_to as { client_kind?: string } | null)?.client_kind || null,
        bill_to_gst: Boolean((b.bill_to as { gstin?: string } | null)?.gstin),
        vendor: (first.vendor_name as string) || (first.portal_name as string) || null,
        reference: (first.supplier_reference as string) || null,
        item_count: items.length,
        sell_price: sell,
        total_paid: paid,
        due,
        payment_status: sell <= 0 ? 'na' : due <= 0 ? 'received' : paid > 0 ? 'partial' : 'due',
        currency: b.currency || 'INR',
        entered_by: (b.creator as { full_name?: string } | null)?.full_name || '—',
      };
    });

    return NextResponse.json({
      rows,
      page,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)),
    });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
