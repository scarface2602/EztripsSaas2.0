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

export type VoucherStatus = 'confirmed' | 'blocked';

function baseLayout(title: string, logoDataUri: string, orgName: string, body: string, status: VoucherStatus = 'confirmed'): string {
  const isConfirmed = status === 'confirmed';
  const badgeColor = isConfirmed ? BRAND.green : '#d97706';
  const badgeText = isConfirmed ? 'CONFIRMED' : 'BLOCKED';

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
  .badge { display: inline-block; background: ${badgeColor}; color: ${BRAND.white}; padding: 4px 14px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 20px; }
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
  <div style="text-align:center;"><span class="badge">${badgeText}</span></div>
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
  checkInTime?: string;
  checkOutTime?: string;
  roomType?: string;
  numberOfRooms?: number;
  guestNames?: string[];
  mealPlan?: string;
  confirmationNumber?: string;
  contactPhone?: string;
  hotelSupportPhone?: string;
  specialRequests?: string;
}

export function hotelVoucherHTML(d: HotelVoucherData, logoDataUri: string, orgName: string, status: VoucherStatus = 'confirmed'): string {
  const guestList = d.guestNames && d.guestNames.length > 0
    ? d.guestNames.map((g, i) => `Room ${i + 1}: ${g}`).join('<br/>')
    : '';

  return baseLayout('Hotel Voucher', logoDataUri, orgName, `
    <table>
      ${row('Guest Name', d.customerName)}
      ${row('Hotel', d.hotelName)}
      ${row('Check-in', d.checkInDate + (d.checkInTime ? ` at ${d.checkInTime}` : ''))}
      ${row('Check-out', d.checkOutDate + (d.checkOutTime ? ` at ${d.checkOutTime}` : ''))}
      ${row('Room Type', d.roomType || '')}
      ${row('No. of Rooms', d.numberOfRooms ? String(d.numberOfRooms) : '')}
      ${row('Meal Plan', d.mealPlan || '')}
      ${status === 'confirmed' ? row('Confirmation No.', d.confirmationNumber || '') : ''}
      ${row('Hotel Contact', d.hotelSupportPhone || '')}
      ${row('Agent Contact', d.contactPhone || '')}
    </table>
    ${guestList ? `<div style="margin-top:12px;"><strong style="font-size:0.85rem;">Guests per Room:</strong><br/><span style="font-size:0.85rem;">${guestList}</span></div>` : ''}
    ${d.specialRequests ? `<div class="note"><strong>Special Requests:</strong> ${d.specialRequests}</div>` : ''}
  `, status);
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

export function flightVoucherHTML(d: FlightVoucherData, logoDataUri: string, orgName: string, status: VoucherStatus = 'confirmed'): string {
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
      ${status === 'confirmed' ? row('PNR / Confirmation', d.confirmationNumber || '') : ''}
      ${row('Contact', d.contactPhone || '')}
    </table>
    <div class="note"><strong>Important:</strong> Please arrive at the airport at least 2 hours before departure for domestic and 3 hours for international flights.</div>
  `, status);
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

export function activityVoucherHTML(d: ActivityVoucherData, logoDataUri: string, orgName: string, status: VoucherStatus = 'confirmed'): string {
  return baseLayout('Activity Voucher', logoDataUri, orgName, `
    <table>
      ${row('Guest Name', d.customerName)}
      ${row('Activity', d.activityName)}
      ${row('Date', d.activityDate)}
      ${row('Time', d.activityTime || '')}
      ${row('Location', d.location || '')}
      ${row('Guide', d.guideName || '')}
      ${status === 'confirmed' ? row('Confirmation No.', d.confirmationNumber || '') : ''}
      ${row('Contact', d.contactPhone || '')}
    </table>
  `, status);
}

export interface TransferVoucherData {
  customerName: string;
  pickupTime: string;
  pickupLocation: string;
  dropoffLocation: string;
  vehicleType?: string;
  serviceProviderName?: string;
  serviceProviderContact?: string;
  driverName?: string;
  driverContact?: string;
  confirmationNumber?: string;
  contactPhone?: string;
}

export function transferVoucherHTML(d: TransferVoucherData, logoDataUri: string, orgName: string, status: VoucherStatus = 'confirmed'): string {
  return baseLayout('Transfer Voucher', logoDataUri, orgName, `
    <table>
      ${row('Guest Name', d.customerName)}
      ${row('Pickup Time', d.pickupTime)}
      ${row('Pickup Location', d.pickupLocation)}
      ${row('Drop-off Location', d.dropoffLocation)}
      ${row('Vehicle', d.vehicleType || '')}
      ${row('Service Provider', d.serviceProviderName ? `${d.serviceProviderName}${d.serviceProviderContact ? ` · ${d.serviceProviderContact}` : ''}` : '')}
      ${row('Driver', d.driverName ? `${d.driverName}${d.driverContact ? ` · ${d.driverContact}` : ''}` : '')}
      ${status === 'confirmed' ? row('Confirmation No.', d.confirmationNumber || '') : ''}
      ${row('Agent Contact', d.contactPhone || '')}
    </table>
    <div class="note"><strong>Note:</strong> The driver will be at the pickup location 15 minutes before the scheduled time.</div>
  `, status);
}

// ─── Vehicle Voucher ─────────────────────────────────────────────────────────

export interface VehicleVoucherData {
  customerName: string;
  vehicleBrand?: string;
  vehicleType: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDatetime: string;
  dropoffDatetime: string;
  availabilityMode?: string;
  dailyHours?: string;
  driverName?: string;
  driverContact?: string;
  confirmationNumber?: string;
  contactPhone?: string;
  itinerary?: Array<{ date?: string; time?: string; location?: string; notes?: string }>;
}

export function vehicleVoucherHTML(d: VehicleVoucherData, logoDataUri: string, orgName: string, status: VoucherStatus = 'confirmed'): string {
  const vehicleLabel = [d.vehicleBrand, d.vehicleType?.replace(/_/g, ' ')].filter(Boolean).join(' — ');
  const modeLabel = d.availabilityMode === 'at_disposal' ? 'At Disposal' : d.availabilityMode === 'point_to_point' ? 'Point-to-Point' : (d.availabilityMode || '');

  let itineraryHtml = '';
  if (d.itinerary && d.itinerary.length > 0 && d.itinerary.some(i => i.location)) {
    itineraryHtml = `
      <div style="margin-top:16px;">
        <div style="font-weight:600;color:${BRAND.navy};font-size:0.95rem;margin-bottom:8px;">Itinerary</div>
        <table>
          <thead><tr><th>Date</th><th>Time</th><th>Location</th><th>Notes</th></tr></thead>
          <tbody>
            ${d.itinerary.filter(i => i.location).map(i => `<tr><td>${i.date || ''}</td><td>${i.time || ''}</td><td>${i.location || ''}</td><td>${i.notes || ''}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  return baseLayout('Vehicle Voucher', logoDataUri, orgName, `
    <table>
      ${row('Guest Name', d.customerName)}
      ${row('Vehicle', vehicleLabel)}
      ${row('Pickup', d.pickupDatetime)}
      ${row('Pickup Location', d.pickupLocation)}
      ${row('Drop-off', d.dropoffDatetime)}
      ${row('Drop-off Location', d.dropoffLocation)}
      ${row('Mode', modeLabel)}
      ${row('Daily Hours', d.dailyHours || '')}
      ${row('Driver', d.driverName || '')}
      ${row('Driver Contact', d.driverContact || '')}
      ${status === 'confirmed' ? row('Confirmation No.', d.confirmationNumber || '') : ''}
      ${row('Contact', d.contactPhone || '')}
    </table>
    ${itineraryHtml}
    <div class="note"><strong>Note:</strong> The driver will be at the pickup location 15 minutes before the scheduled time. Please carry a valid photo ID.</div>
  `, status);
}

// ─── Package Voucher (Combined) ─────────────────────────────────────────────

export interface PackageVoucherItem {
  itemType: string; // hotel_room, flight_segment, vehicle, transfer, activity
  label: string;
  startDate: string;
  endDate?: string;
  supplierReference?: string;
  supplierStatus: string;
  details: Record<string, unknown>;
}

export interface PackageVoucherData {
  voucherNumber: string;
  customerName: string;
  destination: string;
  travelStart: string;
  travelEnd: string;
  paxAdults: number;
  paxChildren: number;
  items: PackageVoucherItem[];
  emergencyContact?: { name?: string; phone?: string; email?: string };
}

function sectionIcon(type: string): string {
  switch (type) {
    case 'flight_segment': return '✈️';
    case 'hotel_room': return '🏨';
    case 'vehicle': return '🚗';
    case 'transfer': return '🚐';
    case 'activity': return '🎯';
    default: return '📋';
  }
}

function sectionTitle(type: string): string {
  switch (type) {
    case 'flight_segment': return 'Flights';
    case 'hotel_room': return 'Hotels';
    case 'vehicle': return 'Vehicle';
    case 'transfer': return 'Transfers';
    case 'activity': return 'Activities';
    default: return 'Other';
  }
}

function flightItemRows(item: PackageVoucherItem): string {
  const d = item.details;
  return `<tr>
    <td>${d.origin_city || ''} → ${d.destination_city || ''}</td>
    <td>${d.airline || ''} ${d.flight_number || ''}</td>
    <td>${item.startDate || ''}</td>
    <td>${d.departure_time || ''} → ${d.arrival_time || ''}</td>
    <td>${item.supplierReference || '—'}</td>
  </tr>`;
}

function hotelItemRows(item: PackageVoucherItem): string {
  const d = item.details;
  const nights = item.endDate && item.startDate
    ? Math.max(1, Math.round((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / 86400000))
    : '';
  return `<tr>
    <td>${d.hotel_name || item.label}</td>
    <td>${d.room_type || 'Standard'}</td>
    <td>${item.startDate || ''} → ${item.endDate || ''}</td>
    <td>${nights ? `${nights} Night${nights > 1 ? 's' : ''}` : ''} · ${d.meal_plan || ''}</td>
    <td>${item.supplierReference || '—'}</td>
  </tr>`;
}

function vehicleItemRows(item: PackageVoucherItem): string {
  const d = item.details;
  const mode = d.availability_mode === 'at_disposal' ? 'At Disposal' : d.availability_mode === 'point_to_point' ? 'Point-to-Point' : '';
  let rows = `<tr>
    <td colspan="2">${[d.vehicle_brand, d.vehicle_type].filter(Boolean).join(' — ') || item.label}</td>
    <td>${item.startDate || ''} → ${item.endDate || ''}</td>
    <td>${mode}${d.daily_hours ? ` · ${d.daily_hours}hrs/day` : ''}</td>
    <td>${item.supplierReference || '—'}</td>
  </tr>`;
  if (d.driver_name || d.driver_contact) {
    rows += `<tr><td colspan="5" style="font-size:0.85rem;color:${BRAND.grayText};">Driver: ${d.driver_name || ''}${d.driver_contact ? ` · ${d.driver_contact}` : ''}</td></tr>`;
  }
  return rows;
}

function transferItemRows(item: PackageVoucherItem): string {
  const d = item.details;
  return `<tr>
    <td>${d.pickup_location || ''} → ${d.dropoff_location || ''}</td>
    <td>${d.vehicle_type || ''}</td>
    <td>${item.startDate || ''}</td>
    <td>${d.driver_name ? `Driver: ${d.driver_name}` : ''}</td>
    <td>${item.supplierReference || '—'}</td>
  </tr>`;
}

function activityItemRows(item: PackageVoucherItem): string {
  const d = item.details;
  return `<tr>
    <td>${d.activity_name || item.label}</td>
    <td>${d.location || ''}</td>
    <td>${item.startDate || ''}</td>
    <td>${d.time || ''}</td>
    <td>${item.supplierReference || '—'}</td>
  </tr>`;
}

function renderItemGroup(type: string, items: PackageVoucherItem[]): string {
  if (items.length === 0) return '';

  const headers: Record<string, string> = {
    flight_segment: '<th>Route</th><th>Flight</th><th>Date</th><th>Time</th><th>PNR</th>',
    hotel_room: '<th>Hotel</th><th>Room</th><th>Dates</th><th>Details</th><th>Conf #</th>',
    vehicle: '<th colspan="2">Vehicle</th><th>Dates</th><th>Details</th><th>Conf #</th>',
    transfer: '<th>Route</th><th>Vehicle</th><th>Date</th><th>Details</th><th>Conf #</th>',
    activity: '<th>Activity</th><th>Location</th><th>Date</th><th>Time</th><th>Conf #</th>',
  };

  const rowRenderer: Record<string, (i: PackageVoucherItem) => string> = {
    flight_segment: flightItemRows,
    hotel_room: hotelItemRows,
    vehicle: vehicleItemRows,
    transfer: transferItemRows,
    activity: activityItemRows,
  };

  const renderer = rowRenderer[type] || ((i: PackageVoucherItem) => `<tr><td colspan="5">${i.label}</td></tr>`);

  return `
    <div style="margin-top:20px;">
      <div style="font-weight:700;color:${BRAND.navy};font-size:1rem;margin-bottom:8px;">
        ${sectionIcon(type)} ${sectionTitle(type)}
      </div>
      <table>
        <thead><tr>${headers[type] || '<th colspan="5">Details</th>'}</tr></thead>
        <tbody>${items.map(renderer).join('')}</tbody>
      </table>
    </div>`;
}

export function packageVoucherHTML(data: PackageVoucherData, logoDataUri: string, orgName: string, status: VoucherStatus = 'confirmed'): string {
  const paxStr = `${data.paxAdults} Adult${data.paxAdults !== 1 ? 's' : ''}${data.paxChildren > 0 ? `, ${data.paxChildren} Child${data.paxChildren !== 1 ? 'ren' : ''}` : ''}`;

  // Group items by type, in display order
  const typeOrder = ['flight_segment', 'hotel_room', 'vehicle', 'transfer', 'activity'];
  const grouped: Record<string, PackageVoucherItem[]> = {};
  for (const item of data.items) {
    const t = item.itemType;
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(item);
  }

  const sections = typeOrder
    .filter(t => grouped[t]?.length)
    .map(t => renderItemGroup(t, grouped[t]))
    .join('');

  // Itinerary from vehicle items
  let itineraryHtml = '';
  const vehicleItems = grouped['vehicle'] || [];
  for (const vi of vehicleItems) {
    const itin = vi.details.itinerary as Array<{ date?: string; time?: string; location?: string; notes?: string }> | undefined;
    if (itin && itin.length > 0 && itin.some(i => i.location)) {
      itineraryHtml += `
        <div style="margin-top:20px;">
          <div style="font-weight:700;color:${BRAND.navy};font-size:1rem;margin-bottom:8px;">📅 Itinerary</div>
          <table>
            <thead><tr><th>Date</th><th>Time</th><th>Location</th><th colspan="2">Notes</th></tr></thead>
            <tbody>${itin.filter(i => i.location).map(i => `<tr><td>${i.date || ''}</td><td>${i.time || ''}</td><td>${i.location || ''}</td><td colspan="2">${i.notes || ''}</td></tr>`).join('')}</tbody>
          </table>
        </div>`;
    }
  }

  // Emergency contact
  let emergencyHtml = '';
  if (data.emergencyContact && (data.emergencyContact.phone || data.emergencyContact.email)) {
    emergencyHtml = `
      <div style="margin-top:24px;padding:12px 16px;background:${BRAND.grayBg};border-radius:4px;font-size:0.85rem;">
        <strong>Emergency Contact:</strong>
        ${data.emergencyContact.name ? data.emergencyContact.name + ' · ' : ''}${data.emergencyContact.phone || ''}${data.emergencyContact.email ? ' · ' + data.emergencyContact.email : ''}
      </div>`;
  }

  const body = `
    <div style="text-align:center;margin-bottom:4px;font-size:0.85rem;color:${BRAND.grayText};">${data.voucherNumber}</div>
    <table>
      ${row('Guest', data.customerName)}
      ${row('Destination', data.destination)}
      ${row('Travel Dates', `${data.travelStart} — ${data.travelEnd}`)}
      ${row('Guests', paxStr)}
    </table>
    ${sections}
    ${itineraryHtml}
    ${emergencyHtml}
  `;

  return baseLayout('Booking Confirmed', logoDataUri, orgName, body, status);
}
