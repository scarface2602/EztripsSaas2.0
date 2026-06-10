-- ============================================================
-- Add manager role + per-agent max active leads limit
-- ============================================================

-- 1. Expand role CHECK constraint to include 'manager'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('agent', 'manager', 'super_admin'));

-- 2. Add max_active_leads column (applies to agents; default 10)
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_active_leads integer DEFAULT 10;

-- 3. Index for fast "count active leads per agent" queries
CREATE INDEX IF NOT EXISTS idx_enquiries_assigned_status
  ON website_enquiries (assigned_to, status)
  WHERE status IN ('new', 'contacted', 'qualified');
