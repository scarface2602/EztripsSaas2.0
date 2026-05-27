import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch all payments for a package
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    // Verify user owns the booking this package belongs to
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

    // Fetch payments
    const { data: payments, error } = await supabase
      .from('booking_package_payments')
      .select('*')
      .eq('package_id', packageId)
      .order('sequence', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ payments: payments || [] });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST: Create a payment for a package
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const supabase = createServiceClient();

    // Verify user owns the booking this package belongs to
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

    // Create payment
    const { data: payment, error } = await supabase
      .from('booking_package_payments')
      .insert([
        {
          package_id: packageId,
          ...body,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
