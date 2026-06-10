-- Add auto-assignment settings to organisations table
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS auto_assign_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_assign_strategy text NOT NULL DEFAULT 'round_robin'
    CHECK (auto_assign_strategy IN ('round_robin', 'least_loaded')),
  ADD COLUMN IF NOT EXISTS auto_assign_last_agent_id uuid REFERENCES users(id);
