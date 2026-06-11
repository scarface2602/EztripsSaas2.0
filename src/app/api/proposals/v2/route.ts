import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';

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
    if (enquiry?.trip_id || enquiry?.query_id) {
      insert.trip_id = enquiry.trip_id ?? enquiry.query_id;
      insert.query_id = enquiry.query_id ?? enquiry.trip_id;
    }
    // Working on a proposal means the lead is qualified — don't leave it "new".
    if (enquiry && ['new', 'contacted'].includes(enquiry.status ?? '')) {
      await supabase
        .from('website_enquiries')
        .update({ status: 'qualified', updated_at: new Date().toISOString() })
        .eq('id', parsed.data.enquiry_id);
    }
  }

  const { data: proposal, error } = await supabase
    .from('proposals')
    .insert(insert)
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: proposal.id });
}
