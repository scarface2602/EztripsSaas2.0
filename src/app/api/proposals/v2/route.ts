import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { generateTripIdFromDb } from '@/lib/utils/generateId';
import { getTripIdConfig } from '@/lib/utils/getTripIdConfig';
import { ensureTripFolder, appendProposalToTrip } from '@/lib/trips';

const createSchema = z.object({
  title: z.string().trim().max(200).optional(),
  client_id: z.string().uuid().nullable().optional(),
  enquiry_id: z.string().uuid().nullable().optional(),
});

// POST /api/proposals/v2 — create a blank v2 proposal and return its id.
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const supabase = createServiceClient();
  const insert: Record<string, unknown> = {
    created_by: auth.user.id,
    title: parsed.data.title || 'New Proposal',
    client_id: parsed.data.client_id ?? null,
    status: 'draft',
    builder_version: 2,
  };

  // Created from a lead: link it and carry the trip id through the chain.
  if (parsed.data.enquiry_id) {
    const { data: enquiry } = await supabase
      .from('website_enquiries')
      .select('trip_id, query_id, name, status')
      .eq('id', parsed.data.enquiry_id)
      .single();
    if (enquiry) insert.enquiry_id = parsed.data.enquiry_id;
    // trip_id is the canonical chain field; the live proposals table has
    // no query_id column (that legacy alias lives on enquiries only).
    if (enquiry?.trip_id || enquiry?.query_id) {
      insert.trip_id = enquiry.trip_id ?? enquiry.query_id;
    }
    // Working on a proposal means the lead is qualified — don't leave it "new".
    if (enquiry && ['new', 'contacted'].includes(enquiry.status ?? '')) {
      await supabase
        .from('website_enquiries')
        .update({ status: 'qualified', updated_at: new Date().toISOString() })
        .eq('id', parsed.data.enquiry_id);
    }
  }

  // Standalone proposals (walk-in / phone enquiries with no lead row)
  // still need a trip id — the whole chain (PDF, emails, search, booking
  // conversion) keys off it. Mint one here instead of leaving it null.
  if (!insert.trip_id) {
    const { data: creator } = await supabase
      .from('users').select('org_id').eq('id', auth.user.id).single();
    const config = await getTripIdConfig(supabase, creator?.org_id);
    insert.trip_id = await generateTripIdFromDb(supabase, 'PKG', config);
  }

  // proposals.trip_id FK requires the trips master-folder row first.
  await ensureTripFolder(supabase, insert.trip_id as string, {
    status: 'PROPOSING',
    client_id: (insert.client_id as string | null) ?? null,
    created_by: auth.user.id,
  });

  const { data: proposal, error } = await supabase
    .from('proposals')
    .insert(insert)
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await appendProposalToTrip(supabase, insert.trip_id as string, proposal.id);

  return NextResponse.json({ id: proposal.id });
}
