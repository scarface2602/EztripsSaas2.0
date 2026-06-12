import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api/with-auth';
import type { Permission } from '@/lib/auth/permissions';
import {
  hotelVoucherHTML,
  flightVoucherHTML,
  activityVoucherHTML,
  transferVoucherHTML,
  vehicleVoucherHTML,
  packageVoucherHTML,
} from '@/lib/vouchers/templates';
import type { VoucherStatus, PackageVoucherItem } from '@/lib/vouchers/templates';
import { htmlToPdf } from '@/lib/vouchers/pdf';
import { sendVoucherEmail } from '@/lib/vouchers/send-email';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function getUser(permission?: Permission) {
  return getAuthUser(permission);
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

async function getBranding(supabase: ReturnType<typeof createServiceClient>, createdBy: string) {
  const { data: agentUser } = await supabase
    .from('users')
    .select('*, organisations(name, logo_url, phone, email)')
    .eq('id', createdBy)
    .single();

  const org = agentUser?.organisations as Record<string, string> | null;
  const orgName = org?.name || agentUser?.agency_name || 'EzTrips';
  const logoDataUri = (org?.logo_url || agentUser?.logo_url)
    ? await urlToBase64DataUri(org?.logo_url || agentUser?.logo_url || '')
    : '';

  return { orgName, logoDataUri, org };
}

function renderVoucherHTML(
  voucherType: string,
  content: Record<string, unknown>,
  logoDataUri: string,
  orgName: string,
  status: VoucherStatus = 'confirmed',
): string | null {
  switch (voucherType) {
    case 'hotel': return hotelVoucherHTML(content as never, logoDataUri, orgName, status);
    case 'flight': return flightVoucherHTML(content as never, logoDataUri, orgName, status);
    case 'activity': return activityVoucherHTML(content as never, logoDataUri, orgName, status);
    case 'transfer': return transferVoucherHTML(content as never, logoDataUri, orgName, status);
    case 'vehicle': return vehicleVoucherHTML(content as never, logoDataUri, orgName, status);
    default: return null;
  }
}

// GET /api/bookings/[id]/vouchers/[voucherId] — download voucher PDF
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; voucherId: string }> },
) {
  const { id, voucherId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  const { data: voucher } = await supabase
    .from('booking_vouchers')
    .select('*')
    .eq('id', voucherId)
    .eq('booking_id', id)
    .single();

  if (!voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });

  const { data: booking } = await supabase
    .from('bookings')
    .select('created_by, title, destination, travel_start, travel_end, pax_adults, pax_children, clients(full_name, email)')
    .eq('id', id)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const { orgName, logoDataUri } = await getBranding(supabase, booking.created_by);

  const content = voucher.data_snapshot as Record<string, unknown>;
  const status: VoucherStatus = 'confirmed';
  let html: string | null;

  if (voucher.voucher_type === 'package') {
    // Rebuild package voucher from all confirmed items
    const { data: items } = await supabase
      .from('booking_items')
      .select('*')
      .eq('booking_id', id)
      .in('supplier_status', ['confirmed', 'completed'])
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: true });

    const client = booking.clients as unknown as Record<string, string> | null;
    const packageItems: PackageVoucherItem[] = (items || []).map((i: Record<string, unknown>) => ({
      itemType: i.item_type as string,
      label: i.label as string,
      startDate: i.start_date as string,
      endDate: i.end_date as string,
      supplierReference: i.supplier_reference as string,
      supplierStatus: i.supplier_status as string,
      details: (i.details as Record<string, unknown>) || {},
    }));

    html = packageVoucherHTML({
      voucherNumber: voucher.voucher_number,
      customerName: client?.full_name || 'Guest',
      destination: booking.destination || '',
      travelStart: booking.travel_start || '',
      travelEnd: booking.travel_end || '',
      paxAdults: booking.pax_adults || 1,
      paxChildren: booking.pax_children || 0,
      items: packageItems,
    }, logoDataUri, orgName, status);
  } else {
    html = renderVoucherHTML(voucher.voucher_type, content, logoDataUri, orgName, status);
  }

  if (!html) return NextResponse.json({ error: 'Invalid voucher type' }, { status: 400 });

  const pdfBuffer = await htmlToPdf(html);

  // Track download
  await supabase
    .from('booking_vouchers')
    .update({
      download_count: (voucher.download_count || 0) + 1,
      last_downloaded_at: new Date().toISOString(),
      status: voucher.status === 'generated' ? 'downloaded' : voucher.status,
    })
    .eq('id', voucherId);

  await supabase.from('voucher_audit').insert({
    voucher_id: voucherId,
    action: 'downloaded',
    actor_id: user.id,
  });

  const filename = `${voucher.voucher_number.replace(/\s+/g, '_')}_${voucher.voucher_type}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// POST /api/bookings/[id]/vouchers/[voucherId] — resend voucher email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; voucherId: string }> },
) {
  const { id, voucherId } = await params;
  const user = await getUser('ops.actions');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { email_to } = body;

  const supabase = createServiceClient();

  const { data: voucher } = await supabase
    .from('booking_vouchers')
    .select('*')
    .eq('id', voucherId)
    .eq('booking_id', id)
    .single();

  if (!voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });

  const { data: booking } = await supabase
    .from('bookings')
    .select('created_by, title, destination, travel_start, travel_end, pax_adults, pax_children, clients(full_name, email)')
    .eq('id', id)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const client = booking.clients as unknown as Record<string, string> | null;
  const recipientEmail = email_to || client?.email;
  if (!recipientEmail) {
    return NextResponse.json({ error: 'No recipient email' }, { status: 400 });
  }

  const { orgName, logoDataUri } = await getBranding(supabase, booking.created_by);
  const content = voucher.data_snapshot as Record<string, unknown>;
  const status: VoucherStatus = 'confirmed';
  let html: string | null;

  if (voucher.voucher_type === 'package') {
    const { data: items } = await supabase
      .from('booking_items')
      .select('*')
      .eq('booking_id', id)
      .in('supplier_status', ['confirmed', 'completed'])
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: true });

    const packageItems: PackageVoucherItem[] = (items || []).map((i: Record<string, unknown>) => ({
      itemType: i.item_type as string,
      label: i.label as string,
      startDate: i.start_date as string,
      endDate: i.end_date as string,
      supplierReference: i.supplier_reference as string,
      supplierStatus: i.supplier_status as string,
      details: (i.details as Record<string, unknown>) || {},
    }));

    html = packageVoucherHTML({
      voucherNumber: voucher.voucher_number,
      customerName: client?.full_name || 'Guest',
      destination: booking.destination || '',
      travelStart: booking.travel_start || '',
      travelEnd: booking.travel_end || '',
      paxAdults: booking.pax_adults || 1,
      paxChildren: booking.pax_children || 0,
      items: packageItems,
    }, logoDataUri, orgName, status);
  } else {
    html = renderVoucherHTML(voucher.voucher_type, content, logoDataUri, orgName, status);
  }

  if (!html) return NextResponse.json({ error: 'Invalid voucher type' }, { status: 400 });

  const pdfBuffer = await htmlToPdf(html);
  const customerName = (content?.customerName as string) || client?.full_name || 'Guest';

  await sendVoucherEmail({
    to: recipientEmail,
    customerName,
    supplierType: voucher.voucher_type,
    supplierName: (content?.hotelName as string) || (content?.airline as string) || voucher.voucher_type,
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
    .eq('id', voucherId);

  await supabase.from('voucher_audit').insert({
    voucher_id: voucherId,
    action: 'sent',
    actor_id: user.id,
    details: { to: recipientEmail },
  });

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'voucher_emailed',
    details: { voucher_id: voucherId, voucher_number: voucher.voucher_number, to: recipientEmail },
  });

  return NextResponse.json({ success: true, sent_to: recipientEmail });
}
