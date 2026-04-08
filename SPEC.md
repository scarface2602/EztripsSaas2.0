# TravelProposal OS — Master Specification
> Version 1.0 — All decisions locked. Do not modify without explicit sign-off.
> This file is the single source of truth for Claude Code sessions.

---

## How to use this file with Claude Code

Start every Claude Code session with:
```
Read SPEC.md fully before writing any code.
```

Then give a specific instruction:
```
Build the Supabase schema from SPEC.md — all tables, columns, types, foreign keys, RLS policies and indexes.
```
```
Scaffold the Next.js project structure from SPEC.md.
```
```
Build the quote import and AI parsing API route from SPEC.md.
```

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | |
| Auth + DB + Storage | Supabase | RLS enforces agent data isolation |
| AI | OpenAI GPT-4o | Parsing, writing, conflict detection, content blocks |
| PDF | Puppeteer | Server-side HTML → PDF render |
| Flights API | AviationStack | Flight no. → airline, route, times, aircraft |
| Images | Unsplash API | AI-suggested hero images |
| Forex | OpenExchangeRates API | Lock rate on proposal creation |
| Payments | Razorpay | Deposit + full payment. Pay later offline also supported. |
| Hosting | Vercel | |
| Travel time | GPT-4o estimate | Cached in travel_time_cache table |
| Visa compliance | Static checklist Phase 1 | visa_check_source field ready for API in Phase 2 |

---

## 2. Users & Roles

### Roles
- `super_admin` — View + edit ALL proposals across all agents. Full access: client directory, supplier DB, payables dashboard, financial summary, all user management, all dashboards.
- `agent` — Creates and manages own proposals and clients. Cannot see other agents' CPs, margins, or proposals. Supabase RLS enforces this at the database level.

### Auth
- Email + password via Supabase Auth.
- Invite-only team — super admin adds users.
- RLS on every table: agents see only their own rows. Super admin bypasses RLS via service role where needed.

---

## 3. Database Schema

### CRITICAL RULES
- All monetary values stored as `numeric(12,2)`.
- All CP (cost price) fields are NEVER exposed to client-facing APIs or PDFs.
- Append-only tables: `client_ledger`, `proposal_comments`, `proposal_acceptance_log` — no UPDATE or DELETE ever.
- `published_data` and `draft_data` on proposals are separate jsonb columns. Share link reads `published_data` only.

### Tables

#### users
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
email text UNIQUE NOT NULL
full_name text NOT NULL
role text NOT NULL CHECK (role IN ('agent', 'super_admin'))
agency_name text
logo_url text
whatsapp_number text
default_currency text DEFAULT 'INR'
default_payment_terms jsonb -- {deposit_pct: 25, balance_days_before: 30}
margin_threshold_pct numeric DEFAULT 12
rounding_unit integer DEFAULT 0 -- 0=off, 100, 500, 1000
tc_content text -- Terms & Conditions body text
tc_version integer DEFAULT 1
created_at timestamptz DEFAULT now()
```

#### clients
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_by uuid REFERENCES users(id)
full_name text NOT NULL
phone text NOT NULL
email text
nationality text
notes text
created_at timestamptz DEFAULT now()
```

#### suppliers
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_by uuid REFERENCES users(id)
name text NOT NULL
type text CHECK (type IN ('DMC','hotel','airline','car','activity','other'))
country text
contact_name text
contact_email text
contact_phone text
payment_terms_days integer
notes text
created_at timestamptz DEFAULT now()
```

#### supplier_surcharges
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
supplier_id uuid REFERENCES suppliers(id)
label text NOT NULL -- e.g. "Christmas supplement"
start_date date NOT NULL
end_date date NOT NULL
surcharge_type text CHECK (surcharge_type IN ('per_night','flat','percent'))
amount numeric(12,2) NOT NULL
currency text DEFAULT 'INR'
created_at timestamptz DEFAULT now()
```

#### proposals
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_by uuid REFERENCES users(id)
client_id uuid REFERENCES clients(id)
parent_proposal_id uuid REFERENCES proposals(id) -- for versioning chain
version integer DEFAULT 1
status text CHECK (status IN ('draft','sent','viewed','confirmed','cancelled'))
pricing_mode text CHECK (pricing_mode IN ('standard','tiered')) DEFAULT 'standard'

-- Trip details
title text
destination text -- primary destination, comma-separated if multi
travel_start date
travel_end date
pax_adults integer DEFAULT 1
pax_children integer DEFAULT 0
children_ages integer[] -- array of ages
currency text DEFAULT 'INR'
special_notes text
dietary_notes text

-- Financial
gst_enabled boolean DEFAULT false
gst_rate numeric DEFAULT 5
tcs_enabled boolean DEFAULT false
rounding_unit integer -- overrides account setting for this proposal
discount_amount numeric(12,2) DEFAULT 0
discount_note text

