// Receipt HTML template — rendered to PDF via Puppeteer

const BRAND = {
  navy: '#1e3a5f',
  green: '#166534',
  white: '#ffffff',
  grayBg: '#f8fafc',
  grayText: '#64748b',
  grayBorder: '#e2e8f0',
};

export interface ReceiptData {
  receiptNumber: string;
  receiptDate: string;

  // Org / seller
  orgName: string;
  orgAddress?: string;
  orgPhone?: string;
  orgEmail?: string;
  orgGstin?: string;
  logoDataUri?: string;

  // Client
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;

  // Booking
  bookingTitle?: string;
  destination?: string;
  tripId?: string;

  // Payment
  amount: number;
  paymentMode?: string;
  referenceNumber?: string;
  currency: string;

  // Balance
  totalBookingAmount: number;
  totalPaidSoFar: number;
  balanceRemaining: number;

  notes?: string;
}

export function receiptHTML(data: ReceiptData): string {
  const cur = data.currency === 'INR' ? '₹' : data.currency;

  const logo = data.logoDataUri
    ? `<img src="${data.logoDataUri}" alt="Logo" style="max-height:50px;max-width:180px;" />`
    : `<span style="font-size:1.4rem;font-weight:700;color:${BRAND.navy};">${data.orgName}</span>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1e293b; font-size: 14px; line-height: 1.5; }
    .container { max-width: 700px; margin: 0 auto; padding: 40px 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 3px solid ${BRAND.green}; }
    .receipt-title { font-size: 1.6rem; font-weight: 700; color: ${BRAND.green}; letter-spacing: 1px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .info-box { background: ${BRAND.grayBg}; border-radius: 8px; padding: 16px; }
    .info-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: ${BRAND.grayText}; margin-bottom: 4px; }
    .info-value { font-weight: 600; font-size: 0.95rem; }
    .amount-box { background: ${BRAND.green}; color: white; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0; }
    .amount-box .label { font-size: 0.85rem; opacity: 0.9; }
    .amount-box .value { font-size: 2.2rem; font-weight: 700; margin-top: 4px; }
    .summary-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .summary-table td { padding: 10px 0; }
    .summary-table td:first-child { color: ${BRAND.grayText}; }
    .summary-table td:last-child { text-align: right; font-weight: 600; }
    .summary-table .total { border-top: 2px solid ${BRAND.grayBorder}; font-size: 1.05rem; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid ${BRAND.grayBorder}; text-align: center; font-size: 0.8rem; color: ${BRAND.grayText}; }
    .notes { background: ${BRAND.grayBg}; border-radius: 8px; padding: 12px 16px; margin-top: 20px; font-size: 0.85rem; color: ${BRAND.grayText}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>${logo}</div>
      <div style="text-align:right;">
        <div class="receipt-title">PAYMENT RECEIPT</div>
        <div style="color:${BRAND.grayText};font-size:0.85rem;margin-top:4px;">${data.receiptNumber}</div>
        ${data.tripId ? `<div style="color:${BRAND.grayText};font-size:0.85rem;">Trip: ${data.tripId}</div>` : ''}
        <div style="color:${BRAND.grayText};font-size:0.85rem;">Date: ${data.receiptDate}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">Received From</div>
        <div class="info-value">${data.clientName}</div>
        ${data.clientEmail ? `<div style="font-size:0.85rem;color:${BRAND.grayText};">${data.clientEmail}</div>` : ''}
        ${data.clientPhone ? `<div style="font-size:0.85rem;color:${BRAND.grayText};">${data.clientPhone}</div>` : ''}
      </div>
      <div class="info-box">
        <div class="info-label">Booking Details</div>
        <div class="info-value">${data.bookingTitle || 'Travel Booking'}</div>
        ${data.destination ? `<div style="font-size:0.85rem;color:${BRAND.grayText};">${data.destination}</div>` : ''}
      </div>
    </div>

    <div class="amount-box">
      <div class="label">Amount Received</div>
      <div class="value">${cur}${data.amount.toLocaleString('en-IN')}</div>
      ${data.paymentMode ? `<div style="font-size:0.85rem;opacity:0.8;margin-top:4px;">via ${data.paymentMode}</div>` : ''}
      ${data.referenceNumber ? `<div style="font-size:0.8rem;opacity:0.7;">Ref: ${data.referenceNumber}</div>` : ''}
    </div>

    <table class="summary-table">
      <tr>
        <td>Total Booking Amount</td>
        <td>${cur}${data.totalBookingAmount.toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td>Total Paid (including this payment)</td>
        <td>${cur}${data.totalPaidSoFar.toLocaleString('en-IN')}</td>
      </tr>
      <tr class="total">
        <td>Balance Remaining</td>
        <td style="color:${data.balanceRemaining > 0 ? '#dc2626' : BRAND.green};">
          ${cur}${data.balanceRemaining.toLocaleString('en-IN')}
        </td>
      </tr>
    </table>

    ${data.notes ? `<div class="notes"><strong>Notes:</strong> ${data.notes}</div>` : ''}

    <div class="footer">
      <p><strong>${data.orgName}</strong></p>
      ${data.orgAddress ? `<p>${data.orgAddress}</p>` : ''}
      ${data.orgPhone || data.orgEmail ? `<p>${[data.orgPhone, data.orgEmail].filter(Boolean).join(' · ')}</p>` : ''}
      ${data.orgGstin ? `<p>GSTIN: ${data.orgGstin}</p>` : ''}
      <p style="margin-top:12px;">This is a computer-generated receipt and does not require a signature.</p>
    </div>
  </div>
</body>
</html>`;
}
