-- =============================================================
-- EzTrips SaaS — Row Level Security
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================
-- Rules:
--   • Agents see only their own proposals/clients/suppliers
--   • super_admin sees all data
--   • Share link (/p/[share_token]) uses service_role — bypasses RLS entirely
--   • All API routes that serve unauthenticated clients use service_role
--   • SECURITY DEFINER on helper functions prevents RLS recursion
-- =============================================================

-- ─── Helper: is current user a super_admin? ─────────────────
-- SECURITY DEFINER = runs as the creator (postgres), so it can
-- read the users table without triggering its own RLS policy.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' FROM public.users WHERE id = auth.uid()),
    false
  );
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- =============================================================
-- 1. users
-- =============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;

-- Agents read their own row; super_admin reads all.
-- IMPORTANT: no is_super_admin() call here — that would recurse.
-- Super admins are granted read-all via SECURITY DEFINER in is_super_admin itself.
CREATE POLICY "users_select" ON users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (SELECT role = 'super_admin' FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "users_update" ON users
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (SELECT role = 'super_admin' FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    id = auth.uid()
    OR (SELECT role = 'super_admin' FROM public.users WHERE id = auth.uid())
  );

-- New user rows are created via the invite flow using service_role.
-- No INSERT policy needed for authenticated role.

-- =============================================================
-- 2. organisations
-- =============================================================
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organisations_select" ON organisations;
DROP POLICY IF EXISTS "organisations_all" ON organisations;

CREATE POLICY "organisations_select" ON organisations
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.org_id = organisations.id
    )
  );

CREATE POLICY "organisations_update" ON organisations
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =============================================================
-- 3. clients
-- =============================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_all" ON clients;

CREATE POLICY "clients_all" ON clients
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR is_super_admin())
  WITH CHECK (created_by = auth.uid() OR is_super_admin());

-- =============================================================
-- 4. suppliers
-- =============================================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_all" ON suppliers;

CREATE POLICY "suppliers_all" ON suppliers
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR is_super_admin())
  WITH CHECK (created_by = auth.uid() OR is_super_admin());

-- =============================================================
-- 5. supplier_surcharges
-- =============================================================
ALTER TABLE supplier_surcharges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_surcharges_all" ON supplier_surcharges;

CREATE POLICY "supplier_surcharges_all" ON supplier_surcharges
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.id = supplier_surcharges.supplier_id
        AND suppliers.created_by = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.id = supplier_surcharges.supplier_id
        AND suppliers.created_by = auth.uid()
    )
  );

-- =============================================================
-- 6. proposals
-- =============================================================
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposals_authenticated" ON proposals;
DROP POLICY IF EXISTS "proposals_public_share" ON proposals;

-- Authenticated agents: own proposals only.
CREATE POLICY "proposals_authenticated" ON proposals
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR is_super_admin())
  WITH CHECK (created_by = auth.uid() OR is_super_admin());

-- Anon (defence-in-depth): read published proposals by share_token.
-- The share link route currently uses service_role and doesn't need this,
-- but it's here in case the implementation changes.
CREATE POLICY "proposals_public_share" ON proposals
  FOR SELECT TO anon
  USING (share_token IS NOT NULL AND status IN ('sent', 'viewed', 'confirmed'));

-- =============================================================
-- Helper macro: proposal-child table policy
-- All child tables with a proposal_id column follow this pattern.
-- =============================================================

-- 7. proposal_versions
ALTER TABLE proposal_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proposal_versions_all" ON proposal_versions;
CREATE POLICY "proposal_versions_all" ON proposal_versions
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_versions.proposal_id AND proposals.created_by = auth.uid()))
  WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_versions.proposal_id AND proposals.created_by = auth.uid()));

-- 8. proposal_tiers
ALTER TABLE proposal_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proposal_tiers_all" ON proposal_tiers;
CREATE POLICY "proposal_tiers_all" ON proposal_tiers
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_tiers.proposal_id AND proposals.created_by = auth.uid()))
  WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_tiers.proposal_id AND proposals.created_by = auth.uid()));

-- 9. hotels
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hotels_all" ON hotels;
CREATE POLICY "hotels_all" ON hotels
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = hotels.proposal_id AND proposals.created_by = auth.uid()))
  WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = hotels.proposal_id AND proposals.created_by = auth.uid()));

-- 10. flights
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flights_all" ON flights;
CREATE POLICY "flights_all" ON flights
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = flights.proposal_id AND proposals.created_by = auth.uid()))
  WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = flights.proposal_id AND proposals.created_by = auth.uid()));

-- 11. itinerary_days
ALTER TABLE itinerary_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "itinerary_days_all" ON itinerary_days;
CREATE POLICY "itinerary_days_all" ON itinerary_days
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = itinerary_days.proposal_id AND proposals.created_by = auth.uid()))
  WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = itinerary_days.proposal_id AND proposals.created_by = auth.uid()));

