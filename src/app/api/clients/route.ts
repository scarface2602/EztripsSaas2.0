import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { createClientSchema } from '@/lib/schemas/clients';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    const search = request.nextUrl.searchParams.get('search') || '';

    let query = supabase.from('clients').select('*').order('created_at', { ascending: false });

    // Ownership filter: agents only see their own clients
    if (auth.user.role !== 'super_admin') {
      query = query.eq('created_by', auth.authUser.id);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (err) {
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const validated = createClientSchema.parse(body);

    const supabase = createServiceClient();
    const { data, error } = await supabase.from('clients').insert({
      ...validated,
      created_by: auth.authUser.id,
    }).select().single();

    if (error) {
      if (error.code === '23505' && error.message.includes('clients_phone_unique')) {
        return NextResponse.json({ error: 'A client with this phone number already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
