# EzTrips CRM — Implementation Plan

> Generated 2026-04-28. Covers all phases from critical security fixes through scale features.

---

## Table of Contents

- [Phase 0: Critical Fixes (Security & Stability)](#phase-0-critical-fixes)
- [Phase 1: Core Flow Completion](#phase-1-core-flow)
- [Phase 2: Polish & UX](#phase-2-polish)
- [Phase 3: Scale & Nice-to-Haves](#phase-3-scale)
- [Appendix A: SQL Migrations](#appendix-a-sql-migrations)
- [Appendix B: Code Outline — Voucher System](#appendix-b-voucher-system)

---

## Phase 0: Critical Fixes

> **Goal**: Secure the system and prevent data corruption. Must be done before any feature work.
> **Estimated effort**: 2-3 days

### 0.1 — Add Auth Guards to Unprotected API Routes

**Problem**: 7 API routes have no authentication. Anyone can call expensive OpenAI endpoints or upload files.

**Files to modify**:
```
src/app/api/ai/itinerary/route.ts
src/app/api/ai/hotel-description/route.ts
src/app/api/ai/content-blocks/route.ts
src/app/api/ai/parse-policy/route.ts
src/app/api/ai/sanitise/route.ts
src/app/api/quotes/import/route.ts
src/app/api/quotes/parse/route.ts
```

**New file to create**:
```
src/lib/api/with-auth.ts          — reusable auth wrapper
```

**Implementation**:

```ts
// src/lib/api/with-auth.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function requireApiAuth() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user };
}
```

Then in each unprotected route, add at the top of each handler:
```ts
const auth = await requireApiAuth();
if ('error' in auth) return auth.error;
```

**Testing checklist**:
- [ ] Each of the 7 routes returns 401 when called without a session cookie
- [ ] Each route works normally when called with a valid session
- [ ] Existing frontend functionality (AI suggestions, quote import) still works

---

### 0.2 — Add Zod Validation to All POST/PATCH Endpoints

**Problem**: Raw request bodies are passed directly to Supabase inserts with no validation.

**New file to create**:
```
src/lib/validations/clients.ts
src/lib/validations/suppliers.ts
src/lib/validations/bookings.ts
src/lib/validations/proposals.ts
src/lib/validations/receivables.ts
src/lib/validations/enquiries.ts
```

**Files to modify**:
```
src/app/api/clients/route.ts                    — POST
src/app/api/clients/[id]/route.ts               — PATCH
src/app/api/suppliers/route.ts                   — POST
src/app/api/suppliers/[id]/route.ts              — PATCH
src/app/api/bookings/route.ts                    — PATCH
src/app/api/bookings/[id]/payments/route.ts      — POST, PATCH
src/app/api/bookings/[id]/emails/route.ts        — POST
src/app/api/receivables/[id]/route.ts            — PATCH
src/app/api/payables/[id]/route.ts               — PATCH
src/app/api/settings/route.ts                    — PATCH
src/app/api/website/enquiry/route.ts             — POST
```

**Example validation schema**:
```ts
// src/lib/validations/clients.ts
import { z } from 'zod';

export const createClientSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().min(10).max(20),
  email: z.string().email().optional().nullable(),
  nationality: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateClientSchema = createClientSchema.partial();
```

**Pattern for use in routes**:
```ts
const body = await request.json();
const parsed = createClientSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
}
const { data } = parsed;
// use `data` instead of `body` for the insert
```

**Testing checklist**:
- [ ] POST with missing required fields returns 400
- [ ] POST with extra/unknown fields strips them (Zod `.strict()` or field selection)
- [ ] POST with invalid types (string where number expected) returns 400
- [ ] Valid payloads still work as before

---

### 0.3 — Add Ownership Filtering

**Problem**: Any authenticated agent can access any other agent's clients, proposals, and bookings.

**Files to modify**:
```
src/app/api/clients/route.ts                    — GET: add .eq('created_by', user.id)
src/app/api/clients/[id]/route.ts               — GET/PATCH/DELETE: verify ownership
src/app/api/proposals (all)                      — filter by created_by
src/app/api/bookings/route.ts                    — GET: add .eq('created_by', user.id)
src/app/api/bookings (PATCH, sub-routes)         — verify ownership
src/app/api/suppliers/route.ts                   — GET: add .eq('created_by', user.id)
src/app/api/receivables/[id]/route.ts            — verify ownership through proposal
src/app/api/payables/[id]/route.ts               — verify ownership through proposal
```

**New helper**:
```ts
// src/lib/api/with-auth.ts (extend)
export async function requireApiAuthWithRole() {
  const auth = await requireApiAuth();
  if ('error' in auth) return auth;
  
  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, role, org_id')
    .eq('id', auth.user.id)
    .single();
  
  return {
    user: auth.user,
    dbUser,
    isSuperAdmin: dbUser?.role === 'super_admin',
  };
}
```

**Pattern**: super_admin sees everything; agents see only `created_by = user.id`.

```ts
let query = supabase.from('clients').select('*');
if (!auth.isSuperAdmin) {
  query = query.eq('created_by', auth.user.id);
}
```

**Testing checklist**:
- [ ] Agent A cannot see Agent B's clients/proposals/bookings
- [ ] super_admin can see all records
- [ ] Agent A cannot PATCH/DELETE Agent B's records (returns 403)
- [ ] Existing proposal share links still work (public, no auth)

---

### 0.4 — Add try/catch + Logging to All API Routes

**Problem**: 20/27 route files have no try/catch. Unhandled exceptions leak stack traces.

**Files to modify**: All 27 route files under `src/app/api/`

**Pattern**:
```ts
import { createLogger } from '@/lib/logger';
const logger = createLogger('api:clients');

export async function POST(request: Request) {
  try {
    // ... existing logic ...
  } catch (err) {
    logger.error('POST /api/clients failed', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Testing checklist**:
- [ ] Simulate a Supabase outage (invalid service key) — verify 500 returned without stack trace
- [ ] Verify logger output appears in server console
- [ ] No regressions in normal operation

---

## Phase 1: Core Flow Completion

> **Goal**: Get the happy path working perfectly — enquiry to voucher with all emails.
> **Estimated effort**: 7-10 days

### 1.1 — Wire Up Supplier Email Sending via SMTP

**Problem**: Supplier email templates are composed in the booking UI but never actually sent. The `booking_emails` table stores them, the PATCH route marks them as "sent", but no SMTP call exists.

**Files to modify**:
```
src/lib/email/mailer.ts                          — add sendSupplierEmail()
src/app/api/bookings/[id]/emails/route.ts        — call sendSupplierEmail on PATCH when status='sent'
```

**Implementation**:

```ts
// Add to src/lib/email/mailer.ts

export async function sendSupplierEmail({
  to,
  subject,
  body,
  replyTo,
  agencyName,
}: {
  to: string;
  subject: string;
  body: string;       // already composed from template
  replyTo?: string;   // agent's email for replies
  agencyName?: string;
}) {
  if (!process.env.GMAIL_USER) return;
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"${agencyName || 'EzTrips'}" <${process.env.GMAIL_USER}>`,
    to,
    replyTo,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
  });
}
```

Then in `bookings/[id]/emails/route.ts` PATCH handler, after updating status to 'sent':

```ts
if (body.status === 'sent' && emailRecord.to_email) {
  try {
    await sendSupplierEmail({
      to: emailRecord.to_email,
      subject: emailRecord.subject,
      body: emailRecord.body,
      replyTo: user.email,
    });
  } catch (err) {
    logger.error('Failed to send supplier email', err);
    // Still mark as sent in DB (agent can resend manually)
  }
}
```

**Testing checklist**:
- [ ] Compose a hotel booking email in the booking detail UI
- [ ] Click "Send" — verify email arrives at supplier address
- [ ] Verify `booking_emails.sent_at` is stamped
- [ ] Verify `booking_logs` has an `email_sent` entry
- [ ] Verify failure doesn't crash the route (fire-and-forget)

---

### 1.2 — Customer Confirmation Email

**Problem**: Customer confirms and pays but receives no email — no receipt, no booking reference, no next steps.

**Files to modify**:
```
src/lib/email/mailer.ts                          — add sendCustomerConfirmationEmail()
src/app/api/proposals/[id]/confirm/route.ts      — call it after confirmation
```

**Implementation**:

```ts
// Add to src/lib/email/mailer.ts

export async function sendCustomerConfirmationEmail({
  to,
  clientName,
  agencyName,
  agentName,
  agentWhatsApp,
  proposalTitle,
  destination,
  travelStart,
  travelEnd,
  grandTotal,
  currency,
  paymentTerms,
}: {
  to: string;
  clientName: string;
  agencyName: string;
  agentName: string;
  agentWhatsApp?: string;
  proposalTitle: string;
  destination: string;
  travelStart: string;
  travelEnd: string;
  grandTotal: number;
  currency: string;
  paymentTerms?: { deposit_pct: number; balance_days_before: number };
}) {
  // HTML email with:
  // - "Booking Confirmed!" header with green check
  // - Trip summary (destination, dates, pax)
  // - Payment summary (total, deposit due now, balance due date)
  // - "What happens next?" section (agent will contact, documents will follow)
  // - Agent contact info (name, WhatsApp)
  // - Agency branding (name, logo)
}
```

In `confirm/route.ts`, after line 281 (after `sendConfirmationToAgent`):

```ts
// Send confirmation to customer
if (client?.email) {
  try {
    await sendCustomerConfirmationEmail({
      to: client.email,
      clientName: client.full_name,
      agencyName: agent?.agency_name || 'EzTrips',
      agentName: agent?.full_name || '',
      agentWhatsApp: agent?.whatsapp_number,
      proposalTitle: proposal.title,
      destination: proposal.destination,
      travelStart: proposal.travel_start,
      travelEnd: proposal.travel_end,
      grandTotal,
      currency: proposal.currency,
      paymentTerms: proposal.payment_terms,
    });
  } catch { /* silent */ }
}
```

**Testing checklist**:
- [ ] Confirm a proposal → customer receives confirmation email
- [ ] Email contains correct total, dates, destination
- [ ] Email shows agent contact info
- [ ] No email sent if client has no email address
- [ ] Email failure doesn't block confirmation

---

### 1.3 — Enquiry → Proposal Data Pre-fill

**Problem**: The "Create Proposal" button on enquiry detail passes `client_id` and `enquiry_id` as URL params, but the new-proposal page doesn't fetch and pre-fill from the enquiry.

**Current state**: `proposals/new/page.tsx` reads `enquiry_id` from searchParams and saves it to the proposal, but does NOT fetch the enquiry to pre-fill destination, dates, pax, etc.

**Files to modify**:
```
src/app/(dashboard)/proposals/new/page.tsx       — fetch enquiry data and pre-fill form
```

**Implementation**: In the `new proposal` page, after reading `enquiry_id` from searchParams:

```ts
// After line 26 (const enquiryId = searchParams.get('enquiry_id'))
let enquiryDefaults: Record<string, unknown> = {};
if (enquiryId) {
  const { data: enq } = await supabase
    .from('website_enquiries')
    .select('destination, travel_date, adults, children, children_ages, number_of_nights, hotel_category, budget_range, special_requirements')
    .eq('id', enquiryId)
    .single();
  
  if (enq) {
    enquiryDefaults = {
      destination: enq.destination,
      travel_start: enq.travel_date,
      pax_adults: enq.adults || 2,
      pax_children: enq.children || 0,
      children_ages: enq.children_ages,
      // travel_end calculated from travel_date + number_of_nights
    };
  }
}
```

Then spread `enquiryDefaults` into the proposal insert at lines 149 and 167.

**Also**: Update enquiry status to `proposal_sent` when proposal is published (not just created).

**Files to modify**:
```
src/app/api/proposals/[id]/publish/route.ts      — update linked enquiry status
```

**Testing checklist**:
- [ ] Click "Create Proposal" from enquiry detail → proposal form is pre-filled with destination, dates, pax
- [ ] Enquiry with no travel_date → form still works (fields just empty)
- [ ] Publishing the proposal updates enquiry status to 'proposal_sent'
- [ ] `enquiry_id` is saved on the proposal record

---

### 1.4 — Agent Notification on Proposal View

**Problem**: Customer opens the share link, views the proposal, but the agent has no idea.

**Files to modify**:
```
src/lib/email/mailer.ts                          — add sendProposalViewedNotification()
src/app/p/[share_token]/page.tsx                 — trigger notification on first view
```

**Implementation**: In the share link page, after incrementing `view_count`:

```ts
// Only notify on first view (view_count was 0 before increment)
if (proposal.view_count === 0) {
  const { data: agent } = await supabase
    .from('users').select('email, full_name').eq('id', proposal.created_by).single();
  
  if (agent?.email) {
    try {
      await sendProposalViewedNotification({
        to: agent.email,
        agentName: agent.full_name,
        clientName: client.full_name,
        proposalTitle: proposal.title,
        proposalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/proposals/${proposal.id}`,
      });
    } catch { /* silent */ }
  }
}
```

**Testing checklist**:
- [ ] First view of proposal → agent receives "Client viewed your proposal" email
- [ ] Second view → no duplicate email
- [ ] Email contains link back to proposal editor

---

### 1.5 — Voucher Generation System

**This is the most critical missing piece. See [Appendix B](#appendix-b-voucher-system) for complete code outline.**

**SQL migration** (see Appendix A):
```sql
CREATE TABLE vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  voucher_type TEXT NOT NULL CHECK (voucher_type IN ('hotel','flight','transfer','activity','package')),
  voucher_number TEXT NOT NULL UNIQUE,
  pdf_url TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','cancelled')),
  issued_at TIMESTAMPTZ,
  issued_by UUID REFERENCES users(id),
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_vouchers_booking ON vouchers(booking_id);
```

**New files to create**:
```
src/app/api/vouchers/route.ts                    — GET (list by booking_id), POST (create)
src/app/api/vouchers/[id]/route.ts               — GET (single), PATCH (update), DELETE
src/app/api/vouchers/[id]/pdf/route.ts           — GET (generate & stream PDF)
src/app/api/vouchers/[id]/send/route.ts          — POST (email voucher to client)
src/lib/types/database.ts                        — add Voucher interface
src/lib/voucher-templates/hotel.ts               — hotel voucher HTML template
src/lib/voucher-templates/flight.ts              — flight voucher HTML template
src/lib/voucher-templates/activity.ts            — activity voucher HTML template
src/components/vouchers/VoucherManager.tsx        — UI component for booking detail page
```

**Files to modify**:
```
src/app/(dashboard)/bookings/[id]/page.tsx       — add Vouchers tab with VoucherManager
src/lib/email/mailer.ts                          — add sendVoucherEmail()
```

**Testing checklist**:
- [ ] Create a hotel voucher from booking detail → PDF generates correctly
- [ ] Voucher PDF contains: guest name, hotel name, dates, room type, meal plan, booking ref
- [ ] "Send to Client" → email arrives with PDF attachment
- [ ] Voucher number is auto-generated and unique (format: EZ-V-YYYYMMDD-XXXX)
- [ ] Cannot create voucher for a booking with status 'pending' or 'cancelled'

---

### 1.6 — Unify Payment Tracking

**Problem**: Two parallel payment systems — `receivables` (proposal-level, client→agency) and `booking_payments` (booking-level, agency→supplier). They are not linked, causing confusion.

**SQL migration**:
```sql
-- Link booking_payments to receivables
ALTER TABLE booking_payments ADD COLUMN receivable_id UUID REFERENCES receivables(id);

-- Add proposal_id to bookings for easier cross-referencing (already exists, verify)
-- Add a view for unified payment dashboard
CREATE VIEW payment_overview AS
SELECT
  p.id as proposal_id,
  p.title as proposal_title,
  c.full_name as client_name,
  r.id as receivable_id,
  r.amount as receivable_amount,
  r.status as receivable_status,
  r.due_date as receivable_due,
  b.id as booking_id,
  b.title as booking_title,
  bp.id as payment_id,
  bp.amount as payment_amount,
  bp.status as payment_status,
  bp.due_date as payment_due
FROM proposals p
JOIN clients c ON c.id = p.client_id
LEFT JOIN receivables r ON r.proposal_id = p.id
LEFT JOIN bookings b ON b.proposal_id = p.id
LEFT JOIN booking_payments bp ON bp.booking_id = b.id;
```

**Files to modify**:
```
src/app/(dashboard)/page.tsx                     — dashboard: show unified payment summary
src/app/(dashboard)/receivables/page.tsx         — link to related bookings
src/app/(dashboard)/bookings/[id]/page.tsx       — show linked receivables
```

**Testing checklist**:
- [ ] Dashboard shows total outstanding (receivables + payables)
- [ ] Marking a receivable as paid is visible on the booking detail
- [ ] No double-counting between the two systems

---

## Phase 2: Polish & UX

> **Goal**: Improve agent productivity, customer experience, and system reliability.
> **Estimated effort**: 5-7 days

### 2.1 — Connect Website to CMS APIs

**Problem**: Website uses static `lib/data.ts` for destinations and hardcoded blog posts. CMS exists in SaaS but isn't connected.

**Files to modify (EztripsWebsite)**:
```
src/app/destinations/page.tsx                    — fetch from API instead of lib/data
src/lib/data.ts                                  — deprecate/remove static destination data
src/app/blog/page.tsx                            — fetch from new public blog API
```

**New API route (EztripsSaas)**:
```
src/app/api/website/public/blog/route.ts         — GET published blog posts
```

**Files to modify (EztripsSaas)**:
```
src/app/api/website/public/destinations/route.ts — ensure all needed fields are returned
```

**Testing checklist**:
- [ ] Destinations page loads from API (not static data)
- [ ] New destination added in CMS appears on website within 5 min (ISR)
- [ ] Blog page loads from API
- [ ] New blog post published in CMS appears on website
- [ ] Fallback/error state if API is unreachable

---

### 2.2 — Proposal Expiry Notifications

**Problem**: Flight TTL (24h) and land TTL (14d) are set on publish but nothing happens when they expire.

**Options**: Supabase Edge Function (cron) or a Next.js API route called by external cron.

**New files to create**:
```
src/app/api/cron/check-expiry/route.ts           — called by Vercel Cron or external scheduler
src/lib/email/mailer.ts                          — add sendExpiryWarningEmail()
```

**Vercel cron config** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiry",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Implementation**:
```ts
// GET /api/cron/check-expiry
// 1. Find proposals where flight_expires_at < now() AND status = 'sent'
// 2. Find proposals where land_expires_at < now() AND status = 'sent'
// 3. For each: send warning email to agent, optionally update status
// 4. Guard with CRON_SECRET header check
```

**Testing checklist**:
- [ ] Proposal with expired flight TTL → agent receives warning email
- [ ] Already-confirmed proposals are not flagged
- [ ] Cron endpoint requires secret header (not publicly callable)
- [ ] Duplicate notifications not sent (track `expiry_notified_at` on proposal)

---

### 2.3 — WhatsApp Share for Proposals

**Problem**: Agents can only email the share link. WhatsApp is the primary channel in Indian travel.

**Files to modify**:
```
src/app/(dashboard)/proposals/[id]/page.tsx      — add WhatsApp share button next to email
src/components/proposals/ProposalEditor.tsx       — if share button lives here
```

**Implementation**: Use WhatsApp deep link (`https://wa.me/{phone}?text={encoded_message}`).

```ts
const whatsappUrl = `https://wa.me/${client.phone}?text=${encodeURIComponent(
  `Hi ${client.full_name}, your travel proposal is ready! View it here: ${shareUrl}`
)}`;
window.open(whatsappUrl, '_blank');
```

