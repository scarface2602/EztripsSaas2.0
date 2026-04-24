export type TemplateType =
  | 'hotel_booking'
  | 'hotel_amendment'
  | 'hotel_cancellation'
  | 'cab_booking'
  | 'cab_cancellation'
  | 'flight_booking'
  | 'activity_booking'
  | 'payment_reminder';

export interface TemplateData {
  // Agency
  agency_name: string;
  agent_name: string;
  agent_email: string;
  agent_phone: string;

  // Booking
  booking_title: string;
  booking_ref?: string;

  // Guest
  guest_names: string;
  pax_adults: number;
  pax_children: number;
  special_requests?: string;

  // Hotel
  hotel_name?: string;
  city?: string;
  check_in?: string;
  check_out?: string;
  nights?: number;
  room_type?: string;
  room_count?: number;
  meal_plan?: string;
  confirmation_number?: string;

  // Transport
  transport_type?: string;
  from_location?: string;
  to_location?: string;
  pickup_date?: string;
  pickup_time?: string;
  vehicle_type?: string;

  // Flight
  airline?: string;
  flight_number?: string;
  origin?: string;
  destination?: string;
  departure?: string;
  pnr?: string;

  // Activity
  activity_name?: string;
  activity_date?: string;
  activity_time?: string;
  activity_location?: string;

  // Payment
  amount?: string;
  currency?: string;
  due_date?: string;
  payment_reference?: string;

  // Supplier
  supplier_name?: string;
}

function fill(template: string, data: TemplateData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return (data as unknown as Record<string, string | number | undefined>)[key]?.toString() || '';
  });
}

