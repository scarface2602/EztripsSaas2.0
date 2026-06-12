// Invoice HTML template — rendered to PDF via Puppeteer

const BRAND = {
  navy: '#1e3a5f',
  green: '#166534',
  white: '#ffffff',
  grayBg: '#f8fafc',
  grayText: '#64748b',
  grayBorder: '#e2e8f0',
  grayMuted: '#94a3b8',
};

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceType: 'proforma' | 'final' | 'credit_note';
  invoiceDate: string;
  dueDate?: string;

  // Org / seller
  orgName: string;
  orgAddress?: string;
  orgPhone?: string;
  orgEmail?: string;
  orgGstin?: string;
  logoDataUri?: string;

  // Client / buyer
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;

  // Booking reference
  bookingTitle?: string;
  destination?: string;
  travelDates?: string;
  tripId?: string;

  // GST (tax invoice) — when present, the tax row becomes a CGST/SGST
  // or IGST breakup and the recipient's GST identity is printed.
  recipientGstin?: string;
  recipientLegalName?: string;
  placeOfSupply?: string;       // e.g. "20 — Jharkhand"
  sacCode?: string;
  taxBreakup?: { rate: number; cgst: number; sgst: number; igst: number };
  tcsAmount?: number;

  // Line items
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxLabel?: string;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;

  // Payment info
  bankDetails?: { accountName?: string; bankName?: string; accountNumber?: string; ifsc?: string };

  notes?: string;
}

function typeLabel(type: string): string {
  switch (type) {
    case 'proforma': return 'PROFORMA INVOICE';
    case 'credit_note': return 'CREDIT NOTE';
    default: return 'TAX INVOICE';
  }
}

