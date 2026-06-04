import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import {
  hotelVoucherHTML,
  flightVoucherHTML,
  activityVoucherHTML,
  transferVoucherHTML,
  vehicleVoucherHTML,
} from '@/lib/vouchers/templates';
import type { VoucherStatus } from '@/lib/vouchers/templates';
import { htmlToPdf } from '@/lib/vouchers/pdf';
import { sendVoucherEmail } from '@/lib/vouchers/send-email';

export const runtime = 'nodejs';
export const maxDuration = 60;

const logger = createLogger('api:vouchers');

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

// Map supplier_type to voucher_type stored in booking_vouchers
const VOUCHER_TYPE_MAP: Record<string, string> = {
  hotel: 'hotel',
  flight: 'flight',
  vehicle: 'vehicle',
  transfer: 'transfer',
  activity: 'activity',
};

// GET /api/bookings/[id]/vouchers — list vouchers for a booking
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_vouchers')
    .select('*')
    .eq('booking_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('list', 'Failed to fetch vouchers', { bookingId: id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/bookings/[id]/vouchers — generate a voucher PDF and optionally email it
// Body: { supplier_type, content, item_id, send_email?, email_to?, voucher_status?, triggered_by? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { supplier_type, content, item_id, send_email, email_to, voucher_status, triggered_by } = body;

  if (!supplier_type || !content) {
    return NextResponse.json({ error: 'supplier_type and content required' }, { status: 400 });
  }

  const voucherType = VOUCHER_TYPE_MAP[supplier_type];
  if (!voucherType) {
    return NextResponse.json({ error: `supplier_type must be one of: ${Object.keys(VOUCHER_TYPE_MAP).join(', ')}` }, { status: 400 });
  }

  // Voucher display status: confirmed (fully paid) or blocked (partially paid)
  const displayStatus: VoucherStatus = voucher_status === 'blocked' ? 'blocked' : 'confirmed';

  const supabase = createServiceClient();

  // Generate voucher number using DB function
  const { data: voucherNumResult, error: numErr } = await supabase.rpc('generate_voucher_number');
  if (numErr || !voucherNumResult) {
    logger.error('voucher_number', 'Failed to generate voucher number', { error: numErr?.message });
    return NextResponse.json({ error: 'Failed to generate voucher number' }, { status: 500 });
  }
  const voucherNumber: string = voucherNumResult;

  // Fetch booking + client + user/org for branding
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*, clients(full_name, email), suppliers(name)')
    .eq('id', id)
    .single();

  if (bErr || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const { data: agentUser } = await supabase
    .from('users')
    .select('*, organisations(name, logo_url, phone, email)')
    .eq('id', booking.created_by)
    .single();

  const org = agentUser?.organisations as Record<string, string> | null;
  const orgName = org?.name || agentUser?.agency_name || 'EzTrips';
  const orgLogoUrl = org?.logo_url || agentUser?.logo_url || '';
  const logoDataUri = orgLogoUrl ? await urlToBase64DataUri(orgLogoUrl) : '';

  const supplierName = content.hotelName || content.airline || content.activityName || booking.suppliers?.name || '';

  // Generate HTML based on supplier type
  let html: string;
  switch (supplier_type) {
    case 'hotel':
      html = hotelVoucherHTML(content, logoDataUri, orgName, displayStatus);
      break;
    case 'flight':
      html = flightVoucherHTML(content, logoDataUri, orgName, displayStatus);
      break;
    case 'activity':
      html = activityVoucherHTML(content, logoDataUri, orgName, displayStatus);
      break;
    case 'transfer':
      html = transferVoucherHTML(content, logoDataUri, orgName, displayStatus);
      break;
    case 'vehicle':
      html = vehicleVoucherHTML(content, logoDataUri, orgName, displayStatus);
      break;
    default:
      return NextResponse.json({ error: 'Invalid supplier_type' }, { status: 400 });
  }

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await htmlToPdf(html);
  } catch (err) {
    logger.error('pdf', 'Failed to generate PDF', { bookingId: id, error: String(err) });
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  // Upload PDF to Supabase Storage
  const filename = `vouchers/${id}/${supplier_type}_${Date.now()}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from('vouchers')
    .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  let pdfUrl: string | null = null;
  if (!uploadErr) {
    const { data: urlData } = supabase.storage.from('vouchers').getPublicUrl(filename);
    pdfUrl = urlData?.publicUrl || null;
  } else {
    logger.error('upload', 'Failed to upload PDF', { error: uploadErr.message });
  }

  // If no item_id provided, try to find matching item
  let resolvedItemId = item_id;
  if (!resolvedItemId) {
    const { data: matchingItem } = await supabase
      .from('booking_items')
      .select('id')
      .eq('booking_id', id)
      .eq('item_type', supplier_type === 'hotel' ? 'hotel_room' : supplier_type === 'flight' ? 'flight_segment' : supplier_type)
      .limit(1)
      .single();
    resolvedItemId = matchingItem?.id;
  }

  if (!resolvedItemId) {
    return NextResponse.json({ error: 'item_id is required — no matching booking item found' }, { status: 400 });
  }

  // Save voucher record in booking_vouchers
  const { data: voucher, error: vErr } = await supabase
    .from('booking_vouchers')
    .insert({
      booking_id: id,
      item_id: resolvedItemId,
      voucher_number: voucherNumber,
      voucher_type: voucherType,
      status: 'generated',
      triggered_by: triggered_by || 'manual',
      pdf_url: pdfUrl,
      pdf_generated_at: new Date().toISOString(),
      data_snapshot: content,
      created_by: user.id,
    })
    .select()
    .single();

  if (vErr) {
    logger.error('create', 'Failed to save voucher', { error: vErr.message });
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }

  // Create audit entry
  await supabase.from('voucher_audit').insert({
    voucher_id: voucher.id,
    action: 'generated',
    actor_id: user.id,
    details: { supplier_type, supplier_name: supplierName, voucher_number: voucherNumber },
  });

  // Log the action
  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'voucher_generated',
    details: { voucher_id: voucher.id, voucher_number: voucherNumber, supplier_type, supplier_name: supplierName },
  });

  // Send email if requested
  if (send_email) {
    const recipientEmail = email_to || booking.clients?.email;
    if (!recipientEmail) {
      return NextResponse.json({ ...voucher, email_warning: 'No recipient email found' });
    }

    try {
      await sendVoucherEmail({
        to: recipientEmail,
        customerName: content.customerName || booking.clients?.full_name || 'Guest',
        supplierType: supplier_type,
        supplierName,
        pdfBuffer,
        orgName,
      });

      await supabase
        .from('booking_vouchers')
        .update({
          sent_to_email: recipientEmail,
          sent_at: new Date().toISOString(),
          status: 'sent',
        })
        .eq('id', voucher.id);

      // Audit the send
      await supabase.from('voucher_audit').insert({
        voucher_id: voucher.id,
        action: 'sent',
        actor_id: user.id,
        details: { to: recipientEmail },
      });

      await supabase.from('booking_logs').insert({
        booking_id: id,
        user_id: user.id,
        action: 'voucher_emailed',
        details: { voucher_id: voucher.id, voucher_number: voucherNumber, to: recipientEmail },
      });

      voucher.sent_at = new Date().toISOString();
      voucher.sent_to_email = recipientEmail;
      voucher.status = 'sent';
      logger.info('email', 'Voucher emailed', { bookingId: id, to: recipientEmail });
    } catch (err) {
      logger.error('email', 'Failed to send voucher email', { error: String(err) });
      return NextResponse.json({ ...voucher, email_error: 'Failed to send email' });
    }
  }

  return NextResponse.json(voucher, { status: 201 });
}
