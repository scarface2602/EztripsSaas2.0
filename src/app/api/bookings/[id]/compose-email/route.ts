import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/mailer';
import { supplierConfirmationRequestEmail, supplierFollowUpEmail } from '@/lib/email/supplier-confirmation-request';
import { paymentReminderEmail, bookingConfirmedEmail } from '@/lib/email/payment-reminder';
import { ITEM_TYPE_LABELS } from '@/lib/types/booking-items';
import { withTripRef } from '@/lib/trips';
import { format } from 'date-fns';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const body = await req.json();
  const { template, to_email, custom_subject, custom_body, item_id } = body;

  if (!to_email) return NextResponse.json({ error: 'to_email required' }, { status: 400 });

  // Fetch booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, clients(full_name, email), proposals(share_token)')
    .eq('id', bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const { data: agent } = await supabase.from('users').select('full_name').eq('id', user.id).single();

  const travelDates = booking.travel_start
    ? `${format(new Date(booking.travel_start), 'dd MMM yyyy')}${booking.travel_end ? ` – ${format(new Date(booking.travel_end), 'dd MMM yyyy')}` : ''}`
    : '';

  let subject = custom_subject || '';
  let html = custom_body || '';

  // Generate from template
  if (template && !custom_body) {
    switch (template) {
      case 'confirmation_request': {
        // Needs an item
        const { data: item } = item_id
          ? await supabase.from('booking_items').select('*').eq('id', item_id).single()
          : { data: null };

        const email = supplierConfirmationRequestEmail({
          vendorName: body.vendor_name || item?.vendor_name || 'Supplier',
          bookingTitle: booking.title,
          itemLabel: item?.label || booking.title,
          itemType: item ? (ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS] || item.item_type) : 'Package',
          travelDates,
          clientName: booking.clients?.full_name || 'Guest',
          paxCount: booking.pax_adults,
          supplierReference: item?.supplier_reference || undefined,
          agentName: agent?.full_name || 'Agent',
        });
        subject = email.subject;
        html = email.html;
        break;
      }

      case 'follow_up': {
        const { data: item } = item_id
          ? await supabase.from('booking_items').select('*').eq('id', item_id).single()
          : { data: null };

        const email = supplierFollowUpEmail({
          vendorName: body.vendor_name || item?.vendor_name || 'Supplier',
          bookingTitle: booking.title,
          itemLabel: item?.label || booking.title,
          itemType: item ? (ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS] || item.item_type) : 'Package',
          travelDates,
          clientName: booking.clients?.full_name || 'Guest',
          agentName: agent?.full_name || 'Agent',
          followupCount: (item?.followup_count || 0) + 1,
        });
        subject = email.subject;
        html = email.html;
        break;
      }

      case 'payment_reminder': {
        const totalAmount = Number(booking.sell_price) || 0;
        const { data: pkgPayments } = await supabase
          .from('booking_package_payments')
          .select('amount_paid, status')
          .eq('booking_id', bookingId);
        const amountPaid = (pkgPayments || [])
          .filter(p => p.status === 'paid')
          .reduce((s, p) => s + Number(p.amount_paid || 0), 0);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eztrips-saas.vercel.app';
        const shareToken = booking.proposals?.share_token;

        const email = paymentReminderEmail({
          clientName: booking.clients?.full_name || 'Client',
          bookingTitle: booking.title,
          destination: booking.destination || undefined,
          travelDates,
          totalAmount,
          amountPaid,
          amountDue: body.amount_due || (totalAmount - amountPaid),
          dueDate: body.due_date || format(new Date(), 'dd MMM yyyy'),
          currency: booking.currency || 'INR',
          paymentLink: shareToken ? `${appUrl}/p/${shareToken}` : undefined,
          agentName: agent?.full_name || 'Agent',
        });
        subject = email.subject;
        html = email.html;
        break;
      }

      case 'booking_confirmed': {
        const { data: items } = await supabase
          .from('booking_items')
          .select('label, item_type, supplier_status')
          .eq('booking_id', bookingId)
          .in('supplier_status', ['confirmed', 'completed']);

        const email = bookingConfirmedEmail({
          clientName: booking.clients?.full_name || 'Client',
          bookingTitle: booking.title,
          destination: booking.destination || undefined,
          travelDates,
          paxCount: booking.pax_adults,
          confirmedItems: (items || []).map(i =>
            `${i.label} (${ITEM_TYPE_LABELS[i.item_type as keyof typeof ITEM_TYPE_LABELS] || i.item_type})`
          ),
          agentName: agent?.full_name || 'Agent',
        });
        subject = email.subject;
        html = email.html;
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 400 });
    }
  }

  if (!subject || !html) {
    return NextResponse.json({ error: 'Subject and body required' }, { status: 400 });
  }

  subject = withTripRef(subject, booking.trip_id);

  // If preview mode, return without sending
  if (body.preview) {
    return NextResponse.json({ subject, html });
  }

  try {
    await sendEmail(to_email, subject, html);

    // Log email
    await supabase.from('booking_emails').insert({
      booking_id: bookingId,
      to_email,
      subject,
      body: html,
      template_type: template || 'custom',
      direction: 'outbound',
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: user.id,
    });

    await supabase.from('booking_logs').insert({
      booking_id: bookingId,
      user_id: user.id,
      action: 'email_sent',
      details: { to: to_email, subject, template: template || 'custom' },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send', details: String(err) }, { status: 500 });
  }
}