No API changes needed — this is purely a frontend feature.

**Testing checklist**:
- [ ] WhatsApp button visible after proposal is published
- [ ] Clicking opens WhatsApp with pre-filled message containing share link
- [ ] Works on mobile and desktop

---

### 2.4 — Enquiry Auto-Assignment & Follow-up Reminders

**Problem**: All enquiries go to a single hardcoded email. No auto-assignment. No follow-up reminders.

**Files to modify**:
```
src/app/api/website/enquiry/route.ts             — configurable notification recipient(s)
src/app/api/cron/follow-up-reminders/route.ts    — NEW: daily cron for overdue follow-ups
```

**SQL migration**:
```sql
-- Add assignment rules (simple round-robin or least-loaded)
ALTER TABLE website_enquiries ADD COLUMN auto_assigned BOOLEAN DEFAULT false;
```

**Testing checklist**:
- [ ] Enquiry notification goes to assigned agent (not hardcoded email)
- [ ] Overdue follow-ups trigger daily email to assigned agent
- [ ] Agents see their follow-up count on dashboard

---

### 2.5 — Consistent Error Handling & API Response Format

**New file to create**:
```
src/lib/api/response.ts                          — standardized response helpers
```

```ts
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(logger: Logger, context: string, err: unknown) {
  logger.error(context, err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

**Files to modify**: All API routes — adopt consistent `ok()` / `fail()` / `serverError()` pattern.

---

## Phase 3: Scale & Nice-to-Haves

> **Goal**: Features that improve competitiveness but aren't blocking the core flow.
> **Estimated effort**: 10-15 days (can be parallelized)

### 3.1 — Customer Portal

**New pages**:
```
src/app/(customer)/login/page.tsx                — magic link login for customers
src/app/(customer)/dashboard/page.tsx            — list of their trips
src/app/(customer)/trips/[id]/page.tsx           — trip detail (itinerary, vouchers, payments)
src/app/(customer)/trips/[id]/documents/page.tsx — download vouchers, PDFs
```

**New API routes**:
```
src/app/api/customer/auth/route.ts               — magic link generation
src/app/api/customer/trips/route.ts              — list proposals/bookings for customer
src/app/api/customer/trips/[id]/route.ts         — trip detail
src/app/api/customer/trips/[id]/documents/route.ts — list vouchers + PDFs
```

**SQL migration**:
```sql
-- Customer auth tokens (magic links)
CREATE TABLE customer_auth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 3.2 — Revision History & Client Comments

