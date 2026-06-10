-- Booking Items: component-level tracking for flights, hotels, transfers, activities, meal plans
CREATE TABLE booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('flight_segment', 'hotel_room', 'transfer', 'activity', 'meal_plan')),
  label text NOT NULL,

  -- Dates
  start_date date,
  end_date date,

  -- Pricing
  cost_price numeric(12, 2),
  sell_price numeric(12, 2),

  -- Supplier Confirmation Status
  supplier_status text NOT NULL DEFAULT 'pending' CHECK (supplier_status IN ('pending', 'requested', 'confirmed', 'modified', 'cancelled', 'completed')),
  supplier_reference text,
  supplier_confirmed_at timestamptz,
  supplier_notes text,

  -- Flexible item details (JSON)
  details jsonb DEFAULT '{}',

  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_items_booking_id_idx ON booking_items(booking_id);
CREATE INDEX IF NOT EXISTS booking_items_supplier_status_idx ON booking_items(supplier_status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_booking_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_items_updated_at
  BEFORE UPDATE ON booking_items
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_items_updated_at();