-- Cover + image
cover_image_url text
cover_image_source text CHECK (cover_image_source IN ('curated','ai_suggested','approved'))
cover_image_approved_at timestamptz
cover_image_approved_by uuid REFERENCES users(id)

-- Sharing + versioning
share_token text UNIQUE -- current published share link token
published_data jsonb -- what client sees, never modified during editing
draft_data jsonb -- what agent edits, never served to client
draft_differs_from_published boolean DEFAULT false

-- Proposal-level terms
payment_terms jsonb -- {deposit_pct, balance_days_before, notes}
tc_version integer -- which version of T&C was on this proposal

-- Compliance
visa_check_source text DEFAULT 'static' -- 'static' or 'api' (Phase 2)
visa_section_enabled boolean DEFAULT false

-- TTL
flight_expires_at timestamptz
land_expires_at timestamptz

-- Tracking
last_viewed_at timestamptz
view_count integer DEFAULT 0
confirmed_at timestamptz
confirmed_by text -- 'client' or 'agent'

created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

#### proposal_versions
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
version integer NOT NULL
snapshot jsonb NOT NULL -- full proposal data at time of publishing
published_at timestamptz DEFAULT now()
published_by uuid REFERENCES users(id)
```

#### proposal_tiers
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
label text NOT NULL -- e.g. "4 Pax", "6 Pax"
pax_count integer NOT NULL
sort_order integer DEFAULT 0
```

#### hotels
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
tier_id uuid REFERENCES proposal_tiers(id) -- null if standard mode
supplier_id uuid REFERENCES suppliers(id)
name text NOT NULL
city text NOT NULL
check_in date NOT NULL
check_out date NOT NULL
nights integer GENERATED ALWAYS AS (check_out - check_in) STORED
room_type text
meal_plan text CHECK (meal_plan IN ('RO','BB','HB','FB','AI'))
star_rating integer
room_view text
is_non_refundable boolean DEFAULT false
hotel_cancellation_slabs jsonb -- [{days_before: 7, charge_pct: 100}] only if not NR

-- Pricing (CP never shown to client)
cp_per_night numeric(12,2)
sp_per_night numeric(12,2)
cwb_cp numeric(12,2) -- child with bed cost
cwb_sp numeric(12,2) -- child with bed sell
cnb_cp numeric(12,2) -- child no bed cost
cnb_sp numeric(12,2) -- child no bed sell

-- AI content
description text
description_approved boolean DEFAULT false

-- Flags
early_checkin_requested boolean DEFAULT false
late_checkout_requested boolean DEFAULT false

sort_order integer DEFAULT 0
created_at timestamptz DEFAULT now()
```

#### flights
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
tier_id uuid REFERENCES proposal_tiers(id)
supplier_id uuid REFERENCES suppliers(id)

-- From AviationStack API
flight_number text NOT NULL
airline text
origin_iata text
origin_city text
destination_iata text
destination_city text
departure_at timestamptz
arrival_at timestamptz
aircraft_type text

-- Manual
cabin_class text
baggage_allowance text
is_non_refundable boolean DEFAULT false

-- Pricing
cp_total numeric(12,2)
sp_total numeric(12,2)

-- TTL
fare_expires_at timestamptz

sort_order integer DEFAULT 0
created_at timestamptz DEFAULT now()
```

#### itinerary_days
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
day_number integer NOT NULL
date date NOT NULL
city text -- auto-synced from hotels based on date range
heading text -- AI generated
description text -- AI generated, agent edits
overnight_city text
created_at timestamptz DEFAULT now()
```

#### itinerary_activities
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
itinerary_day_id uuid REFERENCES itinerary_days(id)
proposal_id uuid REFERENCES proposals(id)
tier_id uuid REFERENCES proposal_tiers(id)
supplier_id uuid REFERENCES suppliers(id)

type text CHECK (type IN ('transfer','sightseeing','meal','activity','free_time','other'))

-- Pvt/SIC mode
option_mode text CHECK (option_mode IN ('pvt_only','sic_only','tbd','dual'))
client_choice text CHECK (client_choice IN ('pvt','sic')) -- set on confirmation
confirmed_cp numeric(12,2) -- resolved after client_choice
confirmed_sp numeric(12,2)
confirmed_basis text CHECK (confirmed_basis IN ('per_vehicle','per_person'))

-- Private option
pvt_cp numeric(12,2)
pvt_sp numeric(12,2)
pvt_basis text CHECK (pvt_basis IN ('per_vehicle','per_person'))
pvt_vehicle_type text

-- SIC option
sic_cp numeric(12,2)
sic_sp numeric(12,2)
sic_basis text CHECK (sic_basis IN ('per_vehicle','per_person'))

-- Timing (for conflict detection)
start_time time
end_time time
location text -- specific location name

-- Type-specific details
details jsonb
-- transfer: {from_location, to_location, notes}
-- sightseeing: {title, sites: [], duration_hours, guide_included, notes}
-- meal: {venue, meal_type}
-- activity: {name, notes}

-- Flags
is_optional boolean DEFAULT false -- "Enhance Your Trip" add-on
show_in_pdf boolean DEFAULT true
conflict_flagged boolean DEFAULT false
conflict_acknowledged boolean DEFAULT false
conflict_note text

sort_order integer DEFAULT 0
created_at timestamptz DEFAULT now()
```

