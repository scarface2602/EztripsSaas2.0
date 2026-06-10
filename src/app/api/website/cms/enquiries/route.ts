import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireApiAdmin } from '@/lib/auth/require-api-admin';
import { generateTripIdFromDb, requirementToServiceType } from '@/lib/utils/generateId';
import { getTripIdConfig } from '@/lib/utils/getTripIdConfig';

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const status = request.nextUrl.searchParams.get('status');

  let query = supabase.from('website_enquiries').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { name, phone, email, destination, travel_date, adults, children, children_ages, budget_range, number_of_nights, hotel_category, special_requirements, notes, source, requirement_type, requirement_details } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Check for potential duplicate (same phone + destination in last 7 days)
  let duplicate_warning: string | null = null;
  if (phone) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dupQ = supabase
      .from('website_enquiries')
      .select('id, name, created_at')
      .eq('phone', phone)
      .gte('created_at', sevenDaysAgo)
      .limit(1);
    if (destination) dupQ.eq('destination', destination);
    const { data: dupes } = await dupQ;
    if (dupes && dupes.length > 0) {
      duplicate_warning = `Possible duplicate: ${dupes[0].name} (${new Date(dupes[0].created_at).toLocaleDateString()})`;
    }
  }

  // Fetch org config for trip ID format
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  let orgId: string | null = null;
  if (authUser) {
    const { data: userData } = await supabase.from('users').select('org_id').eq('id', authUser.id).single();
    orgId = userData?.org_id || null;
  }
  const tripIdConfig = await getTripIdConfig(supabase, orgId);

  // Generate trip_id
  const tripId = await generateTripIdFromDb(supabase, requirementToServiceType(requirement_type || 'package'), tripIdConfig);

  const { data, error } = await supabase
    .from('website_enquiries')
    .insert({
      name,
      phone,
      email: email || null,
      destination: destination || null,
      travel_date: travel_date || null,
      adults: adults || 1,
      children: children || 0,
      children_ages: children_ages || null,
      budget_range: budget_range || null,
      number_of_nights: number_of_nights || null,
      hotel_category: hotel_category || null,
      special_requirements: special_requirements || null,
      notes: notes || null,
      source: source || 'offline',
      requirement_type: requirement_type || 'package',
      requirement_details: requirement_details || {},
      status: 'new',
      priority: 'medium',
      lead_temperature: 'warm',
      trip_id: tripId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, duplicate_warning }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createServiceClient();

  // If assigning to an agent, check their max_active_leads limit
  if (body.assigned_to) {
    const { data: agent } = await supabase
      .from('users')
      .select('max_active_leads')
      .eq('id', body.assigned_to)
      .single();

    if (agent) {
      const { count } = await supabase
        .from('website_enquiries')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', body.assigned_to)
        .in('status', ['new', 'contacted', 'qualified'])
        .neq('id', id); // exclude the current enquiry if reassigning

      if ((count ?? 0) >= (agent.max_active_leads ?? 10)) {
        return NextResponse.json(
          { error: `Agent has reached their max active leads limit (${agent.max_active_leads ?? 10})` },
          { status: 400 }
        );
      }
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    'status', 'notes', 'assigned_to', 'priority', 'lead_temperature',
    'follow_up_date', 'last_contacted_at', 'converted_at',
    'lost_reason', 'lost_notes',
    'destination', 'travel_date', 'number_of_nights', 'adults', 'children',
    'children_ages', 'budget_range', 'hotel_category', 'special_requirements',
    'requirement_details',
  ];
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  const { data, error } = await supabase.from('website_enquiries').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
