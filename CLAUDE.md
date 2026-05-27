# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Quick Reference

### Common Commands

```bash
npm run dev       # Start Next.js dev server (localhost:3000)
npm run build     # Build for production
npm start         # Run production build
npm run lint      # Run ESLint
```

**Testing**: No test suite currently set up. When implementing tests, structure under `src/__tests__/` or `__tests__/` adjacent to source files.

### Project Overview

**EzTrips** is a travel proposal SaaS for travel agents to create, manage, and share proposals with clients. Core features:
- Travel proposal builder with cost pricing (CP) and markup
- Client management and lead tracking
- AI-powered content generation (itineraries, hotel descriptions, policy parsing)
- PDF proposal export with custom branding
- Booking management, voucher generation, and payment tracking
- Supplier database with surcharges
- Financial dashboards (payables, receivables)

**Tech Stack**: Next.js 14 (App Router) + TypeScript + Supabase + OpenAI + Puppeteer + shadcn/ui

---

## Architecture

### Directory Structure

```
src/
├── app/              # Next.js App Router pages and API routes
│   ├── (auth)/       # Login/signup pages (public)
│   ├── (dashboard)/  # Main app (protected, RLS-controlled)
│   ├── api/          # API route handlers organized by resource
│   ├── p/            # Public proposal share links
│   └── invite/       # Team invitation flows
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   └── cms/         # Website CMS components
├── lib/
│   ├── supabase/    # Auth clients (server, client, middleware)
│   ├── api/         # API utilities (auth guards, rate limiting)
│   ├── auth/        # Auth actions (server actions)
│   ├── email/       # Email sending (Nodemailer) and templates
│   ├── schemas/     # Zod validation schemas
│   ├── types/       # TypeScript interfaces
│   ├── utils/       # Utilities (sanitization, pricing, forex, text)
│   └── vouchers/    # PDF voucher generation (Puppeteer)
└── middleware.ts    # Auth middleware — redirects unauthed users to /login
```

### Authentication & Authorization

**Middleware** (`src/middleware.ts`):
- Public paths: `/p/*`, `/api/auth/*`, `/api/webhooks/*`, `/api/website/*`, `/invite/*`
- Protected paths: Everything else → requires user session (Supabase Auth)
- `/login` → redirects to `/` if already authenticated
- `/admin/*` → additional role check at page level via `requireSuperAdmin()`

**Supabase RLS** (Row-Level Security):
- **Agents** see only their own rows (clients, proposals, bookings)
- **Super admins** bypass RLS via service role key for cross-agent views

**User Roles**:
- `super_admin` — Full access to all data, user management, dashboards
- `agent` — Own clients, proposals, bookings only

---

## API Routes

API routes are organized by resource under `src/app/api/`:

### Core Resources
- `proposals/[id]/` — Create, fetch, patch, generate days, upload cover, PDF export
- `bookings/[id]/` — Manage bookings, payments, vouchers, logs, emails
- `clients/` — Client CRUD
- `suppliers/[id]/` — Supplier CRUD, surcharges
- `quotes/` — Quote import and parsing
- `receivables/[id]/`, `payables/[id]/` — Financial tracking

### AI Routes (OpenAI integration)
- `/api/ai/itinerary` — Generate travel itinerary
- `/api/ai/hotel-description` — Generate hotel descriptions
- `/api/ai/content-blocks` — Generate content blocks
- `/api/ai/parse-policy` — Parse cancellation policies
- `/api/ai/sanitise` — Sanitize user input

### Website/CMS Routes
- `/api/website/cms/` — Blog, destinations, packages, enquiries
- `/api/website/cms/images/suggest` — AI image suggestions (Unsplash)

### Webhooks
- `/api/webhooks/razorpay/` — Payment webhook from Razorpay

**All API routes require authentication** — see `IMPLEMENTATION_PLAN.md` Phase 0.1 for the `withAuth()` wrapper pattern.

---

## Database (Supabase)

**Key Tables** (from SPEC.md):
- `users` — Agents and super admins
- `clients` — Client directory
- `proposals` — Travel proposals with `draft_data` / `published_data` JSONB
- `proposal_comments`, `proposal_acceptance_log` — Append-only audit logs
- `bookings` — Trip bookings with status tracking
- `booking_items` — Flights, hotels, transfers per booking
- `suppliers` — Hotel, airline, transfer suppliers
- `supplier_surcharges` — Cost overrides per supplier
- `payables` — Agent payments for suppliers
- `receivables` — Client payments received
- `client_ledger` — Append-only transaction log
- `website_cms_*` — Blog posts, destinations, packages