#### line_items
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
tier_id uuid REFERENCES proposal_tiers(id)
supplier_id uuid REFERENCES suppliers(id)
type text CHECK (type IN ('transfer','activity','visa','surcharge','other'))
description text NOT NULL
date date
cp numeric(12,2) DEFAULT 0
sp numeric(12,2) DEFAULT 0
pricing_basis text CHECK (pricing_basis IN ('per_vehicle','per_person','flat'))
is_optional boolean DEFAULT false
is_included boolean DEFAULT true -- inclusion/exclusion list
show_in_pdf boolean DEFAULT true
sort_order integer DEFAULT 0
```

#### proposal_content_blocks
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
type text CHECK (type IN ('packing_list','weather','why_book_us','destination_highlights','insurance_upsell','lounge_upsell','custom'))
content jsonb NOT NULL
is_included boolean DEFAULT false -- agent toggles on
created_by text CHECK (created_by IN ('ai','agent'))
sort_order integer DEFAULT 0
```

#### visa_compliance_rules
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
destination_country text NOT NULL
nationality text NOT NULL
visa_required boolean DEFAULT false
visa_type text -- 'visa_on_arrival','e_visa','embassy','not_required'
passport_validity_months integer
transit_visa_note text
notes text
updated_at timestamptz DEFAULT now()
UNIQUE(destination_country, nationality)
```

#### travel_time_cache
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
city_a text NOT NULL
city_b text NOT NULL
country text
estimated_minutes integer NOT NULL
cached_at timestamptz DEFAULT now()
UNIQUE(city_a, city_b)
```

#### receivables
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
client_id uuid REFERENCES clients(id)
description text NOT NULL -- e.g. "25% deposit"
amount numeric(12,2) NOT NULL
due_date date NOT NULL
status text CHECK (status IN ('pending','paid','overdue')) DEFAULT 'pending'
paid_at timestamptz
payment_method text -- 'razorpay','bank_transfer','cash','cheque','other'
razorpay_payment_id text
notes text
created_at timestamptz DEFAULT now()
```

#### payables
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
supplier_id uuid REFERENCES suppliers(id)
description text NOT NULL -- e.g. "Hotel Atlantis deposit"
amount numeric(12,2) NOT NULL -- from confirmed CP
due_date date NOT NULL
status text CHECK (status IN ('pending','paid','overdue')) DEFAULT 'pending'
paid_at timestamptz
reference text -- supplier invoice or ref number
notes text
created_at timestamptz DEFAULT now()
```

#### client_ledger
```sql
-- APPEND ONLY. Never UPDATE or DELETE.
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
client_id uuid REFERENCES clients(id)
proposal_id uuid REFERENCES proposals(id)
type text CHECK (type IN ('credit','debit')) NOT NULL
amount numeric(12,2) NOT NULL
description text NOT NULL
reference text -- Razorpay payment ID or manual ref
created_by uuid REFERENCES users(id)
created_at timestamptz DEFAULT now()
```

#### forex_locks
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
from_currency text NOT NULL -- e.g. 'USD'
to_currency text DEFAULT 'INR'
locked_rate numeric(12,6) NOT NULL
locked_at timestamptz DEFAULT now()
last_checked_at timestamptz
current_rate numeric(12,6) -- updated by daily job
drift_pct numeric -- (current - locked) / locked * 100
alert_fired boolean DEFAULT false
UNIQUE(proposal_id, from_currency)
```

#### raw_quotes
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
supplier_id uuid REFERENCES suppliers(id)
source_type text CHECK (source_type IN ('pdf','excel','text'))
file_url text
raw_text text
parsed_json jsonb
sanitisation_flags jsonb -- array of flagged field names
created_at timestamptz DEFAULT now()
```

#### proposal_acceptance_log
```sql
-- APPEND ONLY. Never UPDATE or DELETE.
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
version integer NOT NULL
event_type text CHECK (event_type IN ('viewed','tc_accepted','visa_acknowledged','confirmed','addon_selected','tier_selected'))
ip_address text
user_agent text
metadata jsonb -- e.g. {tier_id, addon_ids, pvt_sic_choices}
created_at timestamptz DEFAULT now()
```

