-- Phase 4: Enquiry-to-Supplier requests tracking

CREATE TABLE IF NOT EXISTS enquiry_supplier_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES website_enquiries(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES users(id),
  email_to text NOT NULL,
  email_subject text NOT NULL,
  email_body text NOT NULL,
  response_status text DEFAULT 'pending'
    CHECK (response_status IN ('pending','responded','declined','no_response')),
  response_notes text,
  sent_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esr_enquiry ON enquiry_supplier_requests(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_esr_supplier ON enquiry_supplier_requests(supplier_id);
