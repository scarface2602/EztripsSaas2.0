interface BookingContext {
  bookingTitle: string;
  clientName: string;
  destination: string;
  travelStart: string;
  travelEnd: string;
  paxAdults: number;
  paxChildren: number;
  agentName: string;
  agentPhone?: string;
  agentEmail?: string;
  orgName: string;
}

interface ItemContext {
  label: string;
  itemType: string;
  startDate: string;
  endDate: string;
  supplierReference?: string;
  vendorName?: string;
  details: Record<string, unknown>;
}

export function hotelConfirmationRequest(item: ItemContext, booking: BookingContext): { subject: string; body: string } {
  const d = item.details;
  return {
    subject: `Booking Request — ${d.hotel_name || item.label} | ${booking.clientName} | ${item.startDate} to ${item.endDate}`,
    body: `Dear ${item.vendorName || 'Team'},

We would like to request a booking with the following details:

Hotel: ${d.hotel_name || item.label}
Guest Name: ${booking.clientName}
Check-in: ${item.startDate}
Check-out: ${item.endDate}
Room Type: ${d.room_type || 'Standard'}
Meal Plan: ${d.meal_plan || 'As per agreement'}
Guests: ${booking.paxAdults} Adult(s)${booking.paxChildren > 0 ? `, ${booking.paxChildren} Child(ren)` : ''}

Please confirm availability and share the confirmation number at the earliest.

Regards,
${booking.agentName}
${booking.orgName}${booking.agentPhone ? `\n${booking.agentPhone}` : ''}`,
  };
}

export function vehicleBookingRequest(item: ItemContext, booking: BookingContext): { subject: string; body: string } {
  const d = item.details;
  return {
    subject: `Vehicle Booking Request — ${booking.clientName} | ${item.startDate} to ${item.endDate}`,
    body: `Dear ${item.vendorName || 'Team'},

We would like to book a vehicle with the following details:

Vehicle Type: ${d.vehicle_type || 'As available'}
Pickup: ${d.pickup_location || ''} on ${item.startDate}
Drop: ${d.dropoff_location || ''} on ${item.endDate}
Guests: ${booking.paxAdults} Adult(s)${booking.paxChildren > 0 ? `, ${booking.paxChildren} Child(ren)` : ''}

Please confirm availability and driver details.

Regards,
${booking.agentName}
${booking.orgName}${booking.agentPhone ? `\n${booking.agentPhone}` : ''}`,
  };
}

export function flightBookingRequest(item: ItemContext, booking: BookingContext): { subject: string; body: string } {
  const d = item.details;
  return {
    subject: `Flight Booking — ${d.airline || ''} ${d.flight_number || ''} | ${booking.clientName}`,
    body: `Dear ${item.vendorName || 'Team'},

Please confirm the following flight booking:

Flight: ${d.airline || ''} ${d.flight_number || ''}
Route: ${d.origin_city || ''} → ${d.destination_city || ''}
Date: ${item.startDate}
Passengers: ${booking.paxAdults} Adult(s)${booking.paxChildren > 0 ? `, ${booking.paxChildren} Child(ren)` : ''}
Class: ${d.cabin_class || 'Economy'}

Please share the PNR / confirmation number.

Regards,
${booking.agentName}
${booking.orgName}`,
  };
}

export function paymentConfirmation(item: ItemContext, booking: BookingContext, paymentDetails?: { amount?: string; reference?: string; proofUrl?: string }): { subject: string; body: string } {
  return {
    subject: `Payment Confirmation — ${item.label} | ${booking.clientName}`,
    body: `Dear ${item.vendorName || 'Team'},

This is to confirm that payment has been made for the following booking:

Booking: ${item.label}
Guest: ${booking.clientName}
Dates: ${item.startDate} to ${item.endDate}
${item.supplierReference ? `Reference: ${item.supplierReference}` : ''}
${paymentDetails?.amount ? `Amount Paid: ₹${paymentDetails.amount}` : ''}
${paymentDetails?.reference ? `Payment Reference: ${paymentDetails.reference}` : ''}

${paymentDetails?.proofUrl ? 'Payment proof is attached.' : 'Please confirm receipt of payment.'}

Regards,
${booking.agentName}
${booking.orgName}`,
  };
}

export function cancellationNotice(item: ItemContext, booking: BookingContext, reason: string): { subject: string; body: string } {
  return {
    subject: `Cancellation — ${item.label} | ${booking.clientName}`,
    body: `Dear ${item.vendorName || 'Team'},

We regret to inform you that we need to cancel the following booking:

Booking: ${item.label}
Guest: ${booking.clientName}
Dates: ${item.startDate} to ${item.endDate}
${item.supplierReference ? `Reference: ${item.supplierReference}` : ''}

Reason: ${reason}

Please confirm the cancellation and share any applicable charges.

Regards,
${booking.agentName}
${booking.orgName}`,
  };
}

export type TemplateType = 'hotel_booking' | 'vehicle_booking' | 'flight_booking' | 'payment_confirmation' | 'cancellation';

export function getTemplate(
  templateType: TemplateType,
  item: ItemContext,
  booking: BookingContext,
  extra?: { reason?: string; paymentDetails?: { amount?: string; reference?: string; proofUrl?: string } }
): { subject: string; body: string } {
  switch (templateType) {
    case 'hotel_booking':
      return hotelConfirmationRequest(item, booking);
    case 'vehicle_booking':
      return vehicleBookingRequest(item, booking);
    case 'flight_booking':
      return flightBookingRequest(item, booking);
    case 'payment_confirmation':
      return paymentConfirmation(item, booking, extra?.paymentDetails);
    case 'cancellation':
      return cancellationNotice(item, booking, extra?.reason || 'Client request');
    default:
      return { subject: `Booking — ${item.label}`, body: '' };
  }
}
