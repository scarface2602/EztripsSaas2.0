import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { invoiceHTML } from '@/lib/invoices/template';
import type { InvoiceLineItem } from '@/lib/invoices/template';
import { htmlToPdf } from '@/lib/vouchers/pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

const logger = createLogger('api:invoices');

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

// GET /api/bookings/[id]/invoices — list invoices
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('booking_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('list', 'Failed to fetch invoices', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/bookings/[id]/invoices — generate an invoice
// Body: { invoice_type: 'proforma' | 'final' | 'credit_note', notes?, due_date?, tax_amount?, discount_amount?, custom_line_items? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { invoice_type, notes, due_date, tax_amount, discount_amount, custom_line_items } = body;

  if (!invoice_type || !['proforma', 'final', 'credit_note'].includes(invoice_type)) {
    return NextResponse.json({ error: 'invoice_type must be proforma, final, or credit_note' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Generate invoice number
  const { data: invoiceNumber, error: numErr } = await supabase.rpc('generate_invoice_number');
  if (numErr || !invoiceNumber) {
    logger.error('invoice_number', 'Failed to generate invoice number', { error: numErr?.message });
    return NextResponse.json({ error: 'Failed to generate invoice number' }, { status: 500 });
  }

  // Fetch booking with client
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*, clients(id, full_name, email, phone)')
    .eq('id', id)
    .single();

  if (bErr || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Fetch booking items for line items
  const { data: items } = await supabase
    .from('booking_items')
    .select('label, item_type, sell_price, start_date, end_date, supplier_status, cancellation_charge, refund_amount')
    .eq('booking_id', id)
    .order('sort_order')
    .order('start_date');

  // Build line items from booking items (sell price only, never cost price)
  let lineItems: InvoiceLineItem[];

  if (custom_line_items && Array.isArray(custom_line_items)) {
    lineItems = custom_line_items;
  } else if (invoice_type === 'credit_note') {
    // Credit note: only cancelled items with refund amounts
    lineItems = (items || [])
      .filter(i => i.supplier_status === 'cancelled' && i.refund_amount && Number(i.refund_amount) > 0)
      .map(i => ({
        description: `Refund: ${i.label}${i.start_date ? ` (${i.start_date}${i.end_date ? ' – ' + i.end_date : ''})` : ''}`,
        quantity: 1,
        rate: Number(i.refund_amount),
        amount: Number(i.refund_amount),
      }));

    if (lineItems.length === 0) {
      return NextResponse.json({ error: 'No cancelled items with refund amounts for credit note' }, { status: 400 });
    }
  } else {
    // Proforma/Final: all non-cancelled items
    lineItems = (items || [])
      .filter(i => i.supplier_status !== 'cancelled')
      .map(i => ({
        description: `${i.label}${i.start_date ? ` (${i.start_date}${i.end_date ? ' – ' + i.end_date : ''})` : ''}`,
        quantity: 1,
        rate: Number(i.sell_price || 0),
        amount: Number(i.sell_price || 0),
      }));

    // If no items, use booking sell price as single line
    if (lineItems.length === 0 || lineItems.every(l => l.amount === 0)) {
      lineItems = [{
        description: booking.title || 'Travel Package',
        quantity: 1,
        rate: Number(booking.sell_price || 0),
        amount: Number(booking.sell_price || 0),
      }];
    }
  }

  const subtotal = lineItems.reduce((sum, l) => sum + l.amount, 0);
  const taxAmt = Number(tax_amount || 0);
  const discountAmt = Number(discount_amount || 0);
  const total = subtotal + taxAmt - discountAmt;

  // Customer payments for amount_paid
  const { data: custPayments } = await supabase
    .from('customer_payments')
    .select('amount, payment_type')
    .eq('booking_id', id);

  const amountPaid = (custPayments || []).reduce((sum, p) => {
    return sum + (p.payment_type === 'refund' ? -Number(p.amount) : Number(p.amount));
  }, 0);

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

  // Fetch primary bank account for payment details
  const { data: bankAccount } = await supabase
    .from('payment_accounts')
    .select('account_name, bank_name, account_number, ifsc_code')
    .eq('is_active', true)
    .limit(1)
    .single();

  const client = booking.clients as unknown as Record<string, string> | null;

  const today = new Date().toISOString().split('T')[0];
  const invoiceDate = today;

  // Generate PDF
  const html = invoiceHTML({
    invoiceNumber,
    invoiceType: invoice_type,
    invoiceDate,
    dueDate: due_date || undefined,
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
    travelDates: booking.travel_start && booking.travel_end
      ? `${booking.travel_start} — ${booking.travel_end}` : undefined,
    lineItems,
    subtotal,
    taxAmount: taxAmt,
    discountAmount: discountAmt,
    total,
    amountPaid: invoice_type === 'credit_note' ? 0 : amountPaid,
    balanceDue: invoice_type === 'credit_note' ? total : Math.max(0, total - amountPaid),
    currency: booking.currency || '₹',
    bankDetails: bankAccount ? {
      accountName: bankAccount.account_name,
      bankName: bankAccount.bank_name,
      accountNumber: bankAccount.account_number,
      ifsc: bankAccount.ifsc_code,
    } : undefined,
    notes: notes || undefined,
  });

  let pdfUrl: string | null = null;
  try {
    const pdfBuffer = await htmlToPdf(html);
    const filename = `invoices/${id}/${invoice_type}_${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('vouchers')
      .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from('vouchers').getPublicUrl(filename);
      pdfUrl = urlData?.publicUrl || null;
    }
  } catch (err) {
    logger.error('pdf', 'Failed to generate invoice PDF', { error: String(err) });
    // Non-fatal — invoice record still created
  }

  // Save invoice record
  const { data: invoice, error: iErr } = await supabase
    .from('invoices')
    .insert({
      booking_id: id,
      invoice_number: invoiceNumber,
      invoice_type,
      client_id: client?.id || null,
      line_items: lineItems,
      subtotal,
      tax_amount: taxAmt,
      discount_amount: discountAmt,
      total,
      amount_paid: invoice_type === 'credit_note' ? 0 : amountPaid,
      currency: booking.currency || 'INR',
      status: 'draft',
      due_date: due_date || null,
      notes: notes || null,
      pdf_url: pdfUrl,
      created_by: user.id,
    })
    .select()
    .single();

  if (iErr) {
    logger.error('create', 'Failed to save invoice', { error: iErr.message });
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'invoice_generated',
    details: { invoice_id: invoice.id, invoice_number: invoiceNumber, type: invoice_type, total },
  });

  return NextResponse.json(invoice, { status: 201 });
}