**SQL migration**:
```sql
CREATE TABLE proposal_revision_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  version INT NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('agent','client')),
  author_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Files to modify**:
```
src/app/p/[share_token]/page.tsx                 — add "Request Changes" button for client
src/app/(dashboard)/proposals/[id]/page.tsx      — show revision notes timeline
src/app/api/proposals/[id]/revisions/route.ts    — NEW: CRUD for revision notes
```

---

### 3.3 — Multi-Agent Team Management

**SQL migration**:
```sql
CREATE TABLE team_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  invited_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**New pages**:
```
src/app/(dashboard)/admin/team/page.tsx          — manage team members
```

**New API routes**:
```
src/app/api/admin/team/route.ts                  — list/invite team members
src/app/api/admin/team/[id]/route.ts             — update role, deactivate
```

---

### 3.4 — Test Infrastructure

**New files**:
```
vitest.config.ts
src/__tests__/api/proposals/confirm.test.ts
src/__tests__/api/proposals/publish.test.ts
src/__tests__/api/webhooks/razorpay.test.ts
src/__tests__/api/website/enquiry.test.ts
src/__tests__/lib/bookings.test.ts
src/__tests__/lib/email-templates.test.ts
```

**Package additions**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Priority test targets** (by risk):
1. `proposals/[id]/confirm` — financial calculations, receivable/payable generation
2. `webhooks/razorpay` — payment processing, HMAC verification
3. `lib/bookings.ts` — booking creation logic, installment calculation
4. `website/enquiry` — public endpoint, client creation
5. `proposals/[id]/publish` — snapshot generation, share token

