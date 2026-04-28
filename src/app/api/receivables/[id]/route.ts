import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (body.status === 'paid') {
      updates.status = 'paid';
      updates.paid_at = new Date().toISOString();
      if (body.payment_method) updates.payment_method = body.payment_method;
      if (body.razorpay_payment_id) updates.razorpay_payment_id = body.razorpay_payment_id;
      if (body.notes) updates.notes = body.notes;
    } else if (body.status) {
      updates.status = body.status;
    }

    if (body.notes !== undefined) updates.notes = body.notes;

    const { data, error } = await supabase
      .from('receivables')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
