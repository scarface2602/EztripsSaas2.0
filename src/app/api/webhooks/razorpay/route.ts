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

    const bookingId = notes.booking_id as string | undefined;
    const paymentLinkToken = notes.payment_link_token as string | undefined;

    // --- Legacy receivables flow (proposal-based) ---
    if (proposalId && clientId) {
      await supabase.from('client_ledger').insert({
        client_id: clientId,
        proposal_id: proposalId,
        type: 'credit',
        amount: amount,
        description: `Razorpay payment ${paymentId}`,
        reference: paymentId,
      });

      const { data: receivables } = await supabase
        .from('receivables')
        .select('id, amount')
        .eq('proposal_id', proposalId)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      if (receivables && receivables.length > 0) {
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
    }

    // --- New booking_payments flow ---
    // Resolve booking_id: from notes directly, or from proposal
    let resolvedBookingId = bookingId;
    if (!resolvedBookingId && proposalId) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('proposal_id', proposalId)
        .limit(1);
      if (bookings && bookings.length > 0) {
        resolvedBookingId = bookings[0].id;
      }
    }

    if (resolvedBookingId) {
      // Insert receivable entry into booking_payments
      await supabase.from('booking_payments').insert({
        booking_id: resolvedBookingId,
        installment_label: `Razorpay payment`,
        amount,
        currency: (payment.currency as string)?.toUpperCase() || 'INR',
        paid_date: new Date().toISOString().split('T')[0],
        payment_mode: 'razorpay',
        reference_number: paymentId,
        status: 'paid',
      });
    }

    // --- Mark payment link as used ---
    if (paymentLinkToken) {
      await supabase
        .from('payment_links')
        .update({ status: 'used', used_at: new Date().toISOString() })
        .eq('token', paymentLinkToken)
        .eq('status', 'active');
    }

    // --- Update pipeline_stage on enquiry ---
    if (proposalId) {
      const { data: proposal } = await supabase
        .from('proposals')
        .select('enquiry_id')
        .eq('id', proposalId)
        .single();

      if (proposal?.enquiry_id) {
        await supabase
          .from('website_enquiries')
          .update({ pipeline_stage: 'payment_received', updated_at: new Date().toISOString() })
          .eq('id', proposal.enquiry_id);
      }
    }

    return NextResponse.json({ status: 'ok', payment_id: paymentId });
  }

  // Other events — acknowledge but don't process
  return NextResponse.json({ status: 'ignored', event: event.event });
}
