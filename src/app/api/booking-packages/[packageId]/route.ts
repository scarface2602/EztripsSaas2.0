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

// PATCH: Update a booking package
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
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

    // Update package
    const { data: updated, error } = await supabase
      .from('booking_packages')
      .update(body)
      .eq('id', packageId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
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
