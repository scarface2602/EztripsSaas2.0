-- ============================================================
-- CRM / Lead Management enhancements
-- ============================================================

-- 1. Expand website_enquiries with CRM fields
alter table website_enquiries
  add column if not exists assigned_to uuid references users(id),
  add column if not exists priority text default 'medium'
    check (priority in ('low','medium','high','urgent')),
  add column if not exists lead_temperature text default 'warm'
    check (lead_temperature in ('hot','warm','cold','lost')),
  add column if not exists follow_up_date date,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists converted_at timestamptz;

-- Expand status options: new → contacted → qualified → proposal_sent → won → lost → spam
alter table website_enquiries drop constraint if exists website_enquiries_status_check;
alter table website_enquiries
  add constraint website_enquiries_status_check
  check (status in ('new','contacted','qualified','proposal_sent','won','lost','spam'));

create index if not exists idx_website_enquiries_assigned on website_enquiries(assigned_to);
create index if not exists idx_website_enquiries_follow_up on website_enquiries(follow_up_date);
create index if not exists idx_website_enquiries_priority on website_enquiries(priority);

-- 2. Link proposals to enquiries
alter table proposals
  add column if not exists enquiry_id uuid references website_enquiries(id) on delete set null;
create index if not exists idx_proposals_enquiry on proposals(enquiry_id);

-- 3. Enquiry activity log (CRM interactions)
create table enquiry_activities (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references website_enquiries(id) on delete cascade,
  user_id uuid references users(id),

  type text not null check (type in (
    'call_outgoing','call_incoming','call_missed',
    'whatsapp','email','sms',
    'meeting','site_visit',
    'note','follow_up','status_change'
  )),

  subject text,
  body text,                      -- call notes, message content, etc.
  duration_minutes integer,       -- call/meeting duration
  outcome text,                   -- 'interested','not_interested','callback','no_answer','voicemail'

  -- Follow-up scheduling
  follow_up_date date,
  follow_up_done boolean default false,

  created_at timestamptz not null default now()
);

create index idx_enquiry_activities_enquiry on enquiry_activities(enquiry_id);
create index idx_enquiry_activities_type on enquiry_activities(type);
create index idx_enquiry_activities_created on enquiry_activities(created_at desc);
create index idx_enquiry_activities_follow_up on enquiry_activities(follow_up_date)
  where follow_up_done = false;
