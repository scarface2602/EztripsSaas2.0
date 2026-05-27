import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ packageId: string; paymentId: string }>;
}

// PATCH: Update a payment
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { packageId, paymentId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const supabase = createServiceClient();

    // Verify authorization (check booking ownership)
    const { data: pkg } = await supabase
      .from('booking_packages')
      .select('booking_id')
      .eq('id', packageId)
      .single();

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('created_by')
      .eq('id', pkg.booking_id)
      .single();

    if (!booking || booking.created_by !== auth.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update payment
    const { data: payment, error } = await supabase
      .from('booking_package_payments')
      .update(body)
      .eq('id', paymentId)
      .eq('package_id', packageId)
      .select()
      .single();

    if (error) throw error;
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

// DELETE: Delete a payment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { packageId, paymentId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    // Verify authorization
    const { data: pkg } = await supabase
      .from('booking_packages')
      .select('booking_id')
      .eq('id', packageId)
      .single();

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('created_by')
      .eq('id', pkg.booking_id)
      .single();

    if (!booking || booking.created_by !== auth.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { error } = await supabase
      .from('booking_package_payments')
      .delete()
      .eq('id', paymentId)
      .eq('package_id', packageId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
