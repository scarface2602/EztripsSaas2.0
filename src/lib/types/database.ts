// Full TypeScript types for all tables

export interface Organisation {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  terms_and_conditions: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'agent' | 'manager' | 'super_admin';
  agency_name: string | null;
  logo_url: string | null;
  whatsapp_number: string | null;
  default_currency: string;
  default_payment_terms: PaymentTerms | null;
  margin_threshold_pct: number;
  rounding_unit: number;
  org_id: string | null;
  tc_content: string | null;
  max_active_leads: number;
  tc_version: number;
  created_at: string;
}

export interface PaymentTerms {
  deposit_pct: number;
  balance_days_before: number;
  notes?: string;
}

export interface Client {
  id: string;
  created_by: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  nationality: string | null;
  notes: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  created_by: string | null;
  name: string;
  type: 'DMC' | 'hotel' | 'airline' | 'car' | 'activity' | 'other' | null;
  country: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  payment_terms_days: number | null;
  notes: string | null;
  created_at: string;
}

export interface SupplierSurcharge {
  id: string;
  supplier_id: string;
  label: string;
  start_date: string;
  end_date: string;
  surcharge_type: 'per_night' | 'flat' | 'percent';
  amount: number;
  currency: string;
  created_at: string;
}

export interface Proposal {
  id: string;
  created_by: string | null;
  client_id: string | null;
  parent_proposal_id: string | null;
  version: number;
  status: 'draft' | 'sent' | 'viewed' | 'confirmed' | 'cancelled';
  pricing_mode: 'standard' | 'tiered';
  quote_type: 'package' | 'itemised';

  // Package pricing (only when quote_type = 'package')
  package_cp_per_person: number | null;
  package_sp_per_person: number | null;
  package_cwb_sp: number | null;
  package_cnb_sp: number | null;

  title: string | null;
  destination: string | null;
  travel_start: string | null;
  travel_end: string | null;
  pax_adults: number;
  pax_children: number;
  children_ages: number[] | null;
  currency: string;
  special_notes: string | null;
  dietary_notes: string | null;

  gst_enabled: boolean;
  gst_rate: number;
  tcs_enabled: boolean;
  tcs_rate: number;
  rounding_unit: number | null;
  discount_amount: number;
  discount_note: string | null;

  cover_image_url: string | null;
  cover_image_source: 'curated' | 'ai_suggested' | 'approved' | null;
  cover_image_approved_at: string | null;
  cover_image_approved_by: string | null;

  share_token: string | null;
  published_data: Record<string, unknown> | null;
  draft_data: Record<string, unknown> | null;
  draft_differs_from_published: boolean;

  payment_terms: PaymentTerms | null;
  tc_version: number | null;

  visa_check_source: string;
  visa_section_enabled: boolean;

  flight_expires_at: string | null;
  land_expires_at: string | null;

  last_viewed_at: string | null;
  view_count: number;
  confirmed_at: string | null;
  confirmed_by: string | null;

  trip_cities: TripCity[] | null;

  // Pricing restructure fields
  land_cp: number | null;
  land_sp: number | null;
  pricing_display_mode: 'per_person' | 'total' | 'both';
  total_sp: number | null;

  created_at: string;
  updated_at: string;
}

export interface TripCity {
  city: string;
  nights: number;
  check_in: string;
  check_out: string;
}

export interface ProposalVersion {
  id: string;
  proposal_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  published_at: string;
  published_by: string | null;
}

export interface ProposalTier {
  id: string;
  proposal_id: string;
  label: string;
  pax_count: number;
  sort_order: number;
}

export interface Hotel {
  id: string;
  proposal_id: string;
  tier_id: string | null;
  supplier_id: string | null;
  name: string;
  city: string;
  check_in: string;
  check_out: string;
  nights: number;
  room_type: string | null;
  meal_plan: 'RO' | 'BB' | 'HB' | 'FB' | 'AI' | null;
  star_rating: number | null;
  room_view: string | null;
  is_non_refundable: boolean;
  hotel_cancellation_slabs: CancellationSlab[] | null;

  cp_per_night: number | null;
  sp_per_night: number | null;
  cwb_cp: number | null;
  cwb_sp: number | null;
  cnb_cp: number | null;
  cnb_sp: number | null;

  description: string | null;
  description_approved: boolean;

  early_checkin_requested: boolean;
  late_checkout_requested: boolean;

  sort_order: number;
  created_at: string;
}

export interface CancellationSlab {
  days_before: number;
  charge_pct: number;
}

export interface FlightLayover {
  city: string;
  airport_code: string;
  duration_hours: number;
  duration_minutes: number;
}

