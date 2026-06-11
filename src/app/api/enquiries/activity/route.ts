import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const body = await req.json();
  const { enquiry_id, type, subject, body: actBody, outcome, follow_up_date, duration_minutes } = body;

  if (!enquiry_id || !type) {
    return NextResponse.json({ error: 'enquiry_id and type are required' }, { status: 400 });
  }

  // Insert activity
  const { data: activity, error } = await supabase
    .from('enquiry_activities')
    .insert({
      enquiry_id,
      user_id: user.id,
      type,
      subject: subject || null,
      body: actBody || null,
      outcome: outcome || null,
      follow_up_date: follow_up_date || null,
      duration_minutes: duration_minutes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update enquiry fields based on activity
  const enquiryUpdates: Record<string, unknown> = {
    last_contacted_at: new Date().toISOString(),
  };

  // First touch on the lead stops the SLA clock and moves it off "new" —
  // a lead with a logged call/WhatsApp is contacted by definition.
  const { data: enquiryRow } = await supabase
    .from('website_enquiries')
    .select('first_responded_at, status')
    .eq('id', enquiry_id)
    .single();
  if (enquiryRow && !enquiryRow.first_responded_at) {
    enquiryUpdates.first_responded_at = new Date().toISOString();
  }
  if (!body.status && enquiryRow?.status === 'new') {
    enquiryUpdates.status = 'contacted';
  }

  // If follow-up date set, update on enquiry too
  if (follow_up_date) {
    enquiryUpdates.follow_up_date = follow_up_date;
  }

  // Update temperature if provided
  if (body.lead_temperature) {
    enquiryUpdates.lead_temperature = body.lead_temperature;
  }

  // Update status if provided
  if (body.status) {
    enquiryUpdates.status = body.status;
  }

  await supabase
    .from('website_enquiries')
    .update(enquiryUpdates)
    .eq('id', enquiry_id);

  return NextResponse.json(activity, { status: 201 });
}
