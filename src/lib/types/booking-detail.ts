// View types for the booking detail page — shapes returned by
// /api/bookings/[id]/details, /vouchers and the Supabase joins in booking-context.

import type { BookingPackage, BookingPackagePayment } from './database';

export interface PackageWithPayments extends BookingPackage {
  payments: BookingPackagePayment[];
  supplier?: { name: string } | null;
}

export interface BookingLogEntry {
  id: string;
  booking_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  users?: { full_name: string } | null;
}

export interface BookingEmailRecord {
  id: string;
  booking_id: string;
  supplier_id: string | null;
  direction: 'outbound' | 'inbound';
  to_email: string | null;
  cc_email: string | null;
  subject: string;
  body: string;
  template_type: string | null;
  status: 'draft' | 'sent' | 'failed';
  sent_at: string | null;
  sent_by: string | null;
  created_at: string;
  suppliers?: { name: string } | null;
}

export interface BookingVoucherRecord {
  id: string;
  booking_id?: string;
  supplier_type: string | null;
  supplier_name?: string | null;
  booking_reference?: string | null;
  status?: string;
  pdf_url: string | null;
  email_sent_at?: string | null;
  created_at: string;
  content?: Record<string, unknown> | null;
}

export interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  email: string;
}

export interface EnquiryRecord {
  id: string;
  query_id: string | null;
  trip_id: string | null;
  requirement_type: string | null;
  requirement_details: Record<string, unknown> | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  destination: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string;
  [key: string]: unknown;
}
