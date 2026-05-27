import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

// PATCH: Update a payment account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const supabase = createServiceClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from('payment_accounts')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('payment_accounts')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating payment account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

// DELETE: Delete a payment account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from('payment_accounts')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if this account is used in any payment schedules
    const { data: schedules } = await supabase
      .from('payment_schedules')
      .select('id')
      .eq('user_id', auth.user.id)
      .limit(1);

    // Simple check: if there are any schedules, warn (detailed JSONB check is complex)
    if (schedules && schedules.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete account that may be used in payment schedules. Please review your schedules first.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('payment_accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
