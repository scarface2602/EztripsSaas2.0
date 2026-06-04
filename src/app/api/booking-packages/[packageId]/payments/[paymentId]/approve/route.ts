import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ packageId: string; paymentId: string }>;
}

// POST: Approve or reject a payment
// Body: { action: 'approve' | 'reject', notes?: string }
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { packageId, paymentId } = await params;
    const auth = await withAuth(request, {
      allowedRoles: ['manager', 'super_admin'],
    });
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { action, notes } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify package and booking exist
    const { data: pkg } = await supabase
      .from('booking_packages')
      .select('booking_id')
      .eq('id', packageId)
      .single();

    if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });

    // Fetch current payment
    const { data: payment } = await supabase
      .from('booking_package_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('package_id', packageId)
      .single();

    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    if (payment.approval_status === 'approved' && action === 'approve') {
      return NextResponse.json({ error: 'Payment already approved' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { data: updated, error } = await supabase
      .from('booking_package_payments')
      .update({
        approval_status: newStatus,
        approved_by: auth.user.id,
        approved_at: now,
        ...(notes ? { approval_notes: notes } : {}),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await supabase.from('booking_logs').insert({
      booking_id: pkg.booking_id,
      user_id: auth.user.id,
      action: action === 'approve' ? 'payment_approved' : 'payment_rejected',
      details: {
        payment_id: paymentId,
        amount: payment.amount,
        approval_notes: notes || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error approving payment:', error);
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
  }
}