export interface Flight {
  id: string;
  proposal_id: string;
  tier_id: string | null;
  supplier_id: string | null;

  flight_number: string;
  airline: string | null;
  origin_iata: string | null;
  origin_city: string | null;
  destination_iata: string | null;
  destination_city: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  aircraft_type: string | null;

  cabin_class: string | null;
  baggage_allowance: string | null;
  is_non_refundable: boolean;
  refundable_status: 'refundable' | 'non_refundable' | 'partially_refundable';
  cancellation_policy_text: string | null;

  layovers: FlightLayover[] | null;

  cp_total: number | null;
  sp_total: number | null;

  fare_expires_at: string | null;

  sort_order: number;
  created_at: string;
}

export type DayType = 'arrival' | 'tour' | 'transfer' | 'departure' | 'flight';

export interface ItineraryDay {
  id: string;
  proposal_id: string;
  day_number: number;
  date: string;
  city: string | null;
  heading: string | null;
  description: string | null;
  raw_description: string | null;
  overnight_city: string | null;
  day_type: DayType | null;
  created_at: string;
}

export interface ItineraryActivity {
  id: string;
  itinerary_day_id: string;
  proposal_id: string;
  tier_id: string | null;
  supplier_id: string | null;

  type: 'transfer' | 'sightseeing' | 'meal' | 'activity' | 'free_time' | 'other';

  option_mode: 'pvt_only' | 'sic_only' | 'tbd' | 'dual' | null;
  client_choice: 'pvt' | 'sic' | null;
  confirmed_cp: number | null;
  confirmed_sp: number | null;
  confirmed_basis: 'per_vehicle' | 'per_person' | null;

  pvt_cp: number | null;
  pvt_sp: number | null;
  pvt_basis: 'per_vehicle' | 'per_person' | null;
  pvt_vehicle_type: string | null;

  sic_cp: number | null;
  sic_sp: number | null;
  sic_basis: 'per_vehicle' | 'per_person' | null;

  start_time: string | null;
  end_time: string | null;
  location: string | null;

  details: TransferDetails | SightseeingDetails | MealDetails | ActivityDetails | null;

  is_optional: boolean;
  show_in_pdf: boolean;
  conflict_flagged: boolean;
  conflict_acknowledged: boolean;
  conflict_note: string | null;

  sort_order: number;
  created_at: string;
}

export interface TransferDetails {
  from_location: string;
  to_location: string;
  notes?: string;
}

export interface SightseeingDetails {
  title: string;
  sites: string[];
  duration_hours: number;
  guide_included: boolean;
  notes?: string;
}

export interface MealDetails {
  venue: string;
  meal_type: string;
}

export interface ActivityDetails {
  name: string;
  notes?: string;
}

export interface LineItem {
  id: string;
  proposal_id: string;
  tier_id: string | null;
  supplier_id: string | null;
  type: 'transfer' | 'activity' | 'visa' | 'surcharge' | 'other' | 'ancillary';
  description: string;
  date: string | null;
  cp: number;
  sp: number;
  pricing_basis: 'per_vehicle' | 'per_person' | 'flat' | null;
  is_optional: boolean;
  is_included: boolean;
  show_in_pdf: boolean;
  per_person: boolean;
  include_in_total: boolean;
  is_addon: boolean;
  sort_order: number;
}

export interface ProposalContentBlock {
  id: string;
  proposal_id: string;
  type: 'packing_list' | 'weather' | 'why_book_us' | 'destination_highlights' | 'insurance_upsell' | 'lounge_upsell' | 'custom';
  content: Record<string, unknown>;
  is_included: boolean;
  created_by: 'ai' | 'agent';
  sort_order: number;
}

export interface VisaComplianceRule {
  id: string;
  destination_country: string;
  nationality: string;
  visa_required: boolean;
  visa_type: string | null;
  passport_validity_months: number | null;
  transit_visa_note: string | null;
  notes: string | null;
  updated_at: string;
}

export interface TravelTimeCache {
  id: string;
  city_a: string;
  city_b: string;
  country: string | null;
  estimated_minutes: number;
  cached_at: string;
}