---

## Appendix A: SQL Migrations

### Migration 001 — Vouchers Table

```sql
-- 001_create_vouchers.sql

CREATE TABLE vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  voucher_type TEXT NOT NULL CHECK (voucher_type IN ('hotel','flight','transfer','activity','package')),
  voucher_number TEXT NOT NULL UNIQUE,
  pdf_url TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','cancelled')),
  issued_at TIMESTAMPTZ,
  issued_by UUID REFERENCES users(id),
  emailed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vouchers_booking ON vouchers(booking_id);
CREATE INDEX idx_vouchers_status ON vouchers(status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_voucher_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_voucher_timestamp();
```

### Migration 002 — Payment Linking

```sql
-- 002_link_payments.sql

ALTER TABLE booking_payments
  ADD COLUMN receivable_id UUID REFERENCES receivables(id);

-- Proposal expiry tracking
ALTER TABLE proposals
  ADD COLUMN expiry_notified_at TIMESTAMPTZ;
```

### Migration 003 — Customer Auth (Phase 3)

```sql
-- 003_customer_auth.sql

CREATE TABLE customer_auth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_tokens_token ON customer_auth_tokens(token);
CREATE INDEX idx_customer_tokens_client ON customer_auth_tokens(client_id);
```

### Migration 004 — Revision Notes (Phase 3)

