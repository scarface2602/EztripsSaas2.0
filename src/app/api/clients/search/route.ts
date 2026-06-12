import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

export const dynamic = 'force-dynamic';

// GET /api/clients/search?q= — billing-aware client search.
// Returns direct name/phone/email matches PLUS businesses whose contact
// person matched, so typing "vijay" surfaces both "Vijay Kumar Jain"
// and "Big Shop (contact: Vijay Kumar Jain)" together.
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const q = (request.nextUrl.searchParams.get('q') || '').trim();
    const supabase = createServiceClient();

    // Org scoping, same convention as /api/clients
    let creatorIds: string[] | null = null;
    if (auth.user.role !== 'super_admin') {
      if (auth.user.org_id) {
        const { data: orgUsers } = await supabase.from('users').select('id').eq('org_id', auth.user.org_id);
        creatorIds = (orgUsers || []).map((u: { id: string }) => u.id);
      } else {
        creatorIds = [auth.authUser.id];
      }
    }

    const baseSelect = 'id, full_name, phone, email, client_kind, gstin, gst_legal_name, contact_client_id';

    let query = supabase.from('clients').select(baseSelect).order('full_name').limit(12);
    if (creatorIds) query = query.in('created_by', creatorIds);
    if (q) {
      const safe = q.replace(/[%,()]/g, '');
      query = query.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%,gstin.ilike.%${safe}%`);
    }

    const { data: direct, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const results = direct || [];
    const ids = new Set(results.map((c) => c.id));

    // Businesses whose contact person is among the matched individuals
    const individualIds = results.filter((c) => (c.client_kind || 'individual') === 'individual').map((c) => c.id);
    if (individualIds.length > 0) {
      let linkedQuery = supabase.from('clients').select(baseSelect).in('contact_client_id', individualIds).limit(8);
      if (creatorIds) linkedQuery = linkedQuery.in('created_by', creatorIds);
      const { data: linked } = await linkedQuery;
      for (const c of linked || []) {
        if (!ids.has(c.id)) {
          ids.add(c.id);
          results.push(c);
        }
      }
    }

    // Resolve contact names for businesses in one shot
    const contactIds = Array.from(new Set(results.map((c) => c.contact_client_id).filter(Boolean))) as string[];
    let contactNames: Record<string, string> = {};
    if (contactIds.length > 0) {
      const { data: contacts } = await supabase.from('clients').select('id, full_name').in('id', contactIds);
      contactNames = Object.fromEntries((contacts || []).map((c) => [c.id, c.full_name]));
    }

    // Businesses first (they're the billing accounts), then individuals
    const enriched = results
      .map((c) => ({
        ...c,
        client_kind: c.client_kind || 'individual',
        contact_name: c.contact_client_id ? contactNames[c.contact_client_id] || null : null,
      }))
      .sort((a, b) =>
        a.client_kind === b.client_kind
          ? a.full_name.localeCompare(b.full_name)
          : a.client_kind === 'business' ? -1 : 1,
      );

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('Client search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
