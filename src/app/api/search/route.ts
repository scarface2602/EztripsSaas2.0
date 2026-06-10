import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface SearchResult {
  type: 'booking' | 'proposal' | 'enquiry' | 'client';
  id: string;
  title: string;
  subtitle: string | null;
  trip_id: string | null;
  href: string;
}

/**
 * Global search across the trip journey. Uses the RLS-enforced client so
 * agents only ever see their own records. A trip_id pasted from any email
 * or document lands on every record in that trip's chain.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const like = `%${q}%`;

  const [bookingsRes, proposalsRes, enquiriesRes, clientsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, title, trip_id, destination, status, clients(full_name)')
      .or(`trip_id.ilike.${like},title.ilike.${like},destination.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('proposals')
      .select('id, title, trip_id, destination, status')
      .or(`trip_id.ilike.${like},title.ilike.${like},destination.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('website_enquiries')
      .select('id, trip_id, query_id, name, phone, email, destination, status')
      .or(`trip_id.ilike.${like},query_id.ilike.${like},name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('clients')
      .select('id, full_name, phone, email')
      .or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(4),
  ]);

  const results: SearchResult[] = [];

  for (const b of bookingsRes.data || []) {
    const client = b.clients as unknown as { full_name: string } | null;
    results.push({
      type: 'booking',
      id: b.id,
      title: b.title || b.destination || 'Booking',
      subtitle: [client?.full_name, b.status].filter(Boolean).join(' · ') || null,
      trip_id: b.trip_id,
      href: `/bookings/${b.id}`,
    });
  }

  for (const p of proposalsRes.data || []) {
    results.push({
      type: 'proposal',
      id: p.id,
      title: p.title || p.destination || 'Proposal',
      subtitle: p.status || null,
      trip_id: p.trip_id,
      href: `/proposals/${p.id}`,
    });
  }

  for (const e of enquiriesRes.data || []) {
    results.push({
      type: 'enquiry',
      id: e.id,
      title: e.name || e.email || 'Enquiry',
      subtitle: [e.destination, e.status].filter(Boolean).join(' · ') || null,
      trip_id: e.trip_id || e.query_id,
      href: `/leads?enquiry=${e.id}`,
    });
  }

  for (const c of clientsRes.data || []) {
    results.push({
      type: 'client',
      id: c.id,
      title: c.full_name,
      subtitle: c.phone || c.email || null,
      trip_id: null,
      href: `/clients/${c.id}`,
    });
  }

  return NextResponse.json({ results });
}
