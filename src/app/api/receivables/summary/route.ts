import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

export const dynamic = 'force-dynamic';

interface EntityRow {
  client_id: string;
  name: string;
  kind: string;
  gstin: boolean;
  bookings: number;
  billed: number;
  received: number;
  due: number;
  advance: number;
}

// GET /api/receivables/summary — outstanding per billing entity, plus
// each entity's advance (receipts not yet allocated to a booking).
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'payments.manage' });
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    let bookingsQuery = supabase
      .from('bookings')
      .select(`id, sell_price, total_paid, status, created_by,
        client:clients!bookings_client_id_fkey(id, full_name, client_kind, gstin),
        bill_to:clients!bookings_bill_to_client_id_fkey(id, full_name, client_kind, gstin)`)
      .neq('status', 'cancelled')
      .limit(5000);

    if (auth.user.role !== 'super_admin') {
      if (auth.user.org_id) {
        const { data: orgUsers } = await supabase.from('users').select('id').eq('org_id', auth.user.org_id);
        const ids = (orgUsers || []).map((u: { id: string }) => u.id);
        bookingsQuery = bookingsQuery.in('created_by', ids.length > 0 ? ids : [auth.authUser.id]);
      } else {
        bookingsQuery = bookingsQuery.eq('created_by', auth.authUser.id);
      }
    }

    const [{ data: bookings, error }, { data: receipts }] = await Promise.all([
      bookingsQuery,
      supabase.from('client_receipts')
        .select('client_id, amount, status, allocations:client_receipt_allocations(amount)')
        .eq('status', 'active'),
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const entities = new Map<string, EntityRow>();
    for (const b of bookings || []) {
      const payer = (b.bill_to || b.client) as { id?: string; full_name?: string; client_kind?: string; gstin?: string | null } | null;
      if (!payer?.id) continue;
      let row = entities.get(payer.id);
      if (!row) {
        row = {
          client_id: payer.id,
          name: payer.full_name || '—',
          kind: payer.client_kind || 'individual',
          gstin: Boolean(payer.gstin),
          bookings: 0, billed: 0, received: 0, due: 0, advance: 0,
        };
        entities.set(payer.id, row);
      }
      const sell = Number(b.sell_price) || 0;
      const paid = Number(b.total_paid) || 0;
      row.bookings += 1;
      row.billed += sell;
      row.received += paid;
      row.due += Math.max(0, sell - paid);
    }

    // Advances — a receipt for an entity with no open bookings still shows.
    for (const r of receipts || []) {
      const allocated = (r.allocations || []).reduce((s: number, a: { amount: number }) => s + Number(a.amount), 0);
      const advance = Math.round((Number(r.amount) - allocated) * 100) / 100;
      if (advance <= 0) continue;
      let row = entities.get(r.client_id);
      if (!row) {
        const { data: c } = await supabase.from('clients').select('full_name, client_kind, gstin').eq('id', r.client_id).single();
        row = {
          client_id: r.client_id, name: c?.full_name || '—', kind: c?.client_kind || 'individual',
          gstin: Boolean(c?.gstin), bookings: 0, billed: 0, received: 0, due: 0, advance: 0,
        };
        entities.set(r.client_id, row);
      }
      row.advance += advance;
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    const rows = Array.from(entities.values())
      .map((r) => ({ ...r, billed: round(r.billed), received: round(r.received), due: round(r.due), advance: round(r.advance) }))
      .filter((r) => r.due > 0 || r.advance > 0)
      .sort((a, b) => b.due - a.due);

    return NextResponse.json(rows);
  } catch (err) {
    console.error('Receivables summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
