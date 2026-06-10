-- Add supplier_id column to booking_items
ALTER TABLE booking_items ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_booking_items_supplier_id ON booking_items(supplier_id);
