import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

// POST /api/client-receipts/[id]/void — reverse a receipt: bookings'
// total_paid comes back down, the linked booking_payments rows are
// cancelled, and the receipt is kept (status: void) for the audit trail.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await withAuth(request, { permission: 'accounts.manage' });
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const supabase = createServiceClient();

    const { data: receipt } = await supabase
      .from('client_receipts')
      .select('*, allocations:client_receipt_allocations(booking_id, amount)')
      .eq('id', id)
      .single();
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    if (receipt.status === 'void') return NextResponse.json({ error: 'Receipt is already void' }, { status: 400 });

    for (const alloc of receipt.allocations || []) {
      const { data: booking } = await supabase
        .from('bookings').select('total_paid').eq('id', alloc.booking_id).single();
      if (booking) {
        const newPaid = Math.max(0, Math.round(((Number(booking.total_paid) || 0) - Number(alloc.amount)) * 100) / 100);
        await supabase.from('bookings').update({ total_paid: newPaid }).eq('id', alloc.booking_id);
      }
      await supabase.from('booking_payments')
        .update({ status: 'cancelled', notes: `Voided receipt ${receipt.receipt_number}` })
        .eq('booking_id', alloc.booking_id)
        .eq('reference_number', receipt.receipt_number)
        .eq('direction', 'receivable');
      await supabase.from('booking_logs').insert({
        booking_id: alloc.booking_id,
        user_id: auth.user.id,
        action: 'payment_voided',
        details: { receipt_number: receipt.receipt_number, amount: alloc.amount, reason: body.reason || null },
      });
    }

    const { error } = await supabase.from('client_receipts').update({
      status: 'void',
      voided_at: new Date().toISOString(),
      void_reason: body.reason || null,
    }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Receipt void error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