#### proposal_comments
```sql
-- APPEND ONLY. Never UPDATE or DELETE.
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id uuid REFERENCES proposals(id)
user_id uuid REFERENCES users(id)
message text NOT NULL
mentions uuid[] -- array of user_ids mentioned
created_at timestamptz DEFAULT now()
```

---

## 4. Pricing Formula — Locked Order

**NEVER change this order. Every developer must follow it.**

```
1. CP (net cost from supplier) — locked, internal only
2. + Markup (absolute INR or %) — gives base SP per line item
3. - Discount (reduces SP only, CP untouched) — margin alert fires if below threshold
4. = Line item SP

5. Sum of all line item SPs = subtotal
6. + GST (agent sets rate per proposal, on full subtotal) — if gst_enabled
7. + TCS at 5% (on subtotal) — if tcs_enabled
8. → Grand total rounding (UP to nearest rounding_unit) — if rounding_unit > 0
9. = GRAND TOTAL shown to client

Razorpay surcharge (2% + 18% GST) shown ONLY at payment screen, never in proposal.
```

### Rules
- CP never appears in client PDF, share link, or any client-facing export.
- Discount is always a separate line below subtotal in the PDF.
- Margin % = (SP - CP) / SP × 100. Below account threshold → red alert, must acknowledge before publish.
- Rounding is grand total only, always UP, options: 100 / 500 / 1000 / off.
- GST rate set per proposal by agent. One rate applies to full subtotal.
- TCS is always 5%, toggle per proposal.
- CWB (child with bed) and CNB (child no bed) have independent CP and SP per hotel row.

### Tiered pricing
- At proposal creation, agent selects: `standard` or `tiered` mode.
- Cannot switch mode after creation — requires V2.
- In tiered mode: 2-4 tiers defined (e.g. 4 pax, 6 pax). Each tier has own CP/SP per line item.
- Web link: pax toggle at top, all prices update dynamically.
- On confirmation: selected tier locked, others archived. Receivables + payables from confirmed tier.

---

## 5. Proposal Sections

### Cover Page
- Hero image + agency logo + trip title + destination + client name + agent name
- Image states: `curated` (green, trusted), `ai_suggested` (yellow, must approve before publish), `approved` (agent approved AI suggestion, turns green)
- Cannot publish with unapproved image

### Section 1 — Trip Summary
- Client name, travel dates, destination(s)
- Adults, children count
- Children ages (N/A if no children)
- CWB / CNB designation per child
- Special occasions (N/A-able)
- Dietary / accessibility needs (N/A-able)
- Quote validity date

### Section 2 — Hotels (multiple per proposal)
- Name, city, check-in, check-out, nights (computed)
- Room type, meal plan (RO/BB/HB/FB/AI), star rating, room view (N/A-able)
- SP per night (client sees), CWB SP, CNB SP
- CP per night (internal only)
- is_non_refundable checkbox
- If not NR: hotel_cancellation_slabs (days before → % charge)
- AI-generated description (must be approved before publish)
- Early check-in / late check-out flags (N/A-able)
- Supplier tagged (required)

### Section 3 — Flights (optional, entire section N/A-able)
- Multiple flights per proposal
- Flight number → AviationStack auto-fill: airline, route, departure, arrival, aircraft
- Cabin class, baggage (N/A-able) — manual
- SP total (client sees), CP total (internal)
- is_non_refundable checkbox
- Supplier tagged
- fare_expires_at — hard TTL per flight

### Buffer Check (automatic)
- Triggers when: flight arrival before 12:00 on hotel check-in date, OR flight departure after 18:00 on hotel check-out date
- Prompt: "Flight arrives early. Add: (A) Early check-in charge, (B) Day 0 hotel night, (C) Note in itinerary only, (D) Ignore"
- Same check for inter-hotel gaps: Hotel A checkout → Hotel B check-in same day

### Section 4 — Day-wise Itinerary
- Auto-generated one row per day from travel_start to travel_end
- City auto-synced from hotels (hotel date ranges → city per day)
- AI writes heading + paragraph per day
- Each day has typed activities in sequence:

#### Activity types
- `transfer` — from/to location, time, vehicle type, pvt/SIC/TBD/dual, CP, SP
- `sightseeing` — title, sites list, duration, guide included, pvt/SIC/TBD/dual, CP, SP
- `meal` — venue, meal type
- `activity` — name, notes
- `free_time` — label only
- `other` — free text

