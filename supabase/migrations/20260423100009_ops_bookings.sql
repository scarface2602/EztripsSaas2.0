-- ============================================================
-- Operations Module: Bookings & Components
-- ============================================================

-- 1. Bookings (master record — created from confirmed proposal)
create table bookings (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references proposals(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  created_by uuid references users(id) on delete set null,

  -- Trip info (copied from proposal at creation)
  title text not null,
  destination text,
  travel_start date,
  travel_end date,
  pax_adults integer default 1,
  pax_children integer default 0,
  children_ages integer[],
  pax_names jsonb,  -- [{name, age, type: 'adult'|'child'}]

  status text not null default 'confirmed'
    check (status in ('confirmed','in_progress','completed','cancelled')),

  total_sell_price numeric(12,2) default 0,
  total_cost_price numeric(12,2) default 0,
  currency text default 'INR',

  assigned_to uuid references users(id),
  internal_notes text,
  special_requests text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_proposal on bookings(proposal_id);
create index idx_bookings_client on bookings(client_id);
create index idx_bookings_status on bookings(status);
create index idx_bookings_travel_start on bookings(travel_start);
create index idx_bookings_created_by on bookings(created_by);

-- Auto-update updated_at
create trigger set_bookings_updated_at
  before update on bookings
  for each row execute function update_updated_at();

-- 2. Booking Hotels
create table booking_hotels (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,

  hotel_name text not null,
  city text not null,
  check_in date not null,
  check_out date not null,
  nights integer generated always as (check_out - check_in) stored,

  room_type text,
  room_count integer default 1,
  meal_plan text check (meal_plan in ('EP','CP','MAP','AP','AI')),
  star_rating integer,
  bed_type text,
  room_view text,

  -- Booking details
  confirmation_number text,
  booked_via text,  -- 'direct', 'mmt_mypartner', 'tripjack', 'tbo', 'stuba', 'rezlive', 'other'
  booking_reference text,  -- portal booking ref

  status text not null default 'pending'
    check (status in ('pending','requested','confirmed','cancelled','no_show')),

  cost_price numeric(12,2) default 0,
  sell_price numeric(12,2) default 0,
  currency text default 'INR',

  special_requests text,
  cancellation_policy text,
  notes text,

  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_booking_hotels_booking on booking_hotels(booking_id);
create index idx_booking_hotels_supplier on booking_hotels(supplier_id);
create index idx_booking_hotels_status on booking_hotels(status);

create trigger set_booking_hotels_updated_at
  before update on booking_hotels
  for each row execute function update_updated_at();

-- 3. Booking Transport (cabs, transfers)
create table booking_transport (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,

  type text not null check (type in ('airport_pickup','airport_drop','intercity','sightseeing','full_day','half_day','self_drive','other')),

  from_location text,
  to_location text,
  date date not null,
  pickup_time time,

  vehicle_type text,  -- 'Innova', 'Sedan', 'Tempo Traveller', etc.
  driver_name text,
  driver_phone text,

  confirmation_number text,
  booked_via text,

  status text not null default 'pending'
    check (status in ('pending','requested','confirmed','cancelled')),

  cost_price numeric(12,2) default 0,
  sell_price numeric(12,2) default 0,
  currency text default 'INR',

  notes text,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_booking_transport_booking on booking_transport(booking_id);
create index idx_booking_transport_status on booking_transport(status);

create trigger set_booking_transport_updated_at
  before update on booking_transport
  for each row execute function update_updated_at();

-- 4. Booking Flights
create table booking_flights (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,

  airline text,
  flight_number text,
  pnr text,

  origin_city text,
  origin_iata text,
  destination_city text,
  destination_iata text,

  departure_at timestamptz,
  arrival_at timestamptz,

  cabin_class text,
  baggage_allowance text,
  ticket_numbers text,  -- comma-separated or JSON

  booked_via text,
  booking_reference text,

  status text not null default 'pending'
    check (status in ('pending','requested','ticketed','cancelled','rescheduled')),

  cost_price numeric(12,2) default 0,
  sell_price numeric(12,2) default 0,
  currency text default 'INR',

  notes text,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_booking_flights_booking on booking_flights(booking_id);
create index idx_booking_flights_status on booking_flights(status);

create trigger set_booking_flights_updated_at
  before update on booking_flights
  for each row execute function update_updated_at();

-- 5. Booking Activities (tours, entry tickets, experiences)
create table booking_activities (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,

  activity_name text not null,
  date date,
  time time,
  location text,
  duration text,  -- '2 hours', 'Half day'

  pax_count integer,
  voucher_number text,
  confirmation_number text,
  booked_via text,

  status text not null default 'pending'
    check (status in ('pending','requested','confirmed','cancelled')),

  cost_price numeric(12,2) default 0,
  sell_price numeric(12,2) default 0,
  currency text default 'INR',

  notes text,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_booking_activities_booking on booking_activities(booking_id);

create trigger set_booking_activities_updated_at
  before update on booking_activities
  for each row execute function update_updated_at();

-- 6. Booking Payments (unified for all components)
create table booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,

  -- Polymorphic link to component
  component_type text check (component_type in ('hotel','transport','flight','activity','general')),
  component_id uuid,  -- references the specific component

  direction text not null check (direction in ('payable','receivable')),
  -- payable = we pay supplier, receivable = client pays us

  supplier_id uuid references suppliers(id) on delete set null,
  client_id uuid references clients(id) on delete set null,

  amount numeric(12,2) not null,
  currency text default 'INR',
  due_date date,
  paid_date date,
  payment_mode text,  -- 'bank_transfer', 'upi', 'card', 'cash', 'portal_wallet'
  reference_number text,

  status text not null default 'pending'
    check (status in ('pending','partial','paid','overdue','cancelled')),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_booking_payments_booking on booking_payments(booking_id);
create index idx_booking_payments_direction on booking_payments(direction);
create index idx_booking_payments_status on booking_payments(status);
create index idx_booking_payments_due_date on booking_payments(due_date);
create index idx_booking_payments_supplier on booking_payments(supplier_id);

create trigger set_booking_payments_updated_at
  before update on booking_payments
  for each row execute function update_updated_at();

-- 7. Booking Activity Log (audit trail — append only)
create table booking_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  user_id uuid references users(id),
  action text not null,  -- 'created', 'hotel_added', 'status_changed', 'payment_recorded', etc.
  details jsonb,  -- {component_type, component_id, old_status, new_status, ...}
  created_at timestamptz not null default now()
);

create index idx_booking_logs_booking on booking_logs(booking_id);
create index idx_booking_logs_created_at on booking_logs(created_at desc);

-- Prevent edits/deletes on logs
create or replace function prevent_booking_log_mutation() returns trigger as $$
begin
  raise exception 'booking_logs is append-only';
end;
$$ language plpgsql;

create trigger booking_logs_no_update
  before update on booking_logs for each row execute function prevent_booking_log_mutation();
create trigger booking_logs_no_delete
  before delete on booking_logs for each row execute function prevent_booking_log_mutation();

-- 8. Supplier Emails (track communications)
create table booking_emails (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,

  component_type text check (component_type in ('hotel','transport','flight','activity','general')),
  component_id uuid,

  supplier_id uuid references suppliers(id) on delete set null,
  to_email text,
  cc_email text,
  subject text not null,
  body text not null,
  template_type text,  -- 'hotel_booking', 'cab_booking', 'cancellation', 'modification', 'payment_reminder'

  direction text default 'outbound' check (direction in ('outbound','inbound')),
  status text default 'draft' check (status in ('draft','sent','failed')),
  sent_at timestamptz,
  sent_by uuid references users(id),

  created_at timestamptz not null default now()
);

create index idx_booking_emails_booking on booking_emails(booking_id);
