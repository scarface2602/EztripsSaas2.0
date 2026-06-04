import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch a booking package
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    // Fetch package
    const { data: pkg } = await supabase
      .from('booking_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Verify ownership
    const { data: booking } = await supabase
      .from('bookings')
      .select('created_by')
      .eq('id', pkg.booking_id)
      .single();

    if (!booking || booking.created_by !== auth.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(pkg);
  } catch (error) {
    console.error('Error fetching booking package:', error);
    return NextResponse.json({ error: 'Failed to fetch package' }, { status: 500 });
  }
}

// PATCH: Update a booking package (optionally with full payment schedule replacement)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { payments, ...packageUpdates } = body as {
      payments?: Array<{
        id?: string;
        sequence: number;
        amount: number;
        due_date: string;
        reference_number?: string;
        paid_from_account_id?: string;
        notes?: string;
      }>;
      [key: string]: unknown;
    };

    const supabase = createServiceClient();

    // Verify ownership
    const { data: pkg } = await supabase
      .from('booking_packages')
      .select('booking_id, total_cost')
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

    // Update package metadata if provided
    if (Object.keys(packageUpdates).length > 0) {
      const { error } = await supabase
        .from('booking_packages')
        .update(packageUpdates)
        .eq('id', packageId);
      if (error) throw error;
    }

    // Batch-replace payment schedule if provided
    if (payments && Array.isArray(payments)) {
      // Get existing payments to preserve paid status
      const { data: existingPayments } = await supabase
        .from('booking_package_payments')
        .select('id, status, amount_paid, paid_date')
        .eq('package_id', packageId);

      const paidPaymentIds = new Set(
        (existingPayments || [])
          .filter((p) => p.status === 'paid' || (p.amount_paid && p.amount_paid > 0))
          .map((p) => p.id)
      );

      // Delete non-paid existing payments
      const idsToDelete = (existingPayments || [])
        .filter((p) => !paidPaymentIds.has(p.id))
        .map((p) => p.id);

      if (idsToDelete.length > 0) {
        await supabase
          .from('booking_package_payments')
          .delete()
          .in('id', idsToDelete);
      }

      // Upsert new payments (skip already-paid ones)
      const newPayments = payments
        .filter((p) => !p.id || !paidPaymentIds.has(p.id))
        .map((p) => ({
          ...(p.id && !paidPaymentIds.has(p.id) ? {} : {}),
          package_id: packageId,
          sequence: p.sequence,
          amount: p.amount,
          due_date: p.due_date,
          reference_number: p.reference_number || null,
          paid_from_account_id: p.paid_from_account_id || null,
          notes: p.notes || null,
          status: 'pending',
          amount_paid: 0,
        }));

      if (newPayments.length > 0) {
        const { error: insertError } = await supabase
          .from('booking_package_payments')
          .insert(newPayments);
        if (insertError) throw insertError;
      }

      // Update package total_cost
      const newTotal = payments.reduce((sum, p) => sum + p.amount, 0);
      await supabase
        .from('booking_packages')
        .update({ total_cost: newTotal })
        .eq('id', packageId);
    }

    // Return updated package with payments
    const { data: updated } = await supabase
      .from('booking_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    const { data: updatedPayments } = await supabase
      .from('booking_package_payments')
      .select('*')
      .eq('package_id', packageId)
      .order('sequence');

    return NextResponse.json({ ...updated, payments: updatedPayments || [] });
  } catch (error) {
    console.error('Error updating booking package:', error);
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 });
  }
}

// DELETE: Delete a booking package
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    // Verify ownership
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
      .from('booking_packages')
      .delete()
      .eq('id', packageId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting booking package:', error);
    return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 });
  }
}
