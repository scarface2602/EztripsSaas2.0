import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:booking-emails');

async function getUser() {
  const authClient = await createClient();
  const { data } = await authClient.auth.getUser();
  return data.user;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_emails')
    .select('*, suppliers(name)')
    .eq('booking_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('list', 'Failed to fetch emails', { bookingId: id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  body.booking_id = id;
  body.sent_by = user.id;

  logger.info('create', 'Creating email', { bookingId: id, subject: body.subject, template: body.template_type });

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('booking_emails').insert(body).select().single();

  if (error) {
    logger.error('create', 'Failed to create email', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: body.status === 'sent' ? 'email_sent' : 'email_drafted',
    details: { email_id: data.id, subject: data.subject, to: data.to_email },
  });

  logger.info('create', 'Email created', { bookingId: id, emailId: data.id, status: data.status });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { email_id, ...updates } = body;

  if (!email_id) return NextResponse.json({ error: 'email_id required' }, { status: 400 });

  logger.info('update', 'Updating email', { bookingId: id, emailId: email_id });

  const supabase = createServiceClient();

  if (updates.status === 'sent') {
    updates.sent_at = new Date().toISOString();
    updates.sent_by = user.id;
  }

  const { data, error } = await supabase
    .from('booking_emails')
    .update(updates)
    .eq('id', email_id)
    .select()
    .single();

  if (error) {
    logger.error('update', 'Failed to update email', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (updates.status === 'sent') {
    await supabase.from('booking_logs').insert({
      booking_id: id,
      user_id: user.id,
      action: 'email_sent',
      details: { email_id, subject: data.subject, to: data.to_email },
    });
  }

  return NextResponse.json(data);
}
