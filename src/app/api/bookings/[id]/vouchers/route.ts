import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import {
  hotelVoucherHTML,
  flightVoucherHTML,
  activityVoucherHTML,
  transferVoucherHTML,
} from '@/lib/vouchers/templates';
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

// GET /api/bookings/[id]/vouchers — list vouchers for a booking
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('vouchers')
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
// Body: { supplier_type, content, send_email?: boolean, email_to?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { supplier_type, content, send_email, email_to } = body;

  if (!supplier_type || !content) {
    return NextResponse.json({ error: 'supplier_type and content required' }, { status: 400 });
  }

  const validTypes = ['hotel', 'flight', 'activity', 'transfer'];
  if (!validTypes.includes(supplier_type)) {
    return NextResponse.json({ error: `supplier_type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
  }

  const supabase = createServiceClient();

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
      html = hotelVoucherHTML(content, logoDataUri, orgName);
      break;
    case 'flight':
      html = flightVoucherHTML(content, logoDataUri, orgName);
      break;
    case 'activity':
      html = activityVoucherHTML(content, logoDataUri, orgName);
      break;
    case 'transfer':
      html = transferVoucherHTML(content, logoDataUri, orgName);
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

  // Save voucher record
  const { data: voucher, error: vErr } = await supabase
    .from('vouchers')
    .insert({
      booking_id: id,
      supplier_type,
      supplier_name: supplierName,
      booking_reference: content.confirmationNumber || booking.reference_number || null,
      content,
      pdf_url: pdfUrl,
    })
    .select()
    .single();

  if (vErr) {
    logger.error('create', 'Failed to save voucher', { error: vErr.message });
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }

  // Log the action
  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'voucher_generated',
    details: { voucher_id: voucher.id, supplier_type, supplier_name: supplierName },
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
        .from('vouchers')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', voucher.id);

      await supabase.from('booking_logs').insert({
        booking_id: id,
        user_id: user.id,
        action: 'voucher_emailed',
        details: { voucher_id: voucher.id, to: recipientEmail },
      });

      voucher.email_sent_at = new Date().toISOString();
      logger.info('email', 'Voucher emailed', { bookingId: id, to: recipientEmail });
    } catch (err) {
      logger.error('email', 'Failed to send voucher email', { error: String(err) });
      return NextResponse.json({ ...voucher, email_error: 'Failed to send email' });
    }
  }

  return NextResponse.json(voucher, { status: 201 });
}
