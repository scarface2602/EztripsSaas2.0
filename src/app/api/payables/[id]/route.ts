import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const updates: Record<string, unknown> = {};

  if (body.status === 'paid') {
    updates.status = 'paid';
    updates.paid_at = new Date().toISOString();
    if (body.reference) updates.reference = body.reference;
    if (body.notes) updates.notes = body.notes;
  } else if (body.status) {
    updates.status = body.status;
  }

  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.reference !== undefined) updates.reference = body.reference;

  const { data, error } = await supabase
    .from('payables')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