export interface Receivable {
  id: string;
  proposal_id: string;
  client_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  paid_at: string | null;
  payment_method: string | null;
  razorpay_payment_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Payable {
  id: string;
  proposal_id: string;
  supplier_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  paid_at: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface ClientLedgerEntry {
  id: string;
  client_id: string | null;
  proposal_id: string | null;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ForexLock {
  id: string;
  proposal_id: string;
  from_currency: string;
  to_currency: string;
  locked_rate: number;
  locked_at: string;
  last_checked_at: string | null;
  current_rate: number | null;
  drift_pct: number | null;
  alert_fired: boolean;
}

export interface RawQuote {
  id: string;
  proposal_id: string | null;
  supplier_id: string | null;
  source_type: 'pdf' | 'excel' | 'text';
  file_url: string | null;
  raw_text: string | null;
  parsed_json: Record<string, unknown> | null;
  sanitisation_flags: string[] | null;
  created_at: string;
}

export interface ProposalAcceptanceLog {
  id: string;
  proposal_id: string;
  version: number;
  event_type: 'viewed' | 'tc_accepted' | 'visa_acknowledged' | 'confirmed' | 'addon_selected' | 'tier_selected';
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ProposalComment {
  id: string;
  proposal_id: string;
  user_id: string | null;
  message: string;
  mentions: string[] | null;
  created_at: string;
}

// Parsed quote structure from GPT-4o
export interface ParsedQuote {
  supplier_name: string;
  destination: string;
  travel_start: string | null;
  travel_end: string | null;
  currency: string;
  pax_adults: number | null;
  pax_children: number | null;
  hotels: ParsedHotel[];
  flights: ParsedFlight[];
  inclusions: string[];
  exclusions: string[];
  activities: ParsedActivity[];
  itinerary_days: ParsedItineraryDay[];
  payment_terms: string | null;
  validity: string | null;
}

export interface ParsedHotel {
  name: string;
  city: string;
  check_in: string | null;
  check_out: string | null;
  room_type: string | null;
  meal_plan: 'RO' | 'BB' | 'HB' | 'FB' | 'AI' | null;
  cp_per_night: number | null;
  description: string | null;
}

export interface ParsedFlight {
  flight_number: string;
  cp_total: number | null;
}

export interface ParsedItineraryDay {
  day_number: number;
  heading: string | null;
  description: string;
  city?: string | null;
  date?: string | null;
  activities: { type: string; description: string }[];
}

export interface ParsedActivity {
  day: number | null;
  description: string;
  type: 'transfer' | 'sightseeing' | 'activity' | 'other';
}

export interface Voucher {
  id: string;
  booking_id: string;
  supplier_type: 'hotel' | 'flight' | 'activity' | 'transfer';
  supplier_name: string | null;
  booking_reference: string | null;
  content: VoucherContent;
  pdf_url: string | null;
  issued_at: string;
  email_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoucherContent {
  // Common fields
  customerName?: string;
  confirmationNumber?: string;
  checkIn?: string;
  checkOut?: string;
  // Hotel-specific
  hotelName?: string;
  roomType?: string;
  mealPlan?: string;
  nights?: number;
  guests?: string;
  specialRequests?: string;
  // Flight-specific
  airline?: string;
  flightNumber?: string;
  origin?: string;
  destination?: string;
  departureTime?: string;
  arrivalTime?: string;
  pnr?: string;
  cabinClass?: string;
  // Activity/transfer-specific
  activityName?: string;
  date?: string;
  time?: string;
  pickupLocation?: string;
  dropLocation?: string;
  vehicleType?: string;
  notes?: string;
}

// ============================================================
// Payment Accounts & Schedules (Phase 1)
// ============================================================

export interface PaymentAccount {
  id: string;
  user_id: string;
  account_name: string;
  account_number: string | null;
  account_type: 'bank' | 'payment_gateway' | 'wallet' | 'upi';
  bank_name: string | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentSchedulePayment {
  sequence: number;
  amount: number;
  due_date: string; // ISO date
  reference_number?: string;
  paid_from_account_id?: string;
}

export interface PaymentSchedule {
  id: string;
  user_id: string;
  name: string;
  is_template: boolean;
  payments: PaymentSchedulePayment[];
  created_at: string;
  updated_at: string;
}

// ============================================================
// Booking Packages (Phase 1)
// ============================================================

export interface BookingPackage {
  id: string;
  booking_id: string;
  type: 'full_dmc' | 'partial_dmc' | 'mixed' | 'individual';
  supplier_id: string | null;
  booking_items_ids: string[];
  total_cost: number;
  payment_schedule_id: string | null;
  status: 'pending' | 'confirmed' | 'partial_paid' | 'paid' | 'cancelled';
  generated_payable_ids: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingPackagePayment {
  id: string;
  package_id: string;
  sequence: number;
  amount: number;
  due_date: string; // ISO date
  reference_number: string | null;
  paid_from_account_id: string | null;
  received_in_account_id: string | null;
  paid_from_account_snapshot: string | null;
  received_in_account_snapshot: string | null;
  status: 'pending' | 'due' | 'partial_paid' | 'paid' | 'overdue';
  amount_paid: number;
  paid_date: string | null; // ISO date
  notes: string | null;
  created_at: string;
  updated_at: string;
}