```sql
-- 004_revision_notes.sql

CREATE TABLE proposal_revision_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  version INT NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('agent','client')),
  author_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_revision_notes_proposal ON proposal_revision_notes(proposal_id);
```

---

## Appendix B: Voucher System — Complete Code Outline

This is the most critical missing piece: the system currently stops at "booking confirmed" with no way to generate guest-facing documents.

### Type Definition

```ts
// Add to src/lib/types/database.ts

export interface Voucher {
  id: string;
  booking_id: string;
  voucher_type: 'hotel' | 'flight' | 'transfer' | 'activity' | 'package';
  voucher_number: string;        // EZ-V-20260428-0001
  pdf_url: string | null;
  data: VoucherData;             // typed JSONB
  status: 'draft' | 'issued' | 'cancelled';
  issued_at: string | null;
  issued_by: string | null;
  emailed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoucherData {
  // Guest info
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  pax_adults: number;
  pax_children: number;

  // Hotel-specific
  hotel_name?: string;
  hotel_address?: string;
  hotel_phone?: string;
  check_in?: string;
  check_out?: string;
  nights?: number;
  room_type?: string;
  room_count?: number;
  meal_plan?: string;
  special_requests?: string;

  // Flight-specific
  airline?: string;
  flight_number?: string;
  departure_city?: string;
  arrival_city?: string;
  departure_at?: string;
  arrival_at?: string;
  cabin_class?: string;
  pnr?: string;

  // Transfer/Activity-specific
  service_name?: string;
  service_date?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_time?: string;
  vehicle_type?: string;

  // Agency info (stamped at generation time)
  agency_name: string;
  agency_phone?: string;
  agency_email?: string;
  agency_logo_url?: string;
  agent_name: string;
  agent_phone?: string;

  // Booking reference
  booking_reference?: string;
  supplier_confirmation?: string;
}
```

