import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  amount: z.number().min(1),
  currency: z.string().default('INR'),
  proposal_id: z.string().optional(),
  client_id: z.string().optional(),
  booking_id: z.string().optional(),
  payment_link_token: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { amount, currency, proposal_id, client_id, booking_id, payment_link_token } = parsed.data;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 });
  }

  // If payment_link_token provided, validate it
  if (payment_link_token) {
    const supabase = createServiceClient();
    const { data: link } = await supabase
      .from('payment_links')
      .select('id, amount, status')
      .eq('token', payment_link_token)
      .single();

    if (!link || link.status !== 'active') {
      return NextResponse.json({ error: 'Payment link is invalid or expired' }, { status: 400 });
    }
    // Verify amount matches the link
    if (Math.abs(Number(link.amount) - amount) > 1) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }
  }

  // Create Razorpay order via REST API
  const amountInPaise = Math.round(amount * 100);

  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency,
      notes: {
        proposal_id: proposal_id || '',
        client_id: client_id || '',
        booking_id: booking_id || '',
        payment_link_token: payment_link_token || '',
      },
    }),
  });

  if (!orderRes.ok) {
    const err = await orderRes.text();
    console.error('[razorpay] Order creation failed:', err);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  const order = await orderRes.json();

  return NextResponse.json({
    order_id: order.id,
    amount: amountInPaise,
    currency,
    key_id: keyId,
  });
}
