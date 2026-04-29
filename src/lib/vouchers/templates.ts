// Voucher HTML templates — rendered to PDF via Puppeteer
// Branded with EzTrips design system

const BRAND = {
  navy: '#1e3a5f',
  navyLight: '#2d5f8a',
  green: '#166534',
  accent: '#d4920a',
  white: '#ffffff',
  grayBg: '#f1f5f9',
  grayText: '#64748b',
  grayBorder: '#e2e8f0',
  grayMuted: '#94a3b8',
  warningBg: '#fffbeb',
  warningBorder: '#f59e0b',
  warningText: '#92400e',
};

function baseLayout(title: string, logoDataUri: string, orgName: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans', Arial, sans-serif; color: #222; padding: 40px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${BRAND.navy}; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { height: 48px; }
  .org-name { font-size: 1.1rem; color: ${BRAND.navy}; font-weight: 700; }
  .eztrips-mark { font-size: 0.65rem; color: ${BRAND.grayMuted}; letter-spacing: 1px; text-transform: uppercase; }
  .title { font-size: 1.4rem; font-weight: 700; color: ${BRAND.navy}; margin-bottom: 20px; text-align: center; }
  .badge { display: inline-block; background: ${BRAND.green}; color: ${BRAND.white}; padding: 4px 14px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { text-align: left; padding: 8px 12px; background: ${BRAND.grayBg}; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid ${BRAND.grayBorder}; }
  td { padding: 10px 12px; border-bottom: 1px solid ${BRAND.grayBorder}; font-size: 0.9rem; }
  .label { color: ${BRAND.grayText}; font-weight: 600; width: 180px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 2px solid ${BRAND.navy}; font-size: 0.75rem; color: ${BRAND.grayMuted}; text-align: center; }
  .footer .powered { font-size: 0.65rem; color: #ccc; margin-top: 4px; }
  .note { background: ${BRAND.warningBg}; border-left: 3px solid ${BRAND.warningBorder}; padding: 12px 16px; font-size: 0.85rem; margin-top: 16px; color: ${BRAND.warningText}; border-radius: 0 4px 4px 0; }
</style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="logo"/>` : ''}
      <div>
        <div class="org-name">${orgName}</div>
        <div class="eztrips-mark">Travel Management</div>
      </div>
    </div>
    <span class="eztrips-mark">EZTRIPS</span>
  </div>
  <div class="title">${title}</div>
  <div style="text-align:center;"><span class="badge">CONFIRMED</span></div>
  ${body}
  <div class="footer">
    This voucher is issued by ${orgName}. Please present this voucher at the time of check-in/service.
    <div class="powered">Powered by EzTrips</div>
  </div>
</body>
</html>`;
}

function row(label: string, value: string): string {
  if (!value) return '';
  return `<tr><td class="label">${label}</td><td>${value}</td></tr>`;
}

export interface HotelVoucherData {
  customerName: string;
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  roomType?: string;
  confirmationNumber?: string;
  contactPhone?: string;
  specialRequests?: string;
}

export function hotelVoucherHTML(d: HotelVoucherData, logoDataUri: string, orgName: string): string {
  return baseLayout('Hotel Voucher', logoDataUri, orgName, `
    <table>
      ${row('Guest Name', d.customerName)}
      ${row('Hotel', d.hotelName)}
      ${row('Check-in', d.checkInDate)}
      ${row('Check-out', d.checkOutDate)}
      ${row('Room Type', d.roomType || '')}
      ${row('Confirmation No.', d.confirmationNumber || '')}
      ${row('Contact', d.contactPhone || '')}
    </table>
    ${d.specialRequests ? `<div class="note"><strong>Special Requests:</strong> ${d.specialRequests}</div>` : ''}
  `);
}

export interface FlightVoucherData {
  customerName: string;
  airline: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  route: string;
  seatNumber?: string;
  confirmationNumber?: string;
  contactPhone?: string;
  baggage?: string;
}

export function flightVoucherHTML(d: FlightVoucherData, logoDataUri: string, orgName: string): string {
  return baseLayout('Flight Voucher', logoDataUri, orgName, `
    <table>
      ${row('Passenger', d.customerName)}
      ${row('Airline', d.airline)}
      ${row('Flight', d.flightNumber)}
      ${row('Route', d.route)}
      ${row('Departure', d.departureTime)}
      ${row('Arrival', d.arrivalTime)}
      ${row('Seat', d.seatNumber || '')}
      ${row('Baggage', d.baggage || '')}
      ${row('PNR / Confirmation', d.confirmationNumber || '')}
      ${row('Contact', d.contactPhone || '')}
    </table>
    <div class="note"><strong>Important:</strong> Please arrive at the airport at least 2 hours before departure for domestic and 3 hours for international flights.</div>
  `);
}

export interface ActivityVoucherData {
  customerName: string;
  activityName: string;
  activityDate: string;
  activityTime?: string;
  location?: string;
  guideName?: string;
  confirmationNumber?: string;
  contactPhone?: string;
}

export function activityVoucherHTML(d: ActivityVoucherData, logoDataUri: string, orgName: string): string {
  return baseLayout('Activity Voucher', logoDataUri, orgName, `
    <table>
      ${row('Guest Name', d.customerName)}
      ${row('Activity', d.activityName)}
      ${row('Date', d.activityDate)}
      ${row('Time', d.activityTime || '')}
      ${row('Location', d.location || '')}
      ${row('Guide', d.guideName || '')}
      ${row('Confirmation No.', d.confirmationNumber || '')}
      ${row('Contact', d.contactPhone || '')}
    </table>
  `);
}

export interface TransferVoucherData {
  customerName: string;
  pickupTime: string;
  pickupLocation: string;
  dropoffLocation: string;
  vehicleType?: string;
  driverName?: string;
  contactPhone?: string;
}

export function transferVoucherHTML(d: TransferVoucherData, logoDataUri: string, orgName: string): string {
  return baseLayout('Transfer Voucher', logoDataUri, orgName, `
    <table>
      ${row('Guest Name', d.customerName)}
      ${row('Pickup Time', d.pickupTime)}
      ${row('Pickup Location', d.pickupLocation)}
      ${row('Drop-off Location', d.dropoffLocation)}
      ${row('Vehicle', d.vehicleType || '')}
      ${row('Driver', d.driverName || '')}
      ${row('Contact', d.contactPhone || '')}
    </table>
    <div class="note"><strong>Note:</strong> The driver will be at the pickup location 15 minutes before the scheduled time.</div>
  `);
}
