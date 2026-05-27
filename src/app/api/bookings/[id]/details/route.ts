import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch booking with packages and payments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    // Fetch booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('created_by', auth.user.id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Fetch booking packages
    const { data: packages } = await supabase
      .from('booking_packages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    // Fetch all payments for all packages
    const packageIds = packages?.map((p) => p.id) || [];
    const { data: allPayments } = await supabase
      .from('booking_package_payments')
      .select('*')
      .in('package_id', packageIds.length > 0 ? packageIds : ['null'])
      .order('sequence', { ascending: true });

    // Fetch payment accounts for the user
    const { data: paymentAccounts } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('sort_order', { ascending: true });

    // Organize payments by package
    const paymentsByPackage = new Map<string, typeof allPayments>();
    allPayments?.forEach((payment) => {
      if (!paymentsByPackage.has(payment.package_id)) {
        paymentsByPackage.set(payment.package_id, []);
      }
      paymentsByPackage.get(payment.package_id)!.push(payment);
    });

    // Build response with packages and their payments
    const packagesWithPayments = packages?.map((pkg) => ({
      ...pkg,
      payments: paymentsByPackage.get(pkg.id) || [],
    })) || [];

    return NextResponse.json({
      booking,
      packages: packagesWithPayments,
      paymentAccounts: paymentAccounts || [],
    });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    return NextResponse.json({ error: 'Failed to fetch booking details' }, { status: 500 });
  }
}