### API Routes

```ts
// src/app/api/vouchers/route.ts

// GET /api/vouchers?booking_id=xxx
// - Auth required
// - Returns all vouchers for a booking, ordered by created_at desc
// - Ownership check: booking.created_by must match user.id (or super_admin)

// POST /api/vouchers
// - Auth required
// - Body: { booking_id, voucher_type }
// - Auto-generates voucher_number: EZ-V-{YYYYMMDD}-{4-digit sequence}
// - Auto-populates `data` from booking + client + supplier + agent records
// - Returns created voucher
// - Validation: booking must be 'confirmed' or 'in_progress'
```

```ts
// src/app/api/vouchers/[id]/route.ts

// GET /api/vouchers/:id
// - Returns single voucher with full data

// PATCH /api/vouchers/:id
// - Updates data fields, notes, status
// - If status changed to 'issued': stamp issued_at, issued_by

// DELETE /api/vouchers/:id
// - Only if status = 'draft'
```

```ts
// src/app/api/vouchers/[id]/pdf/route.ts

// GET /api/vouchers/:id/pdf
// - Generates PDF using Puppeteer (same pattern as proposals/[id]/pdf)
// - Uses voucher-type-specific HTML template
// - Streams PDF response
// - Optionally uploads to Supabase Storage and stores pdf_url
```

