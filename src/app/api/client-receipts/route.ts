import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

export const dynamic = 'force-dynamic';

const MODE_BY_ACCOUNT_TYPE: Record<string, string> = {
  bank: 'bank_transfer', upi: 'upi', cash: 'cash', card: 'card',
  payment_gateway: 'portal_wallet', wallet: 'portal_wallet',
};

const createReceiptSchema = z.object({
  client_id: z.string().uuid(),
  amount: z.number().positive(),
  received_on: z.string().min(8),
  account_id: z.string().uuid().optional().nullable(),
  reference: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  allocations: z.array(z.object({
    booking_id: z.string().uuid(),
    amount: z.number().positive(),
  })).default([]),
}).refine(
  (d) => d.allocations.reduce((s, a) => s + a.amount, 0) <= d.amount + 0.01,
  { message: 'Allocations exceed the receipt amount' },
);

// GET /api/client-receipts?client_id= — list receipts with allocation totals
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'payments.manage' });
    if (auth instanceof NextResponse) return auth;

    const clientId = request.nextUrl.searchParams.get('client_id');
    const supabase = createServiceClient();

    let query = supabase
      .from('client_receipts')
      .select('*, client:clients(full_name, client_kind), account:payment_accounts(account_name, account_type), allocations:client_receipt_allocations(amount, booking_id, booking:bookings(trip_id, title))')
      .order('created_at', { ascending: false })
      .limit(100);
    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []).map((r) => {
      const allocated = (r.allocations || []).reduce((s: number, a: { amount: number }) => s + Number(a.amount), 0);
      return { ...r, allocated, unallocated: Math.round((Number(r.amount) - allocated) * 100) / 100 };
    });
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Client receipts list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/client-receipts — record a receipt and allocate it across
// bookings. Each allocation also lands in booking_payments (so the
// booking page shows it) and bumps bookings.total_paid (so the register
// dues update).
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'payments.manage' });
    if (auth instanceof NextResponse) return auth;

    const d = createReceiptSchema.parse(await request.json());
    const supabase = createServiceClient();

    const { data: payer } = await supabase.from('clients').select('id, full_name').eq('id', d.client_id).single();
    if (!payer) return NextResponse.json({ error: 'Payer not found' }, { status: 404 });

    let paymentMode: string | null = null;
    if (d.account_id) {
      const { data: account } = await supabase.from('payment_accounts').select('account_type').eq('id', d.account_id).single();
      if (!account) return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
      paymentMode = MODE_BY_ACCOUNT_TYPE[account.account_type] || null;
    }

    const { data: receiptNumber, error: numErr } = await supabase.rpc('generate_client_receipt_number');
    if (numErr || !receiptNumber) {
      return NextResponse.json({ error: 'Failed to generate receipt number' }, { status: 500 });
    }

    const { data: receipt, error: rErr } = await supabase.from('client_receipts').insert({
      receipt_number: receiptNumber,
      client_id: d.client_id,
      amount: d.amount,
      received_on: d.received_on,
      account_id: d.account_id || null,
      payment_mode: paymentMode,
      reference: d.reference || null,
      notes: d.notes || null,
      created_by: auth.user.id,
    }).select().single();
    if (rErr || !receipt) {
      return NextResponse.json({ error: rErr?.message || 'Failed to create receipt' }, { status: 500 });
    }

    const results: Array<{ booking_id: string; amount: number }> = [];
    for (const alloc of d.allocations) {
      const { data: booking } = await supabase
        .from('bookings').select('id, total_paid, trip_id').eq('id', alloc.booking_id).single();
      if (!booking) continue;

      await supabase.from('client_receipt_allocations').insert({
        receipt_id: receipt.id,
        booking_id: alloc.booking_id,
        amount: alloc.amount,
        created_by: auth.user.id,
      });

      await supabase.from('bookings')
        .update({ total_paid: Math.round(((Number(booking.total_paid) || 0) + alloc.amount) * 100) / 100 })
        .eq('id', alloc.booking_id);

      await supabase.from('booking_payments').insert({
        booking_id: alloc.booking_id,
        direction: 'receivable',
        client_id: d.client_id,
        amount: alloc.amount,
        paid_date: d.received_on,
        payment_mode: paymentMode,
        reference_number: receiptNumber,
        status: 'paid',
        notes: `Allocated from receipt ${receiptNumber} (${payer.full_name})`,
      });

      await supabase.from('booking_logs').insert({
        booking_id: alloc.booking_id,
        user_id: auth.user.id,
        action: 'payment_received',
        details: { receipt_number: receiptNumber, amount: alloc.amount, payer: payer.full_name, mode: paymentMode },
      });

      results.push({ booking_id: alloc.booking_id, amount: alloc.amount });
    }

    const allocated = results.reduce((s, a) => s + a.amount, 0);
    return NextResponse.json({
      ...receipt,
      allocated,
      unallocated: Math.round((d.amount - allocated) * 100) / 100,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }
    console.error('Client receipt create error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
