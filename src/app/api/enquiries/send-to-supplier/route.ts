import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/mailer';
import { emailLayout } from '@/lib/email/base';

export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const body = await req.json();
  const { enquiry_id, supplier_id, email_to, email_subject, email_body } = body;

  if (!enquiry_id || !supplier_id || !email_to || !email_subject || !email_body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Send the email
  try {
    const html = emailLayout('Enquiry from EzTrips', email_body, {
      footerExtra: 'Please reply to this email with your best rates and availability.',
    });
    await sendEmail(email_to, email_subject, html);
  } catch (err) {
    console.error('Failed to send supplier email:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  // Record the request
  const { data: request, error } = await supabase
    .from('enquiry_supplier_requests')
    .insert({
      enquiry_id,
      supplier_id,
      sent_by: user.id,
      email_to,
      email_subject,
      email_body,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log as enquiry activity
  await supabase.from('enquiry_activities').insert({
    enquiry_id,
    user_id: user.id,
    type: 'email',
    subject: `Sent enquiry to supplier — ${email_subject}`,
    body: `Sent to: ${email_to}`,
  });

  // Update enquiry last_contacted_at
  await supabase.from('website_enquiries')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', enquiry_id);

  return NextResponse.json(request, { status: 201 });
}

// GET: Fetch supplier requests for an enquiry
export async function GET(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const enquiryId = req.nextUrl.searchParams.get('enquiry_id');
  if (!enquiryId) return NextResponse.json({ error: 'enquiry_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('enquiry_supplier_requests')
    .select('*, suppliers(name, type, contact_name)')
    .eq('enquiry_id', enquiryId)
    .order('sent_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH: Update response status
export async function PATCH(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { id, response_status, response_notes } = await req.json();

  if (!id || !response_status) {
    return NextResponse.json({ error: 'id and response_status required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { response_status };
  if (response_notes !== undefined) updates.response_notes = response_notes;
  if (response_status === 'responded') updates.responded_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('enquiry_supplier_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
