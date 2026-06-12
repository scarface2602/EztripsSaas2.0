import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

// POST: Create booking package with payment schedule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const auth = await withAuth(request, { permission: 'payments.manage' });
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const {
      supplier_id,
      type = 'individual',
      payments,
    } = body as {
      supplier_id?: string;
      type?: 'full_dmc' | 'partial_dmc' | 'mixed' | 'individual';
      payments: Array<{
        sequence: number;
        amount: number;
        due_date: string;
        reference_number?: string;
        paid_from_account_id?: string;
      }>;
    };

    if (!Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        { error: 'Payments array is required and must have at least one entry' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Verify booking exists and user has access
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, sell_price, cost_price')
      .eq('id', bookingId)
      .eq('created_by', auth.user.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 404 });
    }

    // Calculate total from payment schedule
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    // Create booking package
    const { data: pkg, error: pkgError } = await supabase
      .from('booking_packages')
      .insert({
        booking_id: bookingId,
        supplier_id: supplier_id || null,
        type,
        total_cost: totalAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (pkgError || !pkg) {
      console.error('Package creation error:', pkgError);
      return NextResponse.json(
        { error: 'Failed to create booking package' },
        { status: 500 }
      );
    }

    // Create payment schedule entries
    const paymentInserts = payments.map((p) => ({
      package_id: pkg.id,
      sequence: p.sequence,
      amount: p.amount,
      due_date: p.due_date,
      reference_number: p.reference_number || null,
      paid_from_account_id: p.paid_from_account_id || null,
      status: 'pending',
      amount_paid: 0,
    }));

    const { data: paymentData, error: paymentError } = await supabase
      .from('booking_package_payments')
      .insert(paymentInserts)
      .select();

    if (paymentError) {
      console.error('Payment creation error:', paymentError);
      // Clean up package if payment creation fails
      await supabase.from('booking_packages').delete().eq('id', pkg.id);
      return NextResponse.json(
        { error: 'Failed to create payment schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        package_id: pkg.id,
        payments: paymentData,
        message: 'Payment schedule created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating booking package:', error);
    return NextResponse.json(
      { error: 'Failed to create booking package', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
