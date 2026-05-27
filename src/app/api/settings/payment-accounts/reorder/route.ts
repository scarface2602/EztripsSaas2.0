import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

// POST: Reorder payment accounts
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { order } = body;

    if (!Array.isArray(order)) {
      return NextResponse.json({ error: 'Order must be an array' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Update all accounts in the order
    for (const item of order) {
      const { error } = await supabase
        .from('payment_accounts')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('user_id', auth.user.id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering payment accounts:', error);
    return NextResponse.json({ error: 'Failed to reorder accounts' }, { status: 500 });
  }
}