#### Pvt / SIC modes
- `pvt_only` — private confirmed. AI writes "private transfer/tour."
- `sic_only` — SIC confirmed. AI writes "shared coach/group tour."
- `tbd` — unknown. AI writes neutral text. Flagged orange in editor. Cannot publish without acknowledging TBD items.
- `dual` — both options offered. Both prices shown in PDF. Client selects on share link. Total shows range until all selections made.

#### Dual option confirmation flow
1. Client sees both options with prices
2. Client selects pvt or SIC for each dual item
3. Grand total updates live
4. Cannot accept without selecting all dual items
5. On confirmation: confirmed_cp/sp written, payables generated from confirmed CP

#### Conflict detection
- On save of any activity with start_time: check previous activity's end_time + GPT-4o travel time estimate (if different city)
- GPT prompt: "Estimate typical road travel time in minutes between [City A] and [City B] in [Country]. Return a single integer."
- Result cached in travel_time_cache
- If insufficient time: red flag "Logistical conflict: [details]." Cannot publish with unacknowledged conflicts.

#### Optional add-ons (is_optional = true)
- Excluded from grand total
- Shown in "Enhance Your Trip" section in PDF
- Checkbox on share link — checking updates total dynamically
- On client selection: agent notified, 24-hour approval window
- If not approved in 24hrs: client gets "Your selection is being reviewed" notice
- On approval: becomes confirmed line item, payable generated
- Unselected at confirmation: archived (not deleted)

### Section 5 — Inclusions & Exclusions
- Two lists: included, excluded
- Each item individually N/A-able
- AI suggests common inclusions/exclusions
- Visa note (N/A-able)
- Travel insurance note (N/A-able)

### Section 6 — Pricing Summary
- Per adult SP
- CWB SP (if children with bed)
- CNB SP (if children no bed)
- Single supplement (N/A-able)
- Subtotal
- Discount line (if applicable)
- GST line (if gst_enabled)
- TCS line (if tcs_enabled)
- Grand total (post rounding)
- "Enhance Your Trip" add-ons listed separately below, not in total
- Pre-dual-choice: shows range (min SIC total – max pvt total)
- CP / margin never shown

### Section 7 — Payment Terms
- Default: 25% deposit, balance 30 days before departure
- Editable per proposal
- Auto-generates receivable rows on confirmation

### Section 8 — Cancellation Policy
- Component-wise breakdown in PDF:
  - Flights: "Non-refundable from ticketing" (if is_non_refundable)
  - Hotels: "Non-refundable" OR slab table per hotel
  - Land/DMC: proposal-level slabs (agent enters per proposal, saveable as named presets)
- "Real Risk" summary row: at any cancellation window, sum of all NR components + land slab % × land CP
- No default — agent sets per proposal. Saveable as named presets.

### Visa Compliance Section (optional, agent toggles)
- Pulled from visa_compliance_rules by destination + client nationality
- Shows: visa required Y/N, type, passport validity required, transit visa notes
- Agent can edit before including in PDF
- Client must acknowledge on share link if section is enabled (separate checkbox, logged)

### Dynamic Content Blocks (optional, agent picks)
- On proposal creation: GPT-4o suggests blocks based on destination
- Agent toggles each on/off in editor
- Block types: packing_list, weather, destination_highlights, why_book_us, insurance_upsell, lounge_upsell, custom
- "Why book with us" — pulled from agency profile, not AI-generated
- Insurance and lounge upsell blocks auto-create is_optional add-on line items

---

## 6. Field States

Every field has one of four states:
- `extracted` — parsed from quote by GPT-4o
- `missing` — not found, user prompted to fill
- `na` — marked not applicable, field skipped in PDF
- `ai_generated` — written by AI, agent must review

Missing fields shown grouped by section in a completion form. Only unfilled fields shown. Every optional field has N/A toggle.

---

## 7. AI Sanitisation Layer

All GPT-4o parsing must include this system prompt preamble:

```
CRITICAL: Strip all of the following from any description or notes fields before returning:
- Supplier names, company names, internal codes
- The words: net, nett, confidential, internal, do not share, agent rate, cost, margin
- Any monetary amounts in description fields (pricing goes in dedicated price fields only)
- Internal reference numbers (e.g. "Ref #9922", "Booking ID: XYZ")
- Any instruction to the reader not to share content
Return ONLY client-appropriate descriptive text in description fields.
```

After parsing, run a second pass: regex check all description fields for: `/net|nett|internal|confidential|ref #|agent|cost price|margin/i`. Any match → flag that field in sanitisation_flags. Flagged fields shown yellow in editor. Cannot publish with unreviewed sanitisation flags.

---

## 8. Quote Import & Parsing

### Input types
- PDF — extract text via pdf-parse. If scanned, use GPT-4o vision.
- Excel / CSV — parse with SheetJS, convert to JSON, stringify for GPT-4o.
- Email text — raw paste into textarea.
- WhatsApp text — raw paste into textarea.

