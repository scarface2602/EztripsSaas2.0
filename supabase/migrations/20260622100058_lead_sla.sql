-- ============================================================
-- Lead first-response SLA
--
-- first_responded_at: set the first time anyone logs an activity on a lead.
-- sla_breached_at: stamped by the lead-sla cron when a lead crosses the
-- org's first-response window without a touch. Leads surface in
-- "action needed" order so nothing falls through silently.
-- ============================================================

ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS first_responded_at timestamptz;
ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS sla_breached_at timestamptz;

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS lead_sla_minutes integer NOT NULL DEFAULT 30;

-- Backfill: the earliest logged activity counts as the first response.
UPDATE website_enquiries e
SET first_responded_at = a.first_at
FROM (
  SELECT enquiry_id, MIN(created_at) AS first_at
  FROM enquiry_activities
  GROUP BY enquiry_id
) a
WHERE a.enquiry_id = e.id AND e.first_responded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enquiries_sla
  ON website_enquiries (created_at)
  WHERE first_responded_at IS NULL AND sla_breached_at IS NULL;
