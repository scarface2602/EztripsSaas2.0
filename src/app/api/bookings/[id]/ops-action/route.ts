import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { validateStatusTransition } from '@/lib/api/validate-status-transition';
import { deriveBookingStatus } from '@/lib/api/booking-status';
import { sendEmail, sendEmailWithAttachments } from '@/lib/email/mailer';
import { supplierConfirmationRequestEmail, supplierFollowUpEmail } from '@/lib/email/supplier-confirmation-request';
import type { SupplierStatus } from '@/lib/types/booking-items';
import { ITEM_TYPE_LABELS } from '@/lib/types/booking-items';
import { withTripRef } from '@/lib/trips';
import { format } from 'date-fns';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  // Support both JSON and FormData (for file attachments)
  const contentType = req.headers.get('content-type') || '';
  let action: string;
  let item_id: string;
  let extra: Record<string, unknown> = {};
  let customHtmlBody: string | null = null;
  let customCc: string | null = null;
  let customTo: string | null = null;
  let attachSystemVoucher = false;
  let uploadedFiles: Array<{ filename: string; content: Buffer; contentType: string }> = [];

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    action = formData.get('action') as string;
    item_id = formData.get('item_id') as string;
    customHtmlBody = formData.get('html_body') as string | null;
    customCc = formData.get('cc') as string | null;
    customTo = formData.get('to') as string | null;
    attachSystemVoucher = formData.get('attach_system_voucher') === 'true';

    // Parse extra fields
    for (const key of ['vendor_name', 'vendor_email', 'supplier_reference', 'supplier_notes', 'payment_due_date']) {
      const val = formData.get(key);
      if (val) extra[key] = val;
    }

    // Collect uploaded files
    const files = formData.getAll('attachments') as File[];
    uploadedFiles = await Promise.all(
      files.filter(f => f instanceof File && f.size > 0).map(async (f) => ({
        filename: f.name,
        content: Buffer.from(await f.arrayBuffer()),
        contentType: f.type || 'application/octet-stream',
      }))
    );
  } else {
    const body = await req.json();
    action = body.action;
    item_id = body.item_id;
    customHtmlBody = body.html_body || null;
    customCc = body.cc || null;
    customTo = body.to || null;
    attachSystemVoucher = body.attach_system_voucher === true;
    // Extract extra fields (exclude known keys)
    const knownKeys = ['action', 'item_id', 'html_body', 'cc', 'to', 'attach_system_voucher'];
    extra = Object.fromEntries(Object.entries(body).filter(([k]) => !knownKeys.includes(k)));
  }

  if (!item_id || !action) {
    return NextResponse.json({ error: 'action and item_id required' }, { status: 400 });
  }

  // Fetch item + booking info
  const { data: item } = await supabase
    .from('booking_items')
    .select('*, bookings!inner(id, title, destination, travel_start, travel_end, pax_adults, trip_id, clients(full_name, email))')
    .eq('id', item_id)
    .single();

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  // Fetch agent info
  const { data: agent } = await supabase.from('users').select('full_name, email').eq('id', user.id).single();

  const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
  const client = booking?.clients;
  const travelDates = booking?.travel_start
    ? `${format(new Date(booking.travel_start), 'dd MMM yyyy')}${booking.travel_end ? ` – ${format(new Date(booking.travel_end), 'dd MMM yyyy')}` : ''}`
    : '';

  const updates: Record<string, unknown> = {};
  let logAction = 'item_updated';
  const logDetails: Record<string, unknown> = { item_id, label: item.label };
  let emailToSend: { to: string; subject: string; html: string } | null = null;

  switch (action) {
    case 'request_confirmation': {
      const vendorEmail = extra.vendor_email || item.vendor_email;
      const vendorName = extra.vendor_name || item.vendor_name || 'Supplier';

      // Validate transition
      const transition = validateStatusTransition(item.supplier_status as SupplierStatus, 'confirmation_requested');
      if (!transition.valid) return NextResponse.json({ error: transition.error }, { status: 400 });

      updates.supplier_status = 'confirmation_requested';
      if (extra.vendor_name) updates.vendor_name = extra.vendor_name;
      if (extra.vendor_email) updates.vendor_email = extra.vendor_email;
      logAction = 'confirmation_requested';
      logDetails.vendor_email = vendorEmail;

      if (vendorEmail) {
        const email = supplierConfirmationRequestEmail({
          vendorName,
          bookingTitle: booking?.title || '',
          itemLabel: item.label,
          itemType: ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS] || item.item_type,
          travelDates,
          clientName: client?.full_name || 'Guest',
          paxCount: booking?.pax_adults,
          supplierReference: item.supplier_reference || undefined,
          agentName: agent?.full_name || 'Agent',
        });
        emailToSend = { to: vendorEmail, ...email };
      }
      break;
    }

    case 'mark_confirmed': {
      const transition = validateStatusTransition(item.supplier_status as SupplierStatus, 'confirmed');
      if (!transition.valid) return NextResponse.json({ error: transition.error }, { status: 400 });

      updates.supplier_status = 'confirmed';
      updates.supplier_confirmed_at = new Date().toISOString();
      if (extra.supplier_reference) updates.supplier_reference = extra.supplier_reference;
      if (extra.supplier_notes) updates.supplier_notes = extra.supplier_notes;
      logAction = 'item_confirmed';
      logDetails.supplier_reference = extra.supplier_reference;
      break;
    }

    case 'mark_on_hold': {
      const transition = validateStatusTransition(item.supplier_status as SupplierStatus, 'on_hold');
      if (!transition.valid) return NextResponse.json({ error: transition.error }, { status: 400 });

      updates.supplier_status = 'on_hold';
      if (extra.supplier_reference) updates.supplier_reference = extra.supplier_reference;
      if (extra.supplier_notes) updates.supplier_notes = extra.supplier_notes;
      if (extra.payment_due_date) updates.payment_due_date = extra.payment_due_date;
      logAction = 'item_on_hold';
      break;
    }

    case 'follow_up': {
      const followupCount = (item.followup_count || 0) + 1;
      updates.followup_count = followupCount;
      updates.last_followup_at = new Date().toISOString();
      logAction = 'follow_up_sent';
      logDetails.followup_count = followupCount;

      const vendorEmail = item.vendor_email;
      const vendorName = item.vendor_name || 'Supplier';
      if (vendorEmail) {
        const email = supplierFollowUpEmail({
          vendorName,
          bookingTitle: booking?.title || '',
          itemLabel: item.label,
          itemType: ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS] || item.item_type,
          travelDates,
          clientName: client?.full_name || 'Guest',
          agentName: agent?.full_name || 'Agent',
          followupCount,
        });
        emailToSend = { to: vendorEmail, ...email };
      }
      break;
    }

    case 'escalate': {
      updates.escalated = true;
      logAction = 'item_escalated';
      if (extra.supplier_notes) updates.supplier_notes = extra.supplier_notes;
      break;
    }

    case 'check_in': {
      if (item.checked_in_at) return NextResponse.json({ error: 'Already checked in' }, { status: 400 });
      updates.checked_in_at = new Date().toISOString();
      logAction = 'guest_checked_in';
      logDetails.item_type = item.item_type;
      break;
    }

    case 'check_out': {
      if (!item.checked_in_at) return NextResponse.json({ error: 'Not checked in yet' }, { status: 400 });
      if (item.checked_out_at) return NextResponse.json({ error: 'Already checked out' }, { status: 400 });
      updates.checked_out_at = new Date().toISOString();
      logAction = 'guest_checked_out';
      logDetails.item_type = item.item_type;
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  // Apply updates
  const { error: updateError } = await supabase
    .from('booking_items')
    .update(updates)
    .eq('id', item_id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Log activity
  await supabase.from('booking_logs').insert({
    booking_id: bookingId,
    user_id: user.id,
    action: logAction,
    details: logDetails,
  });

  // Auto-derive booking status
  if (updates.supplier_status) {
    const { data: allItems } = await supabase
      .from('booking_items')
      .select('supplier_status')
      .eq('booking_id', bookingId);

    if (allItems?.length) {
      const newStatus = deriveBookingStatus(allItems.map(i => i.supplier_status as SupplierStatus));
      await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId);
    }
  }

  // Auto-create scheduled reminders
  if (action === 'request_confirmation') {
    // Schedule a supplier follow-up reminder in 48 hours
    const followUpAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await supabase.from('scheduled_reminders').insert({
      booking_id: bookingId,
      booking_item_id: item_id,
      reminder_type: 'supplier_followup',
      send_at: followUpAt,
    });
  }

  if (action === 'mark_confirmed') {
    // Check if all items are now confirmed → schedule booking_confirmed notification
    const { data: allItems } = await supabase
      .from('booking_items')
      .select('supplier_status')
      .eq('booking_id', bookingId);

    const allConfirmed = allItems?.every(i => i.supplier_status === 'confirmed');
    if (allConfirmed) {
      // Cancel any pending supplier follow-up reminders for this booking
      await supabase.from('scheduled_reminders')
        .update({ status: 'cancelled' })
        .eq('booking_id', bookingId)
        .eq('reminder_type', 'supplier_followup')
        .eq('status', 'pending');

      // Schedule booking confirmed notification
      await supabase.from('scheduled_reminders').insert({
        booking_id: bookingId,
        reminder_type: 'booking_confirmed',
        send_at: new Date().toISOString(),
      });
    } else {
      // Cancel the specific follow-up reminder for this item since it's now confirmed
      if (item_id) {
        await supabase.from('scheduled_reminders')
          .update({ status: 'cancelled' })
          .eq('booking_item_id', item_id)
          .eq('reminder_type', 'supplier_followup')
          .eq('status', 'pending');
      }
    }
  }

  // Send email (non-blocking — don't fail the action if email fails)
  let emailSent = false;
  const finalTo = customTo || emailToSend?.to;
  const finalSubject = withTripRef(
    emailToSend?.subject || `${action.replace(/_/g, ' ')} — ${item.label}`,
    booking?.trip_id,
  );
  const finalHtml = customHtmlBody || emailToSend?.html;

  if (finalTo && finalHtml) {
    try {
      // Build attachment list
      const mailAttachments = [...uploadedFiles];

      // Generate system voucher PDF if requested
      if (attachSystemVoucher) {
        try {
          const { htmlToPdf } = await import('@/lib/vouchers/pdf');
          const { hotelVoucherHTML, flightVoucherHTML, activityVoucherHTML, transferVoucherHTML, vehicleVoucherHTML } = await import('@/lib/vouchers/templates');

          const itemType = item.item_type || '';
          const logoDataUri = '';
          const orgName = agent?.full_name || 'EzTrips';
          let voucherHtml = '';
          const customerName = client?.full_name || 'Guest';
          const confirmationNumber = item.supplier_reference || undefined;

          if (itemType === 'hotel_room' || itemType === 'hotel') {
            voucherHtml = hotelVoucherHTML({
              customerName, hotelName: item.label || '', checkInDate: item.start_date || '', checkOutDate: item.end_date || '', confirmationNumber,
            }, logoDataUri, orgName);
          } else if (itemType === 'flight_segment' || itemType === 'flight') {
            voucherHtml = flightVoucherHTML({
              customerName, airline: '', flightNumber: '', departureTime: item.start_date || '', arrivalTime: item.end_date || '', route: item.label || '', confirmationNumber,
            }, logoDataUri, orgName);
          } else if (itemType === 'activity') {
            voucherHtml = activityVoucherHTML({
              customerName, activityName: item.label || '', activityDate: item.start_date || '', confirmationNumber,
            }, logoDataUri, orgName);
          } else if (itemType === 'transfer') {
            voucherHtml = transferVoucherHTML({
              customerName, pickupTime: item.start_date || '', pickupLocation: '', dropoffLocation: '', confirmationNumber,
            }, logoDataUri, orgName);
          } else if (itemType === 'vehicle') {
            voucherHtml = vehicleVoucherHTML({
              customerName, vehicleType: '', pickupLocation: '', dropoffLocation: '', pickupDatetime: item.start_date || '', dropoffDatetime: item.end_date || '', confirmationNumber,
            }, logoDataUri, orgName);
          }

          if (voucherHtml) {
            const pdfBuffer = await htmlToPdf(voucherHtml);
            mailAttachments.push({
              filename: `voucher-${item.label?.replace(/\s+/g, '-') || 'item'}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            });
          }
        } catch {
          // Voucher generation failed — continue without it
        }
      }

      if (mailAttachments.length > 0 || customCc) {
        await sendEmailWithAttachments({
          to: finalTo,
          cc: customCc || undefined,
          subject: finalSubject,
          html: finalHtml,
          attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
        });
      } else {
        await sendEmail(finalTo, finalSubject, finalHtml);
      }
      emailSent = true;

      // Log email to booking_emails (append-only)
      const { error: emailLogError } = await supabase.from('booking_emails').insert({
        booking_id: bookingId,
        direction: 'outbound',
        to_email: finalTo,
        subject: finalSubject,
        body: finalHtml,
        template_type: logAction,
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: user.id,
      });
      if (emailLogError) console.error('booking_emails log failed:', emailLogError);
    } catch {
      // Email failed but action succeeded
    }
  }

  return NextResponse.json({ success: true, emailSent });
}
