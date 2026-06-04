import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { packageVoucherHTML } from '@/lib/vouchers/templates';
import type { VoucherStatus, PackageVoucherItem } from '@/lib/vouchers/templates';
import { htmlToPdf } from '@/lib/vouchers/pdf';
import { sendVoucherEmail } from '@/lib/vouchers/send-email';

export const runtime = 'nodejs';
export const maxDuration = 60;

const logger = createLogger('api:vouchers:package');

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

// POST /api/bookings/[id]/vouchers/package — generate combined package voucher
// Body: { send_email?: boolean, email_to?: string, voucher_status?: 'confirmed' | 'blocked' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { send_email, email_to, voucher_status } = body;

  const supabase = createServiceClient();

  // Generate voucher number
  const { data: voucherNumber, error: numErr } = await supabase.rpc('generate_voucher_number');
  if (numErr || !voucherNumber) {
    logger.error('voucher_number', 'Failed to generate voucher number', { error: numErr?.message });
    return NextResponse.json({ error: 'Failed to generate voucher number' }, { status: 500 });
  }

  // Fetch booking with client
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*, clients(full_name, email)')
    .eq('id', id)
    .single();

  if (bErr || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Fetch all confirmed/completed items
  const { data: items, error: iErr } = await supabase
    .from('booking_items')
    .select('*')
    .eq('booking_id', id)
    .in('supplier_status', ['confirmed', 'completed'])
    .order('sort_order', { ascending: true })
    .order('start_date', { ascending: true });

  if (iErr) {
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'No confirmed items to include in package voucher' }, { status: 400 });
  }

  // Branding
  const { data: agentUser } = await supabase
    .from('users')
    .select('*, organisations(name, logo_url, phone, email)')
    .eq('id', booking.created_by)
    .single();

  const org = agentUser?.organisations as Record<string, string> | null;
  const orgName = org?.name || agentUser?.agency_name || 'EzTrips';
  const orgLogoUrl = org?.logo_url || agentUser?.logo_url || '';
  const logoDataUri = orgLogoUrl ? await urlToBase64DataUri(orgLogoUrl) : '';

  const client = booking.clients as unknown as Record<string, string> | null;
  const displayStatus: VoucherStatus = voucher_status === 'blocked' ? 'blocked' : 'confirmed';

  // Build package voucher data
  const packageItems: PackageVoucherItem[] = items.map((i) => ({
    itemType: i.item_type,
    label: i.label,
    startDate: i.start_date || '',
    endDate: i.end_date || '',
    supplierReference: i.supplier_reference || '',
    supplierStatus: i.supplier_status,
    details: i.details || {},
  }));

  const html = packageVoucherHTML({
    voucherNumber,
    customerName: client?.full_name || 'Guest',
    destination: booking.destination || '',
    travelStart: booking.travel_start || '',
    travelEnd: booking.travel_end || '',
    paxAdults: booking.pax_adults || 1,
    paxChildren: booking.pax_children || 0,
    items: packageItems,
    emergencyContact: org ? { name: orgName, phone: org.phone, email: org.email } : undefined,
  }, logoDataUri, orgName, displayStatus);

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await htmlToPdf(html);
  } catch (err) {
    logger.error('pdf', 'Failed to generate package PDF', { bookingId: id, error: String(err) });
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  // Upload PDF
  const filename = `vouchers/${id}/package_${Date.now()}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from('vouchers')
    .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  let pdfUrl: string | null = null;
  if (!uploadErr) {
    const { data: urlData } = supabase.storage.from('vouchers').getPublicUrl(filename);
    pdfUrl = urlData?.publicUrl || null;
  }

  // We need an item_id for the FK — use the first item as the anchor
  const anchorItemId = items[0].id;

  // Save voucher record
  const { data: voucher, error: vErr } = await supabase
    .from('booking_vouchers')
    .insert({
      booking_id: id,
      item_id: anchorItemId,
      voucher_number: voucherNumber,
      voucher_type: 'package',
      status: 'generated',
      triggered_by: 'manual',
      pdf_url: pdfUrl,
      pdf_generated_at: new Date().toISOString(),
      data_snapshot: {
        items: packageItems,
        booking: { title: booking.title, destination: booking.destination, travel_start: booking.travel_start, travel_end: booking.travel_end },
      },
      created_by: user.id,
    })
    .select()
    .single();

  if (vErr) {
    logger.error('create', 'Failed to save package voucher', { error: vErr.message });
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }

  // Audit + log
  await supabase.from('voucher_audit').insert({
    voucher_id: voucher.id,
    action: 'generated',
    actor_id: user.id,
    details: { type: 'package', item_count: items.length, voucher_number: voucherNumber },
  });

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'voucher_generated',
    details: { voucher_id: voucher.id, voucher_number: voucherNumber, type: 'package', item_count: items.length },
  });

  // Send email if requested
  if (send_email) {
    const recipientEmail = email_to || client?.email;
    if (!recipientEmail) {
      return NextResponse.json({ ...voucher, email_warning: 'No recipient email found' });
    }

    try {
      await sendVoucherEmail({
        to: recipientEmail,
        customerName: client?.full_name || 'Guest',
        supplierType: 'package',
        supplierName: booking.title || booking.destination || 'Trip',
        pdfBuffer,
        orgName,
      });

      await supabase
        .from('booking_vouchers')
        .update({ sent_to_email: recipientEmail, sent_at: new Date().toISOString(), status: 'sent' })
        .eq('id', voucher.id);

      await supabase.from('voucher_audit').insert({
        voucher_id: voucher.id, action: 'sent', actor_id: user.id, details: { to: recipientEmail },
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
    } catch (err) {
      logger.error('email', 'Failed to send package voucher email', { error: String(err) });
      return NextResponse.json({ ...voucher, email_error: 'Failed to send email' });
    }
  }

  return NextResponse.json(voucher, { status: 201 });
}