const TEMPLATES: Record<TemplateType, { subject: string; body: string }> = {
  hotel_booking: {
    subject: 'Hotel Booking Request — {{hotel_name}}, {{city}} | {{check_in}} to {{check_out}}',
    body: `Dear {{supplier_name}},

Greetings from {{agency_name}}.

We would like to request the following hotel reservation:

Hotel: {{hotel_name}}, {{city}}
Check-in: {{check_in}}
Check-out: {{check_out}}
Nights: {{nights}}
Room Type: {{room_type}}
No. of Rooms: {{room_count}}
Meal Plan: {{meal_plan}}

Guest Details:
{{guest_names}}
Adults: {{pax_adults}} | Children: {{pax_children}}
{{special_requests}}

Booking Reference: {{booking_ref}}

Please confirm availability and share the confirmation at your earliest.

Best regards,
{{agent_name}}
{{agency_name}}
{{agent_email}} | {{agent_phone}}`,
  },

  hotel_amendment: {
    subject: 'Amendment Request — {{hotel_name}} | Confirmation #{{confirmation_number}}',
    body: `Dear {{supplier_name}},

This is regarding our existing booking at {{hotel_name}}, {{city}}.
Confirmation Number: {{confirmation_number}}

We would like to request the following amendment:

[Please specify the changes needed]

Original Details:
Check-in: {{check_in}}
Check-out: {{check_out}}
Room Type: {{room_type}}
Meal Plan: {{meal_plan}}

Guest: {{guest_names}}
Booking Reference: {{booking_ref}}

Please confirm the amendment and any rate difference at the earliest.

Best regards,
{{agent_name}}
{{agency_name}}
{{agent_email}} | {{agent_phone}}`,
  },

  hotel_cancellation: {
    subject: 'Cancellation Request — {{hotel_name}} | Confirmation #{{confirmation_number}}',
    body: `Dear {{supplier_name}},

We regret to inform you that we need to cancel the following reservation:

Hotel: {{hotel_name}}, {{city}}
Confirmation Number: {{confirmation_number}}
Check-in: {{check_in}}
Check-out: {{check_out}}
Guest: {{guest_names}}

Booking Reference: {{booking_ref}}

Please confirm the cancellation and share any applicable cancellation charges.

Best regards,
{{agent_name}}
{{agency_name}}
{{agent_email}} | {{agent_phone}}`,
  },

  cab_booking: {
    subject: 'Transport Booking — {{transport_type}} | {{from_location}} to {{to_location}} | {{pickup_date}}',
    body: `Dear {{supplier_name}},

Greetings from {{agency_name}}.

We would like to book the following transport:

Type: {{transport_type}}
From: {{from_location}}
To: {{to_location}}
Date: {{pickup_date}}
Pickup Time: {{pickup_time}}
Vehicle: {{vehicle_type}}

Guest Details:
{{guest_names}}
Adults: {{pax_adults}} | Children: {{pax_children}}
{{special_requests}}

Booking Reference: {{booking_ref}}

Please confirm and share driver details before the pickup date.

Best regards,
{{agent_name}}
{{agency_name}}
{{agent_email}} | {{agent_phone}}`,
  },

  cab_cancellation: {
    subject: 'Transport Cancellation — {{transport_type}} | {{pickup_date}}',
    body: `Dear {{supplier_name}},

We need to cancel the following transport booking:

Type: {{transport_type}}
From: {{from_location}}
To: {{to_location}}
Date: {{pickup_date}}
Guest: {{guest_names}}

Booking Reference: {{booking_ref}}

Please confirm the cancellation.

Best regards,
{{agent_name}}
{{agency_name}}
{{agent_email}} | {{agent_phone}}`,
  },

  flight_booking: {
    subject: 'Flight Booking Request — {{airline}} {{flight_number}} | {{origin}} to {{destination}}',
    body: `Dear {{supplier_name}},

Greetings from {{agency_name}}.

Please book/hold the following flight:

Airline: {{airline}}
Flight: {{flight_number}}
Route: {{origin}} → {{destination}}
Departure: {{departure}}

Passenger Details:
{{guest_names}}

Booking Reference: {{booking_ref}}

Please confirm ticketing and share PNR/e-tickets.

Best regards,
{{agent_name}}
{{agency_name}}
{{agent_email}} | {{agent_phone}}`,
  },

  activity_booking: {
    subject: 'Activity Booking — {{activity_name}} | {{activity_date}}',
    body: `Dear {{supplier_name}},

Greetings from {{agency_name}}.

We would like to book the following activity:

Activity: {{activity_name}}
Date: {{activity_date}}
Time: {{activity_time}}
Location: {{activity_location}}

Guest Details:
{{guest_names}}
Adults: {{pax_adults}} | Children: {{pax_children}}
{{special_requests}}

Booking Reference: {{booking_ref}}

Please confirm and share voucher/tickets.

Best regards,
{{agent_name}}
{{agency_name}}
{{agent_email}} | {{agent_phone}}`,
  },

  payment_reminder: {
    subject: 'Payment Reminder — {{amount}} {{currency}} | Due {{due_date}}',
    body: `Dear {{supplier_name}},

This is a gentle reminder regarding the pending payment:

Amount: {{amount}} {{currency}}
Due Date: {{due_date}}
Reference: {{payment_reference}}

Booking: {{booking_title}}
Booking Reference: {{booking_ref}}

Please process the payment at your earliest convenience. If already paid, kindly disregard this message and share the payment confirmation.

Best regards,
{{agent_name}}
{{agency_name}}
{{agent_email}} | {{agent_phone}}`,
  },
};

export function generateEmail(
  templateType: TemplateType,
  data: TemplateData,
): { subject: string; body: string } {
  const template = TEMPLATES[templateType];
  return {
    subject: fill(template.subject, data),
    body: fill(template.body, data),
  };
}

export function getTemplateTypes(): { value: TemplateType; label: string }[] {
  return [
    { value: 'hotel_booking', label: 'Hotel Booking Request' },
    { value: 'hotel_amendment', label: 'Hotel Amendment' },
    { value: 'hotel_cancellation', label: 'Hotel Cancellation' },
    { value: 'cab_booking', label: 'Transport Booking' },
    { value: 'cab_cancellation', label: 'Transport Cancellation' },
    { value: 'flight_booking', label: 'Flight Booking' },
    { value: 'activity_booking', label: 'Activity Booking' },
    { value: 'payment_reminder', label: 'Payment Reminder' },
  ];
}
