import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { receiptHTML } from '@/lib/receipts/template';
import { htmlToPdf } from '@/lib/vouchers/pdf';
import { sendEmail } from '@/lib/email/mailer';
import { emailLayout } from '@/lib/email/base';
import { format } from 'date-fns';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

async function getUser() {
  const authClient = await createClient();
  const { data } = await authClient.auth.getUser();
  return data.user;
}

async function urlToBase64DataUri(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
  } catch {
    return '';
  }
}

// GET /api/bookings/[id]/receipts — list receipts
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('booking_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/bookings/[id]/receipts — generate a receipt
// Body: { amount, payment_mode, payment_date, reference_number?, notes? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { amount, payment_mode, payment_date, reference_number, notes } = body;

  if (!amount || !payment_date) {
    return NextResponse.json({ error: 'amount and payment_date are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Generate receipt number
  const { data: receiptNumber, error: numErr } = await supabase.rpc('generate_receipt_number');
  if (numErr || !receiptNumber) {
    return NextResponse.json({ error: 'Failed to generate receipt number' }, { status: 500 });
  }

  // Fetch booking with client
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, clients(full_name, email, phone)')
    .eq('id', id)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  // Total booking amount (sell price)
  const totalBookingAmount = Number(booking.sell_price || 0);

  // Calculate total paid so far
  const { data: custPayments } = await supabase
    .from('customer_payments')
    .select('amount, payment_type')
    .eq('booking_id', id);

  const previouslyPaid = (custPayments || []).reduce((sum: number, p: any) => {
    return sum + (p.payment_type === 'refund' ? -Number(p.amount) : Number(p.amount));
  }, 0);

  const totalPaidSoFar = previouslyPaid + Number(amount);
  const balanceRemaining = Math.max(0, totalBookingAmount - totalPaidSoFar);

  // Fetch org branding
  const { data: agentUser } = await supabase
    .from('users')
    .select('*, organisations(name, logo_url, phone, email, address, gstin)')
    .eq('id', booking.created_by)
    .single();

  const org = agentUser?.organisations as Record<string, string> | null;
  const orgName = org?.name || agentUser?.agency_name || 'EzTrips';
  const orgLogoUrl = org?.logo_url || agentUser?.logo_url || '';
  const logoDataUri = orgLogoUrl ? await urlToBase64DataUri(orgLogoUrl) : '';

  const client = booking.clients as any;

  // Generate HTML
  const html = receiptHTML({
    receiptNumber,
    receiptDate: format(new Date(payment_date), 'dd MMM yyyy'),
    orgName,
    orgAddress: org?.address,
    orgPhone: org?.phone,
    orgEmail: org?.email,
    orgGstin: org?.gstin,
    logoDataUri: logoDataUri || undefined,
    clientName: client?.full_name || 'Guest',
    clientEmail: client?.email,
    clientPhone: client?.phone,
    bookingTitle: booking.title,
    destination: booking.destination,
    tripId: booking.trip_id || undefined,
    amount: Number(amount),
    paymentMode: payment_mode || undefined,
    referenceNumber: reference_number || undefined,
    currency: booking.currency || 'INR',
    totalBookingAmount,
    totalPaidSoFar,
    balanceRemaining,
    notes: notes || undefined,
  });

  // Generate PDF
  let pdfUrl: string | null = null;
  try {
    const pdfBuffer = await htmlToPdf(html);
    const filename = `receipts/${id}/${receiptNumber.replace(/\//g, '-')}_${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('vouchers')
      .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from('vouchers').getPublicUrl(filename);
      pdfUrl = urlData?.publicUrl || null;
    }
  } catch {
    // Non-fatal
  }

  // Save receipt record
  const { data: receipt, error: rErr } = await supabase
    .from('receipts')
    .insert({
      booking_id: id,
      receipt_number: receiptNumber,
      amount: Number(amount),
      payment_mode: payment_mode || null,
      payment_date,
      balance_remaining: balanceRemaining,
      pdf_url: pdfUrl,
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  // Log activity
  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'receipt_generated',
    details: { receipt_id: receipt.id, receipt_number: receiptNumber, amount },
  });

  // Auto-email receipt to client
  if (client?.email && pdfUrl) {
    try {
      const cur = booking.currency === 'INR' ? '₹' : booking.currency || '₹';
      const emailHtml = emailLayout('Payment Receipt', `
        <p>Dear ${client.full_name || 'Guest'},</p>
        <p>Thank you for your payment of <strong>${cur}${Number(amount).toLocaleString('en-IN')}</strong> for booking "<strong>${booking.title || 'Travel Booking'}</strong>".</p>
        <p>Receipt Number: <strong>${receiptNumber}</strong></p>
        <p>Balance Remaining: <strong>${cur}${balanceRemaining.toLocaleString('en-IN')}</strong></p>
        <p style="margin-top:16px;"><a href="${pdfUrl}" style="background:#166534;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Download Receipt</a></p>
        <p style="margin-top:24px;">Regards,<br/><strong>${agentUser?.full_name || 'Agent'}</strong>${org?.name ? `<br/>${org.name}` : ''}</p>
      `);

      await sendEmail(client.email, `Payment Receipt — ${receiptNumber}`, emailHtml);

      await supabase.from('booking_emails').insert({
        booking_id: id,
        direction: 'outgoing',
        to_address: client.email,
        subject: `Payment Receipt — ${receiptNumber}`,
        body_html: emailHtml,
        sent_at: new Date().toISOString(),
        sent_by: user.id,
      });
    } catch {
      // Email failure is non-fatal
    }
  }

  return NextResponse.json(receipt, { status: 201 });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
