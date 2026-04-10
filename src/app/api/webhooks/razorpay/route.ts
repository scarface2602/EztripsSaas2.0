import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // HMAC verification
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    if (!payment) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const amount = payment.amount / 100; // Razorpay sends amount in paise
    const paymentId = payment.id as string;
    const notes = payment.notes || {};
    const proposalId = notes.proposal_id as string | undefined;
    const clientId = notes.client_id as string | undefined;

    if (!proposalId || !clientId) {
      // Try to find by matching receivable with razorpay_payment_id or amount
      return NextResponse.json({ status: 'skipped', reason: 'Missing proposal_id or client_id in notes' });
    }

    // Create client_ledger credit entry (append-only)
    await supabase.from('client_ledger').insert({
      client_id: clientId,
      proposal_id: proposalId,
      type: 'credit',
      amount: amount,
      description: `Razorpay payment ${paymentId}`,
      reference: paymentId,
    });

    // Find and mark matching receivable as paid
    const { data: receivables } = await supabase
      .from('receivables')
      .select('id, amount')
      .eq('proposal_id', proposalId)
      .eq('status', 'pending')
      .order('due_date', { ascending: true });

    if (receivables && receivables.length > 0) {
      // Find receivable matching the amount, or take the first pending one
      const matchingReceivable = receivables.find(r => Math.abs(Number(r.amount) - amount) < 1) || receivables[0];

      await supabase
        .from('receivables')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'razorpay',
          razorpay_payment_id: paymentId,
        })
        .eq('id', matchingReceivable.id);
    }

    return NextResponse.json({ status: 'ok', payment_id: paymentId });
  }

  // Other events — acknowledge but don't process
  return NextResponse.json({ status: 'ignored', event: event.event });
}