### Parsing flow
1. User selects input type and uploads/pastes
2. Text extracted and normalised to plain string
3. Sent to GPT-4o with structured extraction prompt
4. Response parsed to JSON matching proposal schema
5. Sanitisation layer runs (see Section 7)
6. Missing fields identified by comparing to required field list
7. User shown completion form: only missing/flagged fields
8. Every field has N/A toggle
9. User reviews and saves → proposal created

### GPT-4o extraction prompt structure
```
You are a travel proposal extraction assistant.
Extract all structured data from the following supplier quote.
Return ONLY valid JSON. No markdown, no explanation.

[SANITISATION RULES - see Section 7]

Return this exact shape:
{
  "supplier_name": string,
  "destination": string,
  "travel_start": "YYYY-MM-DD" | null,
  "travel_end": "YYYY-MM-DD" | null,
  "currency": string,
  "pax_adults": number | null,
  "pax_children": number | null,
  "hotels": [{
    "name": string,
    "city": string,
    "check_in": "YYYY-MM-DD" | null,
    "check_out": "YYYY-MM-DD" | null,
    "room_type": string | null,
    "meal_plan": "RO"|"BB"|"HB"|"FB"|"AI" | null,
    "cp_per_night": number | null,
    "description": string | null
  }],
  "flights": [{
    "flight_number": string,
    "cp_total": number | null
  }],
  "inclusions": string[],
  "exclusions": string[],
  "activities": [{
    "day": number | null,
    "description": string,
    "type": "transfer"|"sightseeing"|"activity"|"other"
  }],
  "payment_terms": string | null,
  "validity": string | null
}
```

---

## 9. Shadow Editing & Versioning

### States
- `published_data` (jsonb) — what client sees via share link. Never modified during editing.
- `draft_data` (jsonb) — what agent edits. Never served to client.
- `draft_differs_from_published` (boolean) — true when draft exists and differs.

### Draft flow
1. Agent opens sent proposal for editing → draft_data populated from published_data automatically
2. All edits auto-save to draft_data every 30 seconds
3. Editor shows yellow "Unpublished changes" banner
4. Agent can Discard Draft — published_data untouched, draft_data cleared
5. Agent clicks "Publish V2":
   - Snapshot current published_data → proposal_versions
   - Promote draft_data → published_data
   - Increment version number
   - Generate new share_token
   - Reset TTL (flight_expires_at, land_expires_at)
   - Notify client of updated proposal
   - Clear draft_data

### Version diff
- Computed on-the-fly: compare current published_data against any proposal_versions snapshot
- Every field diffed: removed / added / changed / unchanged
- Agent view: side-by-side diff panel
- Restore single field from V1: one click, writes to draft_data only (still requires Publish)
- Full V1 restore: creates V3 copy of V1 snapshot. V2 archived. New share token.

### Client version visibility
- Client sees all versions via share link (version history tab)
- SP changes shown between versions
- CP never shown to client in any version

### Stale version alert
- Client tries to accept non-latest version → blocked
- Warning lists what changed (SP changes highlighted)
- Must acknowledge before proceeding
- Agent can manually confirm any version — logs which version was confirmed

---

## 10. Quote TTL & Expiry

- `flight_expires_at` — hard expiry. Accept button disabled when expired. Shows countdown timer. On expiry: "Flight prices have expired. Request a refreshed quote →". Agent notified.
- `land_expires_at` — soft warning. Accept button stays active. Yellow banner: "Prices valid as of [date]. Rates may have changed." Client must acknowledge to proceed.
- TTL defaults set in account settings (e.g. flights: 24h, land: 14 days). Overridable per proposal.
- Re-publishing (even unchanged) resets both TTL timestamps.
- TTL ignored once proposal is confirmed.

---

## 11. Client Share Link & Confirmation Flow

### Share link behaviour
- URL: `/p/[share_token]`
- Reads published_data only
- Shows all proposal sections except internal fields (CP, margin, comments)
- Shows version history tab (SP changes only)
- WhatsApp floating button: pre-filled "Hi, I have a question about my [destination] proposal" → agent's WhatsApp number

### Confirmation flow
1. Client reads proposal
2. If dual pvt/SIC items: must select all before Accept activates
3. If tiered pricing: must select pax tier before Accept activates
4. If visa compliance section enabled: must tick visa acknowledgement checkbox
5. Must tick "I agree to Terms and Conditions" checkbox — logs IP + timestamp + user_agent + tc_version to proposal_acceptance_log
6. Clicks "Accept Proposal"
7. Payment screen:
   - Option A: Pay deposit via Razorpay (shows 2% + 18% GST surcharge)
   - Option B: "I'll pay offline — confirm booking anyway"
