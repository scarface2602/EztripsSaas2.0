/**
 * Print stylesheet contract shared by every PDF pipeline (proposals,
 * vouchers, invoices, receipts). Injected by htmlToPdf so all templates
 * obey the same page-break discipline without each one re-declaring it.
 */
export const PRINT_BASE_CSS = `
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4, h5, h6 {
    break-after: avoid;
    page-break-after: avoid;
  }
  p {
    orphans: 3;
    widows: 3;
  }
  table, figure, img, blockquote {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  /* Atomic blocks — add this class to any card that must never split. */
  .avoid-break,
  .card,
  .hotel-card,
  .day-card,
  .voucher-section,
  .line-item,
  .payment-terms {
    break-inside: avoid;
    page-break-inside: avoid;
  }
`;
