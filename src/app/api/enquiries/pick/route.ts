import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { enquiry_id } = await request.json();
  if (!enquiry_id) {
    return NextResponse.json({ error: 'enquiry_id is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get agent's max_active_leads
  const { data: agent } = await supabase
    .from('users')
    .select('max_active_leads')
    .eq('id', authData.user.id)
    .single();

  const maxLeads = agent?.max_active_leads ?? 10;

  // Count current active leads
  const { count } = await supabase
    .from('website_enquiries')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', authData.user.id)
    .in('status', ['new', 'contacted', 'qualified']);

  if ((count ?? 0) >= maxLeads) {
    return NextResponse.json(
      { error: `You have reached your max active leads limit (${maxLeads})` },
      { status: 400 }
    );
  }

  // Check the lead is unassigned
  const { data: enquiry } = await supabase
    .from('website_enquiries')
    .select('assigned_to')
    .eq('id', enquiry_id)
    .single();

  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
  }
  if (enquiry.assigned_to) {
    return NextResponse.json({ error: 'This lead is already assigned' }, { status: 400 });
  }

  // Assign to self
  const { data, error } = await supabase
    .from('website_enquiries')
    .update({ assigned_to: authData.user.id, updated_at: new Date().toISOString() })
    .eq('id', enquiry_id)
    .is('assigned_to', null) // double-check still unassigned (race condition guard)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to pick lead — it may have been assigned already' }, { status: 409 });
  }

  return NextResponse.json(data);
}
