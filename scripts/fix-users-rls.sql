-- Fix: "infinite recursion detected in policy for relation users"
--
-- The cloned DB's users-table policy checks admin status by querying the
-- users table inside its own policy — infinite recursion, so every profile
-- read fails and the app falls back to the limited agent view.
-- Replace all users policies with safe ones built on the SECURITY DEFINER
-- is_super_admin() helper (which bypasses RLS, breaking the cycle).

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.users', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can see team members (names/roles power assignment
-- pickers, ops boards, comment mentions).
CREATE POLICY users_select_team ON public.users
  FOR SELECT TO authenticated
  USING (true);

-- You can edit yourself; admins can edit anyone.
CREATE POLICY users_update_self_or_admin ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_super_admin())
  WITH CHECK (id = auth.uid() OR is_super_admin());

-- Only admins create/remove team members from the client side.
CREATE POLICY users_insert_admin ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY users_delete_admin ON public.users
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- Verification: should return your row, not an error.
SELECT email, role FROM public.users;