```ts
// src/app/api/vouchers/[id]/send/route.ts

// POST /api/vouchers/:id/send
// - Generates PDF (if not already cached)
// - Sends email to client with PDF attachment
// - Updates emailed_at timestamp
// - Body: { to?: string } (override recipient, defaults to client email)
```

### Auto-Population Logic

```ts
// src/lib/vouchers.ts

export async function buildVoucherData(
  supabase: SupabaseClient,
  booking: Booking,
  voucherType: string,
): Promise<VoucherData> {
  // 1. Fetch client, agent (users), organisation in parallel
  const [client, agent, org] = await Promise.all([
    supabase.from('clients').select('*').eq('id', booking.client_id).single(),
    supabase.from('users').select('*').eq('id', booking.created_by).single(),
    // org via agent's org_id
  ]);

  const base: Partial<VoucherData> = {
    guest_name: client.data?.full_name || '',
    guest_phone: client.data?.phone,
    guest_email: client.data?.email,
    pax_adults: booking.pax_adults,
    pax_children: booking.pax_children,
    agency_name: agent.data?.agency_name || org.data?.name || 'EzTrips',
    agency_phone: org.data?.phone,
    agency_email: org.data?.email,
    agency_logo_url: agent.data?.logo_url || org.data?.logo_url,
    agent_name: agent.data?.full_name || '',
    agent_phone: agent.data?.whatsapp_number,
    booking_reference: booking.reference_number,
  };

  // 2. Type-specific data
  if (voucherType === 'hotel') {
    // Fetch hotel record linked to this booking's proposal
    const { data: hotel } = await supabase
      .from('hotels')
      .select('*')
      .eq('proposal_id', booking.proposal_id)
      // Match by supplier_id if booking has one
      .order('sort_order')
      .limit(1)
      .single();

    if (hotel) {
      Object.assign(base, {
        hotel_name: hotel.name,
        check_in: hotel.check_in,
        check_out: hotel.check_out,
        nights: hotel.nights,
        room_type: hotel.room_type,
        meal_plan: hotel.meal_plan,
      });
    }
  }

  if (voucherType === 'flight') {
    const { data: flight } = await supabase
      .from('flights')
      .select('*')
      .eq('proposal_id', booking.proposal_id)
      .order('sort_order')
      .limit(1)
      .single();

    if (flight) {
      Object.assign(base, {
        airline: flight.airline,
        flight_number: flight.flight_number,
        departure_city: flight.origin_city,
        arrival_city: flight.destination_city,
        departure_at: flight.departure_at,
        arrival_at: flight.arrival_at,
        cabin_class: flight.cabin_class,
      });
    }
  }

  // ... similar for transfer, activity

  return base as VoucherData;
}

export function generateVoucherNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `EZ-V-${date}-${seq}`;
}
```

### Hotel Voucher HTML Template