**Critical Rules**:
- All monetary values: `numeric(12,2)`
- Cost Price (CP) fields **never exposed** to clients or client-facing APIs
- Proposals: Draft and published data stored separately → share links read only `published_data`
- Append-only tables never updated or deleted: `client_ledger`, `proposal_comments`, `proposal_acceptance_log`

---

## Key Implementation Patterns

### Server/Client Split
- **Server Components** (default in App Router): Fetch data, auth checks, Supabase queries
- **Client Components** (`'use client'`): Forms, interactivity, UI state
- **Server Actions** (`'use server'` in `src/lib/auth/actions.ts`): Form submissions, mutations

### Form Validation
- **Zod schemas** defined in `src/lib/schemas/`
- Use with React Hook Form: `useForm()` + `zodResolver()`
- API routes validate with `schema.parse()` or `schema.safeParse()`

### Supabase Clients
- **Server**: `createClient()` from `src/lib/supabase/server.ts` — uses service role for RLS bypass when needed
- **Client**: `createClient()` from `src/lib/supabase/client.ts` — client-side queries (RLS enforced)
- **Middleware**: `updateSession()` from `src/lib/supabase/middleware.ts` — refreshes auth tokens

### Email
- **Mailer**: `sendEmail()` from `src/lib/email/mailer.ts` — Nodemailer + HTML templates
- **Templates**: `src/lib/email-templates/index.ts` — HTML email generators
- Example: Item confirmation emails in `src/lib/email/item-confirmed.ts`

### PDF Generation
- **Puppeteer** via `@sparticuz/chromium` (Vercel-optimized)
- **Voucher PDFs**: `src/lib/vouchers/pdf.ts` and `templates.ts`
- **Proposal PDFs**: `/api/proposals/[id]/pdf/route.ts` (10s timeout in `vercel.json`)

### Pricing & Margins
- **Markup logic**: `src/lib/utils/pricing.ts` — CP → Selling Price calculation
- **Rounding**: Configurable per agent (100, 500, 1000 increments)

### AI Content
- **Schema validation**: `src/lib/schemas/ai.ts`
- **Text sanitization**: `src/lib/utils/text-sanitise.ts` — HTML escape, remove script tags
- **Policy parsing**: GPT-4o extracts refund/cancellation terms → structured JSON

---

## Configuration

### Environment Variables
Located in `.env.local` (not in git):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NODEMAILER_FROM=
NODEMAILER_PASS=
(others as needed)
```

### Build & Deployment
- **Framework**: Next.js 14 (App Router)
- **Hosting**: Vercel
- **TLS**: `NODE_TLS_REJECT_UNAUTHORIZED=0` in `next.config.mjs` (for Puppeteer)
- **External packages** (Server Components only): Supabase, Puppeteer, Chromium

---

## Common Workflows

### Adding a New API Endpoint

1. Create route file: `src/app/api/resource/route.ts`
2. Import auth wrapper: `import { withAuth } from '@/lib/api/with-auth'`
3. Define Zod schema in `src/lib/schemas/`
4. Validate request: `schema.parse(await request.json())`
5. Query Supabase with appropriate client (server for RLS bypass if needed)
6. Return JSON response with appropriate status code

### Adding a Proposal-Related Feature

1. Update database schema in Supabase if needed
2. Add types to `src/lib/types/` if creating new data structures
3. Create API route in `src/app/api/proposals/[id]/`
4. Add page or component in `src/app/(dashboard)/proposals/`
5. Test with `npm run dev` locally against Supabase dev instance

### Generating Content with AI

1. Use schema from `src/lib/schemas/ai.ts`
2. Call OpenAI (`openai.chat.completions.create()`)
3. Sanitize output with `sanitizeText()` or `sanitizeHtml()`
4. Return as JSON in route response
5. Frontend fetches and displays

---

## Important Files & Patterns

- **`src/lib/api/with-auth.ts`** — Auth guard for API routes
- **`src/lib/api/rate-limit.ts`** — Rate limiting utility
- **`src/lib/supabase/server.ts`** — Server-side Supabase client (use for mutations)
- **`src/middleware.ts`** — Authentication middleware (do not remove)
- **`SPEC.md`** — Master spec; read before making architectural decisions
- **`IMPLEMENTATION_PLAN.md`** — Phased feature roadmap with security fixes

---

## Tips

- **Always read SPEC.md first** when starting work on a new feature or architectural question
- **Cost Price is sensitive** — never log, expose, or return CP in client-facing responses
- **RLS is the firewall** — don't query with service role unnecessarily; trust RLS for filtering
- **Test locally first** — verify auth and permissions work before pushing to Vercel
- **Proposal data structure** — proposals have `draft_data` (editing) and `published_data` (shared) as separate JSONB columns; share links read only `published_data`
