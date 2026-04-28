import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { updateClientSchema } from '@/lib/schemas/clients';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await withAuth(request, { checkOwnership: { table: 'clients', id } });
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    return NextResponse.json(data);
  } catch (err) {
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await withAuth(request, { checkOwnership: { table: 'clients', id } });
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const validated = updateClientSchema.parse(body);

    const supabase = createServiceClient();
    const { data, error } = await supabase.from('clients').update(validated).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await withAuth(request, { checkOwnership: { table: 'clients', id } });
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    const { count } = await supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('client_id', id);
    if (count && count > 0) {
      return NextResponse.json({ error: 'Cannot delete client with linked proposals' }, { status: 400 });
    }

    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
