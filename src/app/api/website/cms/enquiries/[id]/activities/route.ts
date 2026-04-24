import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';

async function getUser() {
  const authClient = await createClient();
  const { data } = await authClient.auth.getUser();
  return data.user;
}

// GET /api/website/cms/enquiries/[id]/activities
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('enquiry_activities')
    .select('*, users(full_name)')
    .eq('enquiry_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/website/cms/enquiries/[id]/activities
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  body.enquiry_id = params.id;
  body.user_id = user.id;

  const supabase = createServiceClient();

  // Insert activity
  const { data, error } = await supabase.from('enquiry_activities').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update enquiry's last_contacted_at for communication types
  const contactTypes = ['call_outgoing', 'call_incoming', 'whatsapp', 'email', 'sms', 'meeting'];
  if (contactTypes.includes(body.type)) {
    await supabase.from('website_enquiries').update({
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', params.id);
  }

  // If activity sets a follow-up, update the enquiry follow_up_date
  if (body.follow_up_date) {
    await supabase.from('website_enquiries').update({
      follow_up_date: body.follow_up_date,
      updated_at: new Date().toISOString(),
    }).eq('id', params.id);
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH — mark follow-up as done
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { activity_id } = await req.json();
  if (!activity_id) return NextResponse.json({ error: 'activity_id required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('enquiry_activities')
    .update({ follow_up_done: true })
    .eq('id', activity_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
