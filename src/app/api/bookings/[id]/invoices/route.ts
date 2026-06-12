import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api/with-auth';
import type { Permission } from '@/lib/auth/permissions';
import { createLogger } from '@/lib/logger';
import { invoiceHTML } from '@/lib/invoices/template';
import type { InvoiceLineItem } from '@/lib/invoices/template';
import { htmlToPdf } from '@/lib/vouchers/pdf';
import {
  computeLineTax, splitTax, computeTcs, resolveTaxConfig,
  TAX_CLASS_BY_ITEM_TYPE, SAC_BY_CLASS, type TaxClass,
} from '@/lib/tax/engine';
import { GST_STATE_CODES } from '@/lib/utils/gstin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const logger = createLogger('api:invoices');

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
// Body: { invoice_type: 'proforma' | 'final' | 'credit_note', notes?, due_date?,
//         tax_amount?,              // manual override — wins over the engine
//         tax_overrides?: { tax_class?, rate? },  // inline tweaks, engine still runs
//         overseas_package?,        // triggers TCS
//         reference_invoice_id?,    // credit notes must reference the original
//         discount_amount?, custom_line_items? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser('accounts.manage');
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

  // Fetch booking with client and bill-to (the payer drives the GST identity)
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select(`*, clients(id, full_name, email, phone),
      bill_to:clients!bookings_bill_to_client_id_fkey(id, full_name, email, phone, client_kind, gstin, gst_legal_name, gst_state_code, billing_address)`)
    .eq('id', id)
    .single();

  if (bErr || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Fetch booking items for line items (cost_price used server-side only,
  // for margin-method GST — never printed)
  const { data: items } = await supabase
    .from('booking_items')
    .select('label, item_type, sell_price, cost_price, start_date, end_date, supplier_status, cancellation_charge, refund_amount, details')
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
  const discountAmt = Number(discount_amount || 0);

  // ── GST: org identity + master rules (organisations.tax_config), with
  //    inline per-invoice overrides; an explicit tax_amount always wins. ──
  const { data: orgRow } = await supabase
    .from('users')
    .select('org_id, organisations(gstin, gst_state_code, tax_config)')
    .eq('id', booking.created_by)
    .single();
  const orgTax = orgRow?.organisations as { gstin?: string | null; gst_state_code?: string | null; tax_config?: Record<string, unknown> } | null;
  const taxConfig = resolveTaxConfig((orgTax?.tax_config as never) || null);

  const recipient = (booking.bill_to || booking.clients) as {
    id?: string; full_name?: string; email?: string; phone?: string;
    gstin?: string | null; gst_legal_name?: string | null; gst_state_code?: string | null; billing_address?: string | null;
  } | null;
  const recipientGstin = recipient?.gstin || null;
  const orgState = orgTax?.gst_state_code || null;
  // POS: registered recipient → their GST state; else org state (over-the-counter)
  const posState = recipientGstin ? recipient?.gst_state_code || null : orgState;

  const overrides = (body.tax_overrides || {}) as { tax_class?: TaxClass; rate?: number };
  const taxWarnings: string[] = [];
  let taxableValue = 0;
  let taxAmt: number;
  let uniformRate: number | null = null;
  let sacCode: string | null = null;
  let taxClassUsed: string | null = null;

  if (tax_amount !== undefined && tax_amount !== null && tax_amount !== '') {
    // Manual override — recorded as-is
    taxAmt = Number(tax_amount) || 0;
    taxClassUsed = 'MANUAL';
    uniformRate = overrides.rate ?? null;
  } else if (invoice_type === 'credit_note') {
    taxAmt = 0; // credit-note tax follows the original invoice; enter manually if needed
  } else {
    // Engine: classify and compute per booking item
    const taxableItems = (items || []).filter(i => i.supplier_status !== 'cancelled');
    const rates = new Set<number>();
    const classes = new Set<string>();
    let tax = 0;
    for (const i of taxableItems) {
      const cls = overrides.tax_class || TAX_CLASS_BY_ITEM_TYPE[i.item_type] || 'SERVICE_FEE';
      const det = (i.details || {}) as Record<string, unknown>;
      const comp = computeLineTax({
        taxClass: cls,
        sellPrice: Number(i.sell_price) || 0,
        costPrice: i.cost_price == null ? null : Number(i.cost_price),
        basicFare: det.basic_fare ? Number(det.basic_fare) : null,
        international: Boolean(det.international) || booking.booking_type === 'package' && Boolean(body.overseas_package),
      }, taxConfig);
      const rate = overrides.rate ?? comp.rate;
      const lineTax = overrides.rate != null ? Math.round(comp.taxableValue * overrides.rate) / 100 : comp.taxAmount;
      taxableValue += comp.taxableValue;
      tax += lineTax;
      if (comp.taxableValue > 0 || lineTax > 0) { rates.add(rate); classes.add(cls); }
      taxWarnings.push(...comp.warnings.map(w => `${i.label}: ${w}`));
    }
    // Booking-level fallback when there are no items
    if (taxableItems.length === 0 && subtotal > 0) {
      const cls = overrides.tax_class || (booking.booking_type === 'package' ? 'TOUR_OPERATOR' : 'SERVICE_FEE');
      const comp = computeLineTax({ taxClass: cls, sellPrice: subtotal, costPrice: Number(booking.cost_price) || null }, taxConfig);
      taxableValue = comp.taxableValue;
      tax = comp.taxAmount;
      rates.add(overrides.rate ?? comp.rate);
      classes.add(cls);
      taxWarnings.push(...comp.warnings);
    }
    taxAmt = Math.round(tax * 100) / 100;
    taxableValue = Math.round(taxableValue * 100) / 100;
    const rateArr = Array.from(rates);
    const classArr = Array.from(classes);
    uniformRate = rateArr.length === 1 ? rateArr[0] : null;
    taxClassUsed = classArr.length === 1 ? classArr[0] : classArr.length > 1 ? 'MIXED' : null;
    sacCode = classArr.length === 1 ? SAC_BY_CLASS[classArr[0] as TaxClass] || null : null;
  }

  const split = splitTax(taxAmt, orgState, posState);

  // TCS on overseas tour packages (flat 2% under current law; SLAB mode
  // honours the payer's FY aggregate)
  let tcsAmount = 0;
  if (body.overseas_package && invoice_type !== 'credit_note') {
    let fyAggregate = 0;
    if (taxConfig.tcs.mode === 'SLAB' && recipient?.id) {
      const fyStart = new Date();
      const fy = fyStart.getMonth() >= 3 ? fyStart.getFullYear() : fyStart.getFullYear() - 1;
      const { data: prior } = await supabase
        .from('invoices')
        .select('total')
        .eq('client_id', recipient.id)
        .eq('overseas_package', true)
        .neq('status', 'void')
        .gte('created_at', `${fy}-04-01`);
      fyAggregate = (prior || []).reduce((s, r) => s + (Number(r.total) || 0), 0);
    }
    tcsAmount = computeTcs(subtotal + taxAmt - discountAmt, fyAggregate, taxConfig).tcsAmount;
  }

  const total = subtotal + taxAmt - discountAmt + tcsAmount;
  const isTaxInvoice = invoice_type === 'final' && Boolean(recipientGstin);

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

  // Generate PDF — billed to the payer (bill-to entity when present)
  const html = invoiceHTML({
    invoiceNumber,
    invoiceType: invoice_type,
    invoiceDate,
    dueDate: due_date || undefined,
    orgName,
    orgAddress: org?.address,
    orgPhone: org?.phone,
    orgEmail: org?.email,
    orgGstin: org?.gstin || orgTax?.gstin || undefined,
    logoDataUri: logoDataUri || undefined,
    clientName: recipient?.full_name || client?.full_name || 'Guest',
    clientEmail: recipient?.email || client?.email,
    clientPhone: recipient?.phone || client?.phone,
    clientAddress: recipient?.billing_address || undefined,
    recipientGstin: recipientGstin || undefined,
    recipientLegalName: recipient?.gst_legal_name || undefined,
    placeOfSupply: posState ? `${posState} — ${GST_STATE_CODES[posState] || ''}` : undefined,
    sacCode: sacCode || undefined,
    taxBreakup: uniformRate != null && taxAmt > 0
      ? { rate: uniformRate, cgst: split.cgst, sgst: split.sgst, igst: split.igst }
      : undefined,
    tcsAmount: tcsAmount || undefined,
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

  // Save invoice record — client_id is the PAYER (bill-to entity when set)
  const { data: invoice, error: iErr } = await supabase
    .from('invoices')
    .insert({
      booking_id: id,
      invoice_number: invoiceNumber,
      invoice_type,
      client_id: recipient?.id || client?.id || null,
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
      // GST detail
      is_tax_invoice: isTaxInvoice,
      recipient_gstin: recipientGstin,
      recipient_legal_name: recipient?.gst_legal_name || null,
      place_of_supply: posState,
      taxable_value: taxableValue || null,
      cgst_amount: split.cgst,
      sgst_amount: split.sgst,
      igst_amount: split.igst,
      tax_rate: uniformRate,
      sac_code: sacCode,
      tax_class: taxClassUsed,
      tcs_amount: tcsAmount,
      overseas_package: Boolean(body.overseas_package),
      reference_invoice_id: body.reference_invoice_id || null,
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