-- 12. itinerary_activities
ALTER TABLE itinerary_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "itinerary_activities_all" ON itinerary_activities;
CREATE POLICY "itinerary_activities_all" ON itinerary_activities
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = itinerary_activities.proposal_id AND proposals.created_by = auth.uid()))
  WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = itinerary_activities.proposal_id AND proposals.created_by = auth.uid()));

-- 13. line_items
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "line_items_all" ON line_items;
CREATE POLICY "line_items_all" ON line_items
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = line_items.proposal_id AND proposals.created_by = auth.uid()))
  WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = line_items.proposal_id AND proposals.created_by = auth.uid()));

-- 14. proposal_content_blocks
ALTER TABLE proposal_content_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "content_blocks_all" ON proposal_content_blocks;
CREATE POLICY "content_blocks_all" ON proposal_content_blocks
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_content_blocks.proposal_id AND proposals.created_by = auth.uid()))
  WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_content_blocks.proposal_id AND proposals.created_by = auth.uid()));

-- 15. receivables
-- ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "receivables_all" ON receivables;
-- CREATE POLICY "receivables_all" ON receivables
--   FOR ALL TO authenticated
--   USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = receivables.proposal_id AND proposals.created_by = auth.uid()))
--   WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = receivables.proposal_id AND proposals.created_by = auth.uid()));

-- 16. payables
-- ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "payables_all" ON payables;
-- CREATE POLICY "payables_all" ON payables
--   FOR ALL TO authenticated
--   USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = payables.proposal_id AND proposals.created_by = auth.uid()))
--   WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = payables.proposal_id AND proposals.created_by = auth.uid()));

-- 17. forex_locks
ALTER TABLE forex_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "forex_locks_all" ON forex_locks;
CREATE POLICY "forex_locks_all" ON forex_locks
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = forex_locks.proposal_id AND proposals.created_by = auth.uid()))
  WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = forex_locks.proposal_id AND proposals.created_by = auth.uid()));

-- 18. raw_quotes
ALTER TABLE raw_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "raw_quotes_all" ON raw_quotes;
CREATE POLICY "raw_quotes_all" ON raw_quotes
  FOR ALL TO authenticated
  USING (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = raw_quotes.proposal_id AND proposals.created_by = auth.uid()))
  WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = raw_quotes.proposal_id AND proposals.created_by = auth.uid()));

-- =============================================================
-- 19. client_ledger (APPEND-ONLY — no UPDATE or DELETE)
-- =============================================================
ALTER TABLE client_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_ledger_select" ON client_ledger;
DROP POLICY IF EXISTS "client_ledger_insert" ON client_ledger;

CREATE POLICY "client_ledger_select" ON client_ledger
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = client_ledger.client_id
        AND clients.created_by = auth.uid()
    )
  );

CREATE POLICY "client_ledger_insert" ON client_ledger
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = client_ledger.client_id
        AND clients.created_by = auth.uid()
    )
  );

-- =============================================================
-- 20. proposal_acceptance_log (APPEND-ONLY)
-- All inserts are done via service_role (confirm route, log-event route).
-- Authenticated agents can read logs for their proposals.
-- =============================================================
ALTER TABLE proposal_acceptance_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acceptance_log_select" ON proposal_acceptance_log;

CREATE POLICY "acceptance_log_select" ON proposal_acceptance_log
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.proposals
      WHERE proposals.id = proposal_acceptance_log.proposal_id
        AND proposals.created_by = auth.uid()
    )
  );

-- =============================================================
-- 21. proposal_comments (APPEND-ONLY — no UPDATE or DELETE)
-- =============================================================
ALTER TABLE proposal_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposal_comments_select" ON proposal_comments;
DROP POLICY IF EXISTS "proposal_comments_insert" ON proposal_comments;

CREATE POLICY "proposal_comments_select" ON proposal_comments
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.proposals
      WHERE proposals.id = proposal_comments.proposal_id
        AND proposals.created_by = auth.uid()
    )
  );

CREATE POLICY "proposal_comments_insert" ON proposal_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.proposals
        WHERE proposals.id = proposal_comments.proposal_id
          AND proposals.created_by = auth.uid()
      )
    )
  );

-- =============================================================
-- 22. visa_compliance_rules (read-only lookup table)
-- =============================================================
ALTER TABLE visa_compliance_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visa_rules_select" ON visa_compliance_rules;

CREATE POLICY "visa_rules_select" ON visa_compliance_rules
  FOR SELECT TO authenticated
  USING (true);

-- =============================================================
-- 23. travel_time_cache (read-only lookup table)
-- =============================================================
ALTER TABLE travel_time_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "travel_cache_select" ON travel_time_cache;

CREATE POLICY "travel_cache_select" ON travel_time_cache
  FOR SELECT TO authenticated
  USING (true);

-- Service role can insert/update cache entries
CREATE POLICY "travel_cache_upsert" ON travel_time_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================
-- VERIFICATION QUERIES (run after applying to confirm)
-- =============================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
