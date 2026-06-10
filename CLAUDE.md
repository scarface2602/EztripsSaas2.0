# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev       # Start Next.js dev server (localhost:3000)
npm run build     # Production build — also runs ESLint + TypeScript checks
npm run lint      # ESLint only
npm start         # Serve production build
```

No test suite is configured. Verify changes with `npm run build`.

---

## Project Overview

**EzTrips** is a multi-tenant travel SaaS for travel agents. Agents create proposals, convert them to bookings, track payments, manage suppliers, and generate PDFs (proposals, vouchers, invoices, receipts). Super admins see all data; agents see only their own.

**Stack**: Next.js 14 (App Router) · TypeScript · Supabase (auth + DB + storage) · OpenAI · Puppeteer · shadcn/ui · Vercel

---

## Architecture

### Directory Layout

```
src/app/(auth)/         # Login/signup (public)
src/app/(dashboard)/    # Protected pages — proposals, bookings, operations, leads, suppliers, etc.
src/app/api/            # API routes organized by resource
src/app/p/              # Public share links (proposals, passenger details)
src/lib/supabase/       # Two server clients (see below)
src/lib/email/          # Nodemailer mailer + HTML templates
src/lib/vouchers/       # Puppeteer PDF generation (shared by vouchers, invoices, receipts)
src/lib/receipts/       # Receipt HTML template
src/lib/schemas/        # Zod validation schemas
src/lib/types/          # TypeScript interfaces
src/lib/utils/          # Pricing, sanitization, forex, text utilities
src/components/ui/      # shadcn/ui primitives
src/middleware.ts        # Auth middleware — redirects unauthenticated users
```

### Two Supabase Server Clients

This is the most important pattern in the codebase:

- **`createClient()`** — uses anon key + user cookies. RLS is enforced. Use for auth checks and user-scoped queries.
- **`createServiceClient()`** — uses service role key, no cookies. Bypasses RLS entirely. Use only when you need cross-user data (admin views, cron jobs, system operations).

Both are exported from `src/lib/supabase/server.ts`. The client-side equivalent (`src/lib/supabase/client.ts`) always enforces RLS.

### Auth & Roles

- Middleware protects all routes except `/p/*`, `/api/auth/*`, `/api/webhooks/*`, `/api/website/*`, `/invite/*`
- Two roles: `super_admin` (sees everything) and `agent` (sees own data only)
- Admin routes use `requireSuperAdmin()` at page level
- RLS policies on every table enforce agent-level isolation

### API Route Pattern

Routes live under `src/app/api/{resource}/`. Most follow this pattern:
1. Auth check via `createClient()` → `getUser()`
2. Input validation with Zod
3. Business logic with `createServiceClient()` for mutations
4. Activity logging to `booking_logs`
5. Return JSON response

Next.js 15 `params` convention: route params are `Promise<{ id: string }>` — always `await params`.

---

## Key Systems

### Proposal → Booking Pipeline

Proposals have separate `draft_data` and `published_data` JSONB columns. Share links read only `published_data`. When a proposal is confirmed, it converts to a booking with booking items (flights, hotels, vehicles, activities, etc.).

### Operations Workflow

`POST /api/bookings/[id]/ops-action` handles 7 action types:
- `request_confirmation` — emails supplier, auto-creates 48h follow-up reminder
- `mark_confirmed` — cancels pending follow-ups, may trigger booking-confirmed notification
- `mark_on_hold`, `follow_up`, `escalate` — status transitions with email/logging
- `check_in` / `check_out` — guest arrival/departure tracking (hotels)

Booking-level status auto-derives from the combined `supplier_status` of all items.

The operations page (`src/app/(dashboard)/operations/`) has two view modes: board (grouped by urgency) and checklist (daily task list with progress tracking).

### Payment Systems (Two Coexist)

**Legacy**: `payables` and `receivables` tables — linked to proposals, used in financial dashboards.

**Current**: `booking_payments` table with `direction: 'payable' | 'receivable'` — linked to bookings. `booking_package_payments` tracks installment schedules per package with a DB trigger (`refresh_booking_package_payment_summary`) that auto-updates booking totals.

Both systems are active. The supplier ledger API (`/api/suppliers/[id]/ledger`) merges both into a unified view.

### PDF Generation

All PDFs use Puppeteer via `@sparticuz/chromium` (Vercel-optimized). The shared function is `htmlToPdf()` in `src/lib/vouchers/pdf.ts`. Used by:
- Proposal PDFs (`/api/proposals/[id]/pdf`)
- Voucher PDFs (`/api/bookings/[id]/vouchers`)
- Invoice PDFs (`/api/bookings/[id]/invoices`) — proforma, final, credit note types
- Receipt PDFs (`/api/bookings/[id]/receipts`) — auto-emailed to clients

PDF routes use `export const runtime = 'nodejs'` and `export const maxDuration = 60`.

### Cron Jobs

Configured in `vercel.json`, all routes under `src/app/api/cron/`:
- `/api/cron/supplier-followup` — 09:00 UTC daily
- `/api/cron/vendor-payment-reminders` — 08:00 UTC daily
- `/api/cron/customer-reminders` — 10:00 UTC daily
- `/api/cron/reminders` — 01:30 UTC daily — dispatches `scheduled_reminders` table entries

The `scheduled_reminders` table stores deferred emails (types: `payment_due`, `supplier_followup`, `booking_confirmed`). Reminders are auto-created by ops-action handlers and payment creation flows.

### Leads CRM

Leads come from `website_enquiries`. The leads page (`src/app/(dashboard)/leads/`) shows enquiries with agent assignment, follow-up tracking, and proposal counts. Agents see only their assigned leads; admins see all. Enquiry `requirement_type` can be `package`, `flight`, `hotel`, `transfer`, or `visa` — each with type-specific fields in `requirement_details` JSONB.

### Proposal Editor & Pricing Engine

`src/app/(dashboard)/proposals/[id]/proposal-editor.tsx` (~1000 lines) is a large single-file component using `react-hook-form` with `FormProvider`. Key patterns:

- **Form shape** (`ProposalFormValues`): `{ proposal, hotels, flights, itineraryDays, lineItems, customSections, includeFlights, globalMarkupPct, pricingMode, landMarkupPct, flightMarkupPct, gstAmountOverride, tcsAmountOverride }`
- **Pricing modes**: `package` (single global markup %) or `itemised` (separate land/flight markup %)
- **Markup inputs** use controlled `value` + `onChange` with `setValue()` — do NOT use `register` with `valueAsNumber` (causes NaN when cleared)
- **Auto-save**: 3-second debounced save on any form change; writes `draft_data` JSONB + `total_sp` and `land_sp` to the proposals table
- **Accordion sections**: 11 sections (cover, trip summary, hotels, flights, ancillaries, itinerary, inclusions/exclusions, custom sections, cancellation, payment terms, comments)

### Quick-Start Suggestion Engine

When creating a proposal from a lead (`/proposals/new?enquiry_id=X`), agents can clone past successful proposals:
- `proposals.cities_visited` (text[]) and `proposals.route_signature` (text) are auto-populated on publish
- `find_similar_proposals` RPC: Branch A (exact city match) or Branch B (distinct route signatures)
- `/api/proposals/suggestions` — GET endpoint for fetching matches
- `/api/proposals/clone` — POST endpoint for deep-cloning proposal + hotels/flights/itinerary/activities/line_items
- UI component: `src/components/proposals/route-suggestions.tsx`

---

## Database

Migrations live in `supabase/migrations/`. Key tables beyond the basics:

- `booking_items` — has `supplier_status`, `assigned_to`, `checked_in_at`, `checked_out_at`, `supplier_id`
- `booking_packages` — groups booking items; `booking_package_payments` for installment schedules
- `booking_logs` — activity audit trail (action + details JSONB)
- `booking_emails` — sent email records (direction: incoming/outgoing)
- `scheduled_reminders` — deferred email queue (pending → sent/failed/cancelled)
- `receipts` — payment receipts with auto-generated `RCT-YYYY-NNNNNN` numbers
- `invoices` — proforma/final/credit note with `INV-YYYY-NNNNNN` numbers
- `payment_accounts` — bank/UPI accounts for payment tracking

**Rules**:
- All monetary values: `numeric(12,2)`
- Cost Price (CP) fields are **never exposed** in client-facing APIs or public share links
- Append-only tables (never update/delete): `client_ledger`, `proposal_comments`, `proposal_acceptance_log`, `booking_logs`

---

## Large File Pattern

Some client-side pages contain multiple component functions in a single file:

**`src/app/(dashboard)/bookings/[id]/page.tsx`** (~1900 lines):
- `BookingDetailPage()` — main component (~1300 lines with all state, tabs, dialogs)
- `ItemCard()` — booking item card with status workflow
- `EmailsTab()` — email composition and history
- `InvoiceReceiptList()` — document listing
- `SendReminderButton()` — quick reminder action

**`src/app/(dashboard)/proposals/[id]/proposal-editor.tsx`** (~1000 lines):
- `ProposalEditor()` — form state, pricing `useMemo`, auto-save, sticky pricing bar, accordion wrapper
- Pricing calculations at lines ~175-225 — `landSupplierCost`, `flightSupplierCost`, `pricingBreakdown` useMemo

**`src/app/(dashboard)/leads/leads-client.tsx`** — leads table + Add Enquiry sheet with per-type form fields

When editing these files, identify which component function you're modifying and be careful not to place JSX or state in the wrong function boundary.

---

## Important References

- **`SPEC.md`** — Master product spec. Read before architectural decisions.
- **`IMPLEMENTATION_PLAN.md`** — Phased feature roadmap.
- **`src/lib/utils/pricing.ts`** — CP → Selling Price markup logic with configurable rounding.
- **`src/lib/api/with-auth.ts`** — Auth guard wrapper for API routes.
