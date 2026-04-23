-- ============================================================
-- Website CMS tables
-- ============================================================

-- 1. website_enquiries
create table website_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  destination text,
  travel_date date,
  date_flexible boolean default false,
  flexibility_days integer,
  adults integer,
  children integer default 0,
  children_ages text,
  budget_range text,
  budget_type text,
  number_of_nights integer,
  hotel_category text,
  special_requirements text,
  whatsapp_opted boolean default false,
  source text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'spam')),
  notes text,
  client_id uuid references clients(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_website_enquiries_status on website_enquiries(status);
create index idx_website_enquiries_created_at on website_enquiries(created_at desc);

-- 2. website_destinations
create table website_destinations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  tagline text,
  description text,
  country text,
  region text,
  tags text[],
  cover_image text,
  gallery text[],
  duration_days integer,
  price_from numeric,
  currency text not null default 'INR',
  is_pilgrimage boolean default false,
  published boolean default false,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. website_blog_posts
create table website_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  content text,
  hero_image text,
  tags text[],
  author text not null default 'EzTrips Team',
  published boolean default false,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. website_packages
create table website_packages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text,
  destination text,
  duration_days integer,
  price_from numeric,
  currency text not null default 'INR',
  cover_image text,
  highlights text[],
  itinerary_days jsonb,
  inclusions text[],
  exclusions text[],
  published boolean default false,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
