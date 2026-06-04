-- ============================================================
-- Add accounts and operations roles, and manager hierarchy
-- ============================================================

-- 1. Expand role CHECK constraint to include 'accounts' and 'operations'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('agent', 'manager', 'accounts', 'operations', 'super_admin'));

-- 2. Add manager_id to link agents to their managers
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Add index for fast manager->agents queries
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);

-- 4. Add constraint: only agents can have a manager
ALTER TABLE users ADD CONSTRAINT users_agents_only_have_manager
  CHECK ((role = 'agent' AND manager_id IS NOT NULL) OR (role IN ('manager', 'accounts', 'operations', 'super_admin') AND manager_id IS NULL));

-- 5. Create role_permissions table for fine-grained access control
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('agent', 'manager', 'accounts', 'operations', 'super_admin')),
  permission TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(role, permission)
);

-- 6. Seed role_permissions with default permissions
INSERT INTO role_permissions (role, permission, description) VALUES
-- Agent permissions
('agent', 'create_booking', 'Can create offline bookings'),
('agent', 'submit_payment_request', 'Can submit payment requests to manager'),
('agent', 'record_vendor_confirmation', 'Can record vendor confirmations'),
('agent', 'send_voucher', 'Can send vouchers to clients'),
('agent', 'view_own_bookings', 'Can view only their own bookings'),

-- Manager permissions
('manager', 'approve_payment', 'Can approve/reject payment requests'),
('manager', 'view_team_payments', 'Can view team payment requests'),
('manager', 'view_team_bookings', 'Can view team bookings'),
('manager', 'view_financial_reports', 'Can view financial reports'),

-- Accounts permissions
('accounts', 'execute_payment', 'Can execute approved payments'),
('accounts', 'upload_payment_screenshot', 'Can upload payment screenshots'),
('accounts', 'reconcile_payments', 'Can reconcile payments'),
('accounts', 'view_all_payments', 'Can view all payment records'),

-- Operations permissions
('operations', 'manage_suppliers', 'Can add/edit/delete suppliers'),
('operations', 'view_all_bookings', 'Can view all bookings'),
('operations', 'view_all_payments', 'Can view all payments'),
('operations', 'vendor_escalation', 'Can handle vendor escalations'),

-- Super admin permissions
('super_admin', 'manage_users', 'Can manage all users and roles'),
('super_admin', 'view_all_data', 'Can view all system data'),
('super_admin', 'system_settings', 'Can manage system settings')
ON CONFLICT (role, permission) DO NOTHING;
