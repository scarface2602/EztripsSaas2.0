import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/mailer';
import { paymentReminderEmail, bookingConfirmedEmail } from '@/lib/email/payment-reminder';
import { supplierFollowUpEmail } from '@/lib/email/supplier-confirmation-request';
import { ITEM_TYPE_LABELS } from '@/lib/types/booking-items';
import { format } from 'date-fns';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Verify cron secret to prevent unauthorized access
function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return false;
  return true;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Fetch pending reminders that are due
  const { data: reminders } = await supabase
    .from('scheduled_reminders')
    .select('*')
    .eq('status', 'pending')
    .lte('send_at', now)
    .order('send_at')
    .limit(50);

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {
    try {
      // Fetch booking details
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, title, destination, travel_start, travel_end, pax_adults, created_by, trip_id, proposal_id, clients(full_name, email), users!bookings_created_by_fkey(full_name, agency_name, email)')
        .eq('id', reminder.booking_id)
        .single();

      if (!booking) {
        await supabase.from('scheduled_reminders').update({ status: 'failed' }).eq('id', reminder.id);
        failed++;
        continue;
      }

      const client = booking.clients as any;
      const agent = (booking as any).users as any;
      const travelDates = booking.travel_start
        ? `${format(new Date(booking.travel_start), 'dd MMM yyyy')}${booking.travel_end ? ` – ${format(new Date(booking.travel_end), 'dd MMM yyyy')}` : ''}`
        : '';

      let emailData: { to: string; subject: string; html: string } | null = null;

      switch (reminder.reminder_type) {
        case 'payment_due': {
          if (!client?.email) break;
          // Get payment details
          const { data: payments } = await supabase
            .from('booking_payments')
            .select('amount, status')
            .eq('booking_id', reminder.booking_id);

          const totalAmount = (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
          const amountPaid = (payments || []).filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0);
          const amountDue = totalAmount - amountPaid;

          if (amountDue <= 0) break; // Already paid

          const email = paymentReminderEmail({
            clientName: client.full_name || 'Guest',
            bookingTitle: booking.title || 'Booking',
            destination: booking.destination || undefined,
            travelDates,
            totalAmount,
            amountPaid,
            amountDue,
            dueDate: reminder.send_at ? format(new Date(reminder.send_at), 'dd MMM yyyy') : 'soon',
            currency: 'INR',
            agentName: agent?.full_name || 'Agent',
            agencyName: agent?.agency_name || undefined,
          });
          emailData = { to: client.email, ...email };
          break;
        }

        case 'supplier_followup': {
          if (!reminder.booking_item_id) break;
          const { data: item } = await supabase
            .from('booking_items')
            .select('*, bookings!inner(title)')
            .eq('id', reminder.booking_item_id)
            .single();

          if (!item || item.supplier_status !== 'confirmation_requested') break;
          if (!item.vendor_email) break;

          const email = supplierFollowUpEmail({
            vendorName: item.vendor_name || 'Supplier',
            bookingTitle: (item.bookings as any)?.title || '',
            itemLabel: item.label,
            itemType: ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS] || item.item_type,
            travelDates,
            clientName: client?.full_name || 'Guest',
            agentName: agent?.full_name || 'Agent',
            followupCount: (item.followup_count || 0) + 1,
          });
          emailData = { to: item.vendor_email, ...email };

          // Update followup count on item
          await supabase.from('booking_items').update({
            followup_count: (item.followup_count || 0) + 1,
            last_followup_at: now,
          }).eq('id', item.id);
          break;
        }

        case 'booking_confirmed': {
          if (!client?.email) break;
          const { data: confirmedItems } = await supabase
            .from('booking_items')
            .select('label, item_type')
            .eq('booking_id', reminder.booking_id)
            .eq('supplier_status', 'confirmed');

          const email = bookingConfirmedEmail({
            clientName: client.full_name || 'Guest',
            bookingTitle: booking.title || 'Booking',
            destination: booking.destination || undefined,
            travelDates,
            paxCount: booking.pax_adults || undefined,
            confirmedItems: (confirmedItems || []).map((i: any) => i.label),
            agentName: agent?.full_name || 'Agent',
            agencyName: agent?.agency_name || undefined,
          });
          emailData = { to: client.email, ...email };
          break;
        }

        case 'flight_ticketing': {
          // Urgent nudge to the agent: flight fares are only estimates until
          // ticketed — book/hold before the price-lock window closes.
          if (!agent?.email) break;
          const { data: flightItems } = await supabase
            .from('booking_items')
            .select('label, supplier_status')
            .eq('booking_id', reminder.booking_id)
            .eq('item_type', 'flight_segment')
            .neq('supplier_status', 'confirmed');

          if (!flightItems || flightItems.length === 0) break; // already ticketed

          const list = flightItems.map((i: any) => `<li>${i.label}</li>`).join('');
          emailData = {
            to: agent.email,
            subject: `✈ Ticket flights now — ${booking.title || 'booking'} (${(booking as any).trip_id || ''})`,
            html: `
              <p>The client has accepted and paid/committed on <strong>${booking.title || 'this booking'}</strong> (${travelDates}).</p>
              <p>The following flight segments are not yet confirmed. Fares are estimates until ticketed — book or hold them before the price-lock window closes:</p>
              <ul>${list}</ul>
              <p>If the fare has moved, send a fare-difference link from the booking page instead of absorbing or surprise-charging the delta.</p>`,
          };
          break;
        }
      }

      if (emailData) {
        await sendEmail(emailData.to, emailData.subject, emailData.html);
        await supabase.from('scheduled_reminders').update({ status: 'sent', sent_at: now }).eq('id', reminder.id);

        // Log activity
        await supabase.from('booking_logs').insert({
          booking_id: reminder.booking_id,
          action: 'auto_reminder_sent',
          details: { reminder_type: reminder.reminder_type, sent_to: emailData.to },
        });

        // Log email
        await supabase.from('booking_emails').insert({
          booking_id: reminder.booking_id,
          direction: 'outbound',
          to_email: emailData.to,
          subject: emailData.subject,
          body: emailData.html,
          template_type: reminder.reminder_type,
          status: 'sent',
          sent_at: now,
        });

        sent++;
      } else {
        // No email to send — mark as sent (condition not met)
        await supabase.from('scheduled_reminders').update({ status: 'sent', sent_at: now }).eq('id', reminder.id);
        sent++;
      }
    } catch {
      await supabase.from('scheduled_reminders').update({ status: 'failed' }).eq('id', reminder.id);
      failed++;
    }
  }

  return NextResponse.json({ processed: reminders.length, sent, failed });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