8. Both paths confirm booking:
   - status → confirmed
   - confirmed_cp/sp resolved for all dual items
   - confirmed_at + confirmed_by ('client') written
   - Receivables auto-generated from payment_terms
   - Payables auto-generated per supplier from confirmed CPs
   - Confirmation doc flow unlocked
   - Agent notified (email + in-app) with client's selections

### View notification
- Email + in-app notification to agent every time client opens share link
- view_count incremented, last_viewed_at updated

### Manual confirm (agent)
- Agent can confirm any proposal from dashboard
- Must set each dual-option choice manually
- confirmed_by = 'agent'
- Same financial resolution triggered

---

## 12. Ledger & Payments

### client_ledger rules
- Append-only. No edits, no deletes.
- Every credit and debit is a new row.
- Reversals = new negative entry.
- Razorpay success → webhook auto-creates credit entry.
- Manual payments logged by agent.

### V2 deposit handling
- If client paid deposit on V1 and V2 is issued:
  - No actual Razorpay refund
  - Agent clicks "Apply V1 credit to V2" → new debit entry created against old credit
  - New V2 receivable generated
  - If V2 total higher: client pays delta only
  - All visible in client ledger balance

### Receivables
- Auto-generated on confirmation from payment_terms
- e.g. Row 1: 25% deposit, due immediately. Row 2: 75% balance, due 30 days before travel_start.
- Statuses: pending / paid / overdue
- Agent marks paid: logs payment_method + reference

### Payables
- Auto-generated on confirmation, per supplier, from confirmed CP totals
- Due date = confirmation date + supplier.payment_terms_days
- Statuses: pending / paid / overdue
- Agent marks paid: logs reference number

---

## 13. Forex

- On proposal creation: fetch live rate for each foreign currency via OpenExchangeRates API
- Lock to proposal in forex_locks table
- Agent enters CP in source currency → system converts to INR at locked rate. Both stored.
- Daily background job: re-fetch live rate, compute drift_pct
- Alert trigger: |drift_pct| > 2%
- Alert message: "USD has moved X% since this proposal was created. Your margin on [line item] may be affected."
- Agent action: "Refresh rate" (recalculates all INR CPs, re-runs margin check) or "Keep locked rate"

---

## 14. Peak Season Surcharges

- supplier_surcharges: stored per supplier, date ranges with amount/type
- On proposal creation or date change: check all tagged suppliers against their surcharge calendars
- Match → "Surcharge alert: [Supplier] has a [label] surcharge for [date range]. Add to proposal?"
- Agent can also add ad-hoc surcharges directly on any hotel or flight line item

---

## 15. Component-wise Cancellation

### Flights
- `is_non_refundable` checkbox per flight
- If checked: 100% loss from ticketing date

### Hotels
- `is_non_refundable` checkbox per hotel
- If checked: 100% loss from booking
- If not checked: agent enters hotel_cancellation_slabs [{days_before, charge_pct}]

### Land / DMC
- Always uses proposal-level cancellation slabs
- Agent sets per proposal, saveable as named presets

### PDF output
```
Cancellation Policy
-------------------
Flight EK512 (Emirates): Non-refundable from date of ticketing
Hotel Atlantis: Free cancellation until 7 days prior. 100% charge within 7 days.
Hotel Burj Al Arab: Non-refundable
Land arrangements: 30+ days: 25% | 15-29 days: 50% | Under 15 days: 100%

Real Risk Summary:
If cancelled 20 days before departure:
- Flights: ₹85,000 (non-refundable)
- Hotel Burj Al Arab: ₹60,000 (non-refundable)
- Land: ₹12,500 (50% of ₹25,000)
- Total loss: ₹1,57,500 of ₹2,30,000
```

---

## 16. Visa Compliance

- visa_compliance_rules table: destination_country + nationality → requirements
- Triggered when destination + client nationality set on proposal
- Compliance alert panel shown in editor (informational, not blocking)
- Agent toggles visa section into PDF
- If included: client must tick acknowledgement checkbox on share link (logged)
- Phase 2: visa_check_source = 'api' plugs in Sherpa API, same UI

---

## 17. Legal & Audit

### Terms + signature
- "I agree to Terms and Conditions" checkbox on share link
- Must be ticked before Accept activates
- Logs to proposal_acceptance_log: IP address, user_agent, timestamp, tc_version, proposal version

### Visa acknowledgement (if section enabled)
- Separate checkbox: "I have noted the travel requirements above"
- Also logged to proposal_acceptance_log

### Acceptance log events
- `viewed` — every time share link opened
- `tc_accepted` — T&C checkbox ticked
- `visa_acknowledged` — visa checkbox ticked
- `confirmed` — Accept button clicked
- `addon_selected` — optional add-on selected
- `tier_selected` — pax tier selected

