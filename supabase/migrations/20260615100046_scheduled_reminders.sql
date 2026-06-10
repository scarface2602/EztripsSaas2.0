-- Scheduled reminders for automated notifications
CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  booking_item_id uuid REFERENCES booking_items(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('payment_due','supplier_followup','booking_confirmed')),
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_pending ON scheduled_reminders(status, send_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminders_booking ON scheduled_reminders(booking_id);

ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own reminders
CREATE POLICY "reminders_all" ON scheduled_reminders
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = scheduled_reminders.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = scheduled_reminders.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin()))
  );
