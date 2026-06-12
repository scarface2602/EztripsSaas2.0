import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api/with-auth';
import { sendEmail } from '@/lib/email/mailer';
import { paymentReminderEmail } from '@/lib/email/payment-reminder';
import { format } from 'date-fns';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;
  const user = await getAuthUser('ops.actions');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const body = await req.json();
  const { amount_due, due_date, to_email } = body;

  // Fetch booking with client and proposal (for share_token / payment link)
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, clients(full_name, email), proposals(share_token, title)')
    .eq('id', bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const clientEmail = to_email || booking.clients?.email;
  if (!clientEmail) return NextResponse.json({ error: 'No client email' }, { status: 400 });

  // Fetch agent info
  const { data: agent } = await supabase.from('users').select('full_name').eq('id', user.id).single();

  // Calculate amounts
  const totalAmount = Number(booking.sell_price) || 0;

  // Get total paid from package payments
  const { data: pkgPayments } = await supabase
    .from('booking_package_payments')
    .select('amount_paid, status')
    .eq('booking_id', bookingId);

  const amountPaid = (pkgPayments || [])
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount_paid || 0), 0);

  const effectiveAmountDue = amount_due || (totalAmount - amountPaid);
  const effectiveDueDate = due_date || format(new Date(), 'dd MMM yyyy');

  const travelDates = booking.travel_start
    ? `${format(new Date(booking.travel_start), 'dd MMM yyyy')}${booking.travel_end ? ` – ${format(new Date(booking.travel_end), 'dd MMM yyyy')}` : ''}`
    : '';

  // Build payment link from share_token
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eztrips-saas.vercel.app';
  const shareToken = booking.proposals?.share_token;
  const paymentLink = shareToken ? `${appUrl}/p/${shareToken}` : undefined;

  const email = paymentReminderEmail({
    clientName: booking.clients?.full_name || 'Client',
    bookingTitle: booking.title,
    destination: booking.destination || undefined,
    travelDates,
    totalAmount,
    amountPaid,
    amountDue: effectiveAmountDue,
    dueDate: effectiveDueDate,
    currency: booking.currency || 'INR',
    paymentLink,
    agentName: agent?.full_name || 'Agent',
  });

  try {
    await sendEmail(clientEmail, email.subject, email.html);

    // Log in booking_emails
    await supabase.from('booking_emails').insert({
      booking_id: bookingId,
      to_email: clientEmail,
      subject: email.subject,
      body: email.html,
      template_type: 'payment_reminder',
      direction: 'outbound',
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: user.id,
    });

    // Log activity
    await supabase.from('booking_logs').insert({
      booking_id: bookingId,
      user_id: user.id,
      action: 'payment_reminder_sent',
      details: { to: clientEmail, amount_due: effectiveAmountDue, due_date: effectiveDueDate },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send email', details: String(err) }, { status: 500 });
  }
}