```ts
// src/lib/voucher-templates/hotel.ts

export function hotelVoucherHtml(data: VoucherData): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 40px; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a365d; padding-bottom: 20px; }
      .logo { max-height: 60px; }
      .voucher-title { font-size: 24px; color: #1a365d; font-weight: 700; }
      .voucher-number { font-size: 14px; color: #666; }
      .section { margin: 24px 0; }
      .section-title { font-size: 16px; font-weight: 600; color: #1a365d; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      td { padding: 8px 12px; border: 1px solid #e2e8f0; }
      td:first-child { font-weight: 600; width: 160px; background: #f7fafc; }
      .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 12px; color: #666; text-align: center; }
      .stamp { background: #c6f6d5; color: #22543d; padding: 4px 12px; border-radius: 4px; display: inline-block; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        ${data.agency_logo_url ? `<img src="${data.agency_logo_url}" class="logo" />` : ''}
        <div style="font-size:18px;font-weight:700;">${data.agency_name}</div>
      </div>
      <div style="text-align:right;">
        <div class="voucher-title">HOTEL VOUCHER</div>
        <div class="voucher-number"><!-- voucher_number injected by caller --></div>
        <div class="stamp">CONFIRMED</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Guest Details</div>
      <table>
        <tr><td>Guest Name</td><td>${data.guest_name}</td></tr>
        <tr><td>Adults / Children</td><td>${data.pax_adults} Adults, ${data.pax_children} Children</td></tr>
        ${data.guest_phone ? `<tr><td>Phone</td><td>${data.guest_phone}</td></tr>` : ''}
      </table>
    </div>

    <div class="section">
      <div class="section-title">Hotel Details</div>
      <table>
        <tr><td>Hotel</td><td>${data.hotel_name || '-'}</td></tr>
        <tr><td>Check-in</td><td>${data.check_in || '-'}</td></tr>
        <tr><td>Check-out</td><td>${data.check_out || '-'}</td></tr>
        <tr><td>Nights</td><td>${data.nights || '-'}</td></tr>
        <tr><td>Room Type</td><td>${data.room_type || '-'}</td></tr>
        <tr><td>Meal Plan</td><td>${data.meal_plan || '-'}</td></tr>
        ${data.special_requests ? `<tr><td>Special Requests</td><td>${data.special_requests}</td></tr>` : ''}
      </table>
    </div>

    ${data.booking_reference || data.supplier_confirmation ? `
    <div class="section">
      <div class="section-title">Booking Reference</div>
      <table>
        ${data.booking_reference ? `<tr><td>Our Reference</td><td>${data.booking_reference}</td></tr>` : ''}
        ${data.supplier_confirmation ? `<tr><td>Hotel Confirmation</td><td>${data.supplier_confirmation}</td></tr>` : ''}
      </table>
    </div>
    ` : ''}

    <div class="footer">
      <p>${data.agency_name} | ${data.agency_phone || ''} | ${data.agency_email || ''}</p>
      <p>Your travel consultant: ${data.agent_name} ${data.agent_phone ? '| ' + data.agent_phone : ''}</p>
    </div>
  </body>
  </html>
  `;
}
```

### UI Component

```tsx
// src/components/vouchers/VoucherManager.tsx

// Props: { bookingId: string, bookingType: string, bookingStatus: string }
//
// State: vouchers[], loading, creating
//
// On mount: GET /api/vouchers?booking_id={bookingId}
//
// UI:
// - List of existing vouchers with status badges (draft/issued/cancelled)
// - Each row: voucher_number | type | status | created_at | actions (View PDF, Send, Edit, Cancel)
// - "Generate Voucher" button (disabled if booking is pending/cancelled)
//   → POST /api/vouchers { booking_id, voucher_type: bookingType }
//   → On success, refresh list
// - "View PDF" → opens /api/vouchers/{id}/pdf in new tab
// - "Send to Client" → POST /api/vouchers/{id}/send → shows success toast
// - "Edit" → opens modal with editable VoucherData fields
// - "Cancel" → PATCH /api/vouchers/{id} { status: 'cancelled' }
```

Integration into booking detail page:

```tsx
// In src/app/(dashboard)/bookings/[id]/page.tsx
// Add a "Vouchers" tab alongside existing Details/Payments/Emails/Activity tabs

<TabsContent value="vouchers">
  <VoucherManager
    bookingId={booking.id}
    bookingType={booking.booking_type}
    bookingStatus={booking.status}
  />
</TabsContent>
```

---

## Summary: Execution Priority

| Phase | Item | Effort | Impact | Risk if Skipped |
|-------|------|--------|--------|-----------------|
| **0** | Auth guards on 7 routes | 2h | Security | API abuse, cost blowout |
| **0** | Zod validation | 4h | Data integrity | Garbage data in DB |
| **0** | Ownership filtering | 4h | Privacy | Agent data leaks |
| **0** | try/catch + logging | 3h | Stability | Silent failures |
| **1** | Supplier email sending | 3h | Operations | Manual copy-paste workflow |
| **1** | Customer confirmation email | 2h | Trust | Customer uncertainty |
| **1** | Enquiry → proposal pre-fill | 2h | Productivity | Manual re-entry |
| **1** | Proposal view notification | 1h | Sales | Missed follow-up timing |
| **1** | Voucher system | 2-3d | Core flow | Cannot deliver documents |
| **1** | Payment unification | 1d | Finance | Confusion, double-tracking |
| **2** | Website ↔ CMS connection | 1d | Content | Stale website content |
| **2** | Expiry notifications | 4h | Revenue | Expired quotes unnoticed |
| **2** | WhatsApp share | 1h | Conversion | Slower outreach |
| **2** | Error handling cleanup | 4h | DX | Debugging difficulty |
| **3** | Customer portal | 3-4d | Differentiation | Share-link only |
| **3** | Revision history | 2d | Collaboration | No audit trail |
| **3** | Team management | 2d | Scale | Single-agent limitation |
| **3** | Test suite | 3-4d | Confidence | Fear of refactoring |