---

## 18. Internal Comments

- Per proposal. Visible to: proposal owner + super_admin only.
- Append-only. No edits, no deletes.
- @mentions: tagged user gets in-app notification.
- Never in PDF, share link, confirmation doc, or any export.

---

## 19. Image Tagging

- `curated`: agent uploaded from own library. Green badge. No check required.
- `ai_suggested`: fetched from Unsplash based on destination. Yellow badge. Agent must click "Approve" before publish.
- `approved`: agent approved AI suggestion. Green badge.
- Cannot publish proposal with any unapproved image.

---

## 20. AI Content Generation

### Itinerary day paragraph
```
You are a luxury travel copywriter. Write a warm, evocative paragraph (3-5 sentences) 
for Day [N] of a trip to [destination]. 
The traveller is staying at [hotel] in [city].
Activities today: [list].
Transfer mode: [pvt/sic/tbd — use neutral language if tbd].
Write a compelling subheading (5-7 words) followed by the paragraph.
Do not mention prices, costs, or supplier names.
```

### Hotel description
```
Write a 3-4 sentence luxury travel description of [hotel name], [city], [country].
Mention its location, ambience, and key features.
Do not mention prices or room rates.
```

### Dynamic content blocks
```
For a trip to [destination(s)], suggest which of these content blocks would be most 
relevant and useful. Return a JSON array of block types with a draft content object for each.
Block types: packing_list, weather, destination_highlights, insurance_upsell, lounge_upsell
```

---

## 21. Dashboards

### Agent dashboard
- My proposals: count by status (draft / sent / viewed / confirmed / cancelled)
- Recent activity feed
- Proposals expiring soon (TTL < 48hrs)
- TBD items pending resolution
- Unacknowledged conflict flags
- Sanitisation flags awaiting review
- Unapproved images
- Outstanding receivables (what clients owe me)
- Outstanding payables (what I owe suppliers)
- Margin summary (avg margin % across active proposals)
- Client directory quick access
- New proposal button

### Super admin dashboard
- All of the above across ALL agents
- Per-agent proposal count and revenue
- Total receivables vs collected
- Total payables vs paid
- Overdue receivables (flagged red)
- Overdue payables (flagged red)
- Forex alerts across all proposals
- User management (invite, deactivate agents)
- Supplier DB management
- Visa compliance checklist management
- Agency profile (logo, T&C, WhatsApp number, default payment terms, margin threshold, rounding settings)

---

## 22. Confirmation Document (post-booking, separate)

- Triggered when proposal status → confirmed
- Separate PDF, same branding as proposal
- Additional fields not in proposal:
  - PNR / airline booking reference
  - Hotel confirmation numbers
  - Guide name + contact
  - Transfer driver details
  - Emergency contact
  - Insurance policy number
  - Visa appointment details
  - Full payment receipt summary
- Never shown to client until agent explicitly sends it

---

## 23. Build Phases

### Phase 1 — MVP (build first)
Auth + users, client directory, supplier directory, quote import + AI parse + sanitisation, proposal builder (all 8 sections, standard pricing mode), single-currency pricing with GST/TCS, PDF generation, share link with T&C checkbox, basic confirmation flow (client accept + agent manual), receivables, agent dashboard (basic).

### Phase 2 — Core features
Versioning + diff, shadow editing, ledger, payables, Razorpay integration, forex freeze + alerts, component-wise cancellation, surcharge calendar, buffer check, image tagging + Unsplash.

### Phase 3 — Advanced features
Tiered pricing, optional add-ons with 24hr approval, conflict detection, visa compliance, dynamic content blocks, TTL/expiry with countdown, WhatsApp button, terms signature + IP log, super admin dashboard, confirmation document flow, proposal_acceptance_log full implementation.

### Phase 4 — Polish
Version history for client, stale version alert, full diff UI, V1 restore, forex alert UI, peak season surcharge alerts, agent dashboard advanced metrics.

---

## 24. Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
AVIATIONSTACK_API_KEY=
UNSPLASH_ACCESS_KEY=
OPEN_EXCHANGE_RATES_APP_ID=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
```

---

## 25. Key Invariants (never violate these)

1. CP is never sent to any client-facing route, API response, or PDF.
2. client_ledger, proposal_comments, proposal_acceptance_log are append-only.
3. share_token always reads from published_data, never draft_data.
4. Margin alert must fire before any proposal can be published if margin < threshold.
5. Sanitisation flags must be cleared before publish.
6. Unapproved images block publish.
7. Unacknowledged conflict flags block publish.
8. TBD pvt/SIC items must be acknowledged before publish.
9. T&C checkbox must be ticked before Accept activates on share link.
10. Pricing formula order (Section 4) must never change.