export function invoiceHTML(d: InvoiceData): string {
  const lineItemRows = d.lineItems.map((item, i) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.grayBorder};text-align:center;color:${BRAND.grayText};font-size:0.85rem;">${i + 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.grayBorder};font-size:0.9rem;">${item.description}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.grayBorder};text-align:center;font-size:0.9rem;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.grayBorder};text-align:right;font-size:0.9rem;">${d.currency} ${item.rate.toLocaleString()}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.grayBorder};text-align:right;font-size:0.9rem;font-weight:600;">${d.currency} ${item.amount.toLocaleString()}</td>
    </tr>
  `).join('');

  const bankSection = d.bankDetails && d.bankDetails.bankName ? `
    <div style="margin-top:24px;padding:16px;background:${BRAND.grayBg};border-radius:6px;font-size:0.85rem;">
      <div style="font-weight:600;color:${BRAND.navy};margin-bottom:8px;">Bank Details for Payment</div>
      ${d.bankDetails.accountName ? `<div>Account Name: <strong>${d.bankDetails.accountName}</strong></div>` : ''}
      ${d.bankDetails.bankName ? `<div>Bank: <strong>${d.bankDetails.bankName}</strong></div>` : ''}
      ${d.bankDetails.accountNumber ? `<div>Account No: <strong>${d.bankDetails.accountNumber}</strong></div>` : ''}
      ${d.bankDetails.ifsc ? `<div>IFSC: <strong>${d.bankDetails.ifsc}</strong></div>` : ''}
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans', Arial, sans-serif; color: #222; padding: 40px; }
</style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${BRAND.navy};padding-bottom:16px;margin-bottom:24px;">
    <div style="display:flex;align-items:center;gap:12px;">
      ${d.logoDataUri ? `<img src="${d.logoDataUri}" alt="logo" style="height:48px;"/>` : ''}
      <div>
        <div style="font-size:1.1rem;color:${BRAND.navy};font-weight:700;">${d.orgName}</div>
        ${d.orgAddress ? `<div style="font-size:0.75rem;color:${BRAND.grayText};max-width:250px;">${d.orgAddress}</div>` : ''}
        ${d.orgPhone ? `<div style="font-size:0.75rem;color:${BRAND.grayText};">${d.orgPhone}</div>` : ''}
        ${d.orgEmail ? `<div style="font-size:0.75rem;color:${BRAND.grayText};">${d.orgEmail}</div>` : ''}
        ${d.orgGstin ? `<div style="font-size:0.75rem;color:${BRAND.grayText};">GSTIN: ${d.orgGstin}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:1.2rem;font-weight:700;color:${BRAND.navy};">${typeLabel(d.invoiceType)}</div>
      <div style="font-size:0.9rem;font-weight:600;margin-top:4px;">${d.invoiceNumber}</div>
      ${d.tripId ? `<div style="font-size:0.8rem;color:${BRAND.grayText};margin-top:2px;">Trip: ${d.tripId}</div>` : ''}
      <div style="font-size:0.8rem;color:${BRAND.grayText};margin-top:2px;">Date: ${d.invoiceDate}</div>
      ${d.dueDate ? `<div style="font-size:0.8rem;color:${BRAND.grayText};">Due: ${d.dueDate}</div>` : ''}
    </div>
  </div>

  <!-- Bill To + Booking -->
  <div style="display:flex;gap:40px;margin-bottom:24px;">
    <div style="flex:1;">
      <div style="font-size:0.75rem;color:${BRAND.grayText};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Bill To</div>
      <div style="font-weight:600;">${d.recipientLegalName || d.clientName}</div>
      ${d.recipientLegalName && d.recipientLegalName !== d.clientName ? `<div style="font-size:0.8rem;color:${BRAND.grayText};">${d.clientName}</div>` : ''}
      ${d.recipientGstin ? `<div style="font-size:0.85rem;font-weight:600;color:${BRAND.navy};">GSTIN: ${d.recipientGstin}</div>` : ''}
      ${d.clientEmail ? `<div style="font-size:0.85rem;color:${BRAND.grayText};">${d.clientEmail}</div>` : ''}
      ${d.clientPhone ? `<div style="font-size:0.85rem;color:${BRAND.grayText};">${d.clientPhone}</div>` : ''}
      ${d.clientAddress ? `<div style="font-size:0.85rem;color:${BRAND.grayText};">${d.clientAddress}</div>` : ''}
      ${d.placeOfSupply ? `<div style="font-size:0.8rem;color:${BRAND.grayText};margin-top:2px;">Place of Supply: ${d.placeOfSupply}</div>` : ''}
      ${d.sacCode ? `<div style="font-size:0.8rem;color:${BRAND.grayText};">SAC: ${d.sacCode}</div>` : ''}
    </div>
    ${d.bookingTitle || d.destination ? `
    <div style="flex:1;">
      <div style="font-size:0.75rem;color:${BRAND.grayText};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Booking Reference</div>
      ${d.bookingTitle ? `<div style="font-weight:600;">${d.bookingTitle}</div>` : ''}
      ${d.destination ? `<div style="font-size:0.85rem;color:${BRAND.grayText};">${d.destination}</div>` : ''}
      ${d.travelDates ? `<div style="font-size:0.85rem;color:${BRAND.grayText};">${d.travelDates}</div>` : ''}
    </div>` : ''}
  </div>

  <!-- Line Items -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:${BRAND.navy};color:${BRAND.white};">
        <th style="padding:10px 12px;text-align:center;font-size:0.75rem;text-transform:uppercase;width:40px;">#</th>
        <th style="padding:10px 12px;text-align:left;font-size:0.75rem;text-transform:uppercase;">Description</th>
        <th style="padding:10px 12px;text-align:center;font-size:0.75rem;text-transform:uppercase;width:60px;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:0.75rem;text-transform:uppercase;width:120px;">Rate</th>
        <th style="padding:10px 12px;text-align:right;font-size:0.75rem;text-transform:uppercase;width:120px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;">
    <table style="width:280px;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 12px;color:${BRAND.grayText};font-size:0.9rem;">Subtotal</td>
        <td style="padding:6px 12px;text-align:right;font-size:0.9rem;">${d.currency} ${d.subtotal.toLocaleString()}</td>
      </tr>
      ${d.taxBreakup && d.taxAmount > 0 ? `
        ${d.taxBreakup.igst > 0 ? `<tr>
          <td style="padding:6px 12px;color:${BRAND.grayText};font-size:0.9rem;">IGST @ ${d.taxBreakup.rate}%</td>
          <td style="padding:6px 12px;text-align:right;font-size:0.9rem;">${d.currency} ${d.taxBreakup.igst.toLocaleString()}</td>
        </tr>` : `<tr>
          <td style="padding:6px 12px;color:${BRAND.grayText};font-size:0.9rem;">CGST @ ${d.taxBreakup.rate / 2}%</td>
          <td style="padding:6px 12px;text-align:right;font-size:0.9rem;">${d.currency} ${d.taxBreakup.cgst.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:6px 12px;color:${BRAND.grayText};font-size:0.9rem;">SGST @ ${d.taxBreakup.rate / 2}%</td>
          <td style="padding:6px 12px;text-align:right;font-size:0.9rem;">${d.currency} ${d.taxBreakup.sgst.toLocaleString()}</td>
        </tr>`}
      ` : d.taxAmount > 0 ? `<tr>
        <td style="padding:6px 12px;color:${BRAND.grayText};font-size:0.9rem;">${d.taxLabel || 'Tax'}</td>
        <td style="padding:6px 12px;text-align:right;font-size:0.9rem;">${d.currency} ${d.taxAmount.toLocaleString()}</td>
      </tr>` : ''}
      ${d.tcsAmount && d.tcsAmount > 0 ? `<tr>
        <td style="padding:6px 12px;color:${BRAND.grayText};font-size:0.9rem;">TCS (overseas tour package)</td>
        <td style="padding:6px 12px;text-align:right;font-size:0.9rem;">${d.currency} ${d.tcsAmount.toLocaleString()}</td>
      </tr>` : ''}
      ${d.discountAmount > 0 ? `<tr>
        <td style="padding:6px 12px;color:${BRAND.grayText};font-size:0.9rem;">Discount</td>
        <td style="padding:6px 12px;text-align:right;font-size:0.9rem;color:${BRAND.green};">- ${d.currency} ${d.discountAmount.toLocaleString()}</td>
      </tr>` : ''}
      <tr style="border-top:2px solid ${BRAND.navy};">
        <td style="padding:10px 12px;font-weight:700;font-size:1rem;">Total</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:1rem;">${d.currency} ${d.total.toLocaleString()}</td>
      </tr>
      ${d.amountPaid > 0 ? `<tr>
        <td style="padding:6px 12px;color:${BRAND.grayText};font-size:0.9rem;">Amount Paid</td>
        <td style="padding:6px 12px;text-align:right;font-size:0.9rem;">${d.currency} ${d.amountPaid.toLocaleString()}</td>
      </tr>` : ''}
      ${d.balanceDue > 0 ? `<tr style="background:${BRAND.grayBg};">
        <td style="padding:8px 12px;font-weight:600;font-size:0.95rem;color:${BRAND.navy};">Balance Due</td>
        <td style="padding:8px 12px;text-align:right;font-weight:600;font-size:0.95rem;color:${BRAND.navy};">${d.currency} ${d.balanceDue.toLocaleString()}</td>
      </tr>` : ''}
    </table>
  </div>

  ${bankSection}

  ${d.notes ? `<div style="margin-top:20px;font-size:0.85rem;color:${BRAND.grayText};"><strong>Notes:</strong> ${d.notes}</div>` : ''}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:16px;border-top:2px solid ${BRAND.navy};font-size:0.75rem;color:${BRAND.grayMuted};text-align:center;">
    ${d.invoiceType === 'proforma' ? 'This is a proforma invoice and not a demand for payment.' : 'Thank you for your business.'}
    <div style="font-size:0.65rem;color:#ccc;margin-top:4px;">Powered by EzTrips</div>
  </div>
</body>
</html>`;
}
