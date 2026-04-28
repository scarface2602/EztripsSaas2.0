import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
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
    .from('vouchers')
    .select('*')
    .eq('id', voucherId)
    .eq('booking_id', id)
    .single();

  if (!voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });

  // Fetch branding
  const { data: booking } = await supabase
    .from('bookings')
    .select('created_by')
    .eq('id', id)
    .single();

  const { data: agentUser } = await supabase
    .from('users')
    .select('*, organisations(name, logo_url)')
    .eq('id', booking?.created_by)
    .single();

  const org = agentUser?.organisations as Record<string, string> | null;
  const orgName = org?.name || agentUser?.agency_name || 'EzTrips';
  const logoDataUri = (org?.logo_url || agentUser?.logo_url)
    ? await urlToBase64DataUri(org?.logo_url || agentUser?.logo_url || '')
    : '';

  const content = voucher.content as Record<string, string>;
  let html: string;
  switch (voucher.supplier_type) {
    case 'hotel': html = hotelVoucherHTML(content as never, logoDataUri, orgName); break;
    case 'flight': html = flightVoucherHTML(content as never, logoDataUri, orgName); break;
    case 'activity': html = activityVoucherHTML(content as never, logoDataUri, orgName); break;
    case 'transfer': html = transferVoucherHTML(content as never, logoDataUri, orgName); break;
    default: return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const pdfBuffer = await htmlToPdf(html);
  const supplierName = voucher.supplier_name || voucher.supplier_type;
  const filename = `${voucher.supplier_type}_voucher_${supplierName.replace(/\s+/g, '_')}.pdf`;

  return new NextResponse(pdfBuffer, {
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
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { email_to } = body;

  const supabase = createServiceClient();

  const { data: voucher } = await supabase
    .from('vouchers')
    .select('*')
    .eq('id', voucherId)
    .eq('booking_id', id)
    .single();

  if (!voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });

  const { data: booking } = await supabase
    .from('bookings')
    .select('created_by, reference_number, clients(full_name, email)')
    .eq('id', id)
    .single();

  const recipientEmail = email_to || (booking?.clients as Record<string, string>)?.email;
  if (!recipientEmail) {
    return NextResponse.json({ error: 'No recipient email' }, { status: 400 });
  }

  // Fetch branding
  const { data: agentUser } = await supabase
    .from('users')
    .select('*, organisations(name, logo_url)')
    .eq('id', booking?.created_by)
    .single();

  const org = agentUser?.organisations as Record<string, string> | null;
  const orgName = org?.name || agentUser?.agency_name || 'EzTrips';
  const logoDataUri = (org?.logo_url || agentUser?.logo_url)
    ? await urlToBase64DataUri(org?.logo_url || agentUser?.logo_url || '')
    : '';

  const content = voucher.content as Record<string, string>;
  let html: string;
  switch (voucher.supplier_type) {
    case 'hotel': html = hotelVoucherHTML(content as never, logoDataUri, orgName); break;
    case 'flight': html = flightVoucherHTML(content as never, logoDataUri, orgName); break;
    case 'activity': html = activityVoucherHTML(content as never, logoDataUri, orgName); break;
    case 'transfer': html = transferVoucherHTML(content as never, logoDataUri, orgName); break;
    default: return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const pdfBuffer = await htmlToPdf(html);
  const customerName = content.customerName || (booking?.clients as Record<string, string>)?.full_name || 'Guest';

  await sendVoucherEmail({
    to: recipientEmail,
    customerName,
    supplierType: voucher.supplier_type,
    supplierName: voucher.supplier_name || '',
    pdfBuffer,
    orgName,
  });

  await supabase
    .from('vouchers')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', voucherId);

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'voucher_emailed',
    details: { voucher_id: voucherId, to: recipientEmail },
  });

  return NextResponse.json({ success: true, sent_to: recipientEmail });
}
