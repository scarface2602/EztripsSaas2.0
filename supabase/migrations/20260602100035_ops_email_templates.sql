-- Email templates for ops workflows (confirmation requests, payment reminders, etc.)
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  template_key text NOT NULL, -- confirmation_request, payment_reminder, booking_confirmed, follow_up, voucher_send
  subject_template text NOT NULL,
  body_template text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Seed default templates
INSERT INTO email_templates (template_key, subject_template, body_template, is_default) VALUES
(
  'confirmation_request',
  'Confirmation Request — {{item_label}} for {{client_name}} ({{travel_dates}})',
  'Dear {{vendor_name}},

Please confirm the following booking at the earliest:

Booking: {{booking_title}}
Service: {{item_label}} ({{item_type}})
Dates: {{travel_dates}}
Client: {{client_name}}
Pax: {{pax_count}}
Reference: {{supplier_reference}}

Please share the confirmation number once done.

Regards,
{{agent_name}}
{{agency_name}}',
  true
),
(
  'payment_reminder',
  'Payment Reminder — {{booking_title}} (₹{{amount_due}} due {{due_date}})',
  'Dear {{client_name}},

This is a friendly reminder that a payment of ₹{{amount_due}} for your booking "{{booking_title}}" is due on {{due_date}}.

Booking Details:
- Destination: {{destination}}
- Travel Dates: {{travel_dates}}
- Total Amount: ₹{{total_amount}}
- Paid So Far: ₹{{amount_paid}}
- Outstanding: ₹{{amount_due}}

You can make the payment using the link below:
{{payment_link}}

If you have already made the payment, please ignore this reminder.

Regards,
{{agent_name}}
{{agency_name}}',
  true
),
(
  'booking_confirmed',
  'Booking Confirmed — {{booking_title}}',
  'Dear {{client_name}},

Great news! Your booking has been confirmed.

Booking: {{booking_title}}
Destination: {{destination}}
Travel Dates: {{travel_dates}}
Pax: {{pax_count}}

Confirmed Items:
{{confirmed_items_list}}

We will share your vouchers shortly.

Regards,
{{agent_name}}
{{agency_name}}',
  true
),
(
  'follow_up',
  'Follow Up — {{item_label}} for {{client_name}} ({{travel_dates}})',
  'Dear {{vendor_name}},

This is a follow-up regarding our earlier request for confirmation:

Booking: {{booking_title}}
Service: {{item_label}} ({{item_type}})
Dates: {{travel_dates}}
Client: {{client_name}}

This is follow-up #{{followup_count}}. Kindly expedite the confirmation.

Regards,
{{agent_name}}
{{agency_name}}',
  true
);
