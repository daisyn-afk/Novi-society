-- Suppliers / Manufacturers shown in the provider marketplace and
-- the application submissions they generate.
--
-- Mirrors the hybrid storage pattern used by public.service_type:
-- typed columns for scalars; jsonb columns for arrays / object arrays
-- that are admin-edited configuration (always read whole).

create extension if not exists "pgcrypto";

create table if not exists public.manufacturers (
  id uuid primary key default gen_random_uuid(),

  -- Display
  name              text not null,
  category          text not null default 'other',
  description       text,
  logo_url          text,
  cover_image_url   text,
  website_url       text,
  products          jsonb not null default '[]'::jsonb,
  benefits          jsonb not null default '[]'::jsonb,
  fda_approved_us_products boolean not null default false,

  -- Sales & Pricing
  sales_headline      text,
  promo_badge         text,
  sales_pitch         text,
  social_proof        text,
  selling_points      jsonb not null default '[]'::jsonb,
  pricing_highlights  jsonb not null default '[]'::jsonb,
  roi_stats           jsonb not null default '[]'::jsonb,

  -- NOVI vs Standalone
  standalone_pricing_note text,
  standalone_access       jsonb not null default '[]'::jsonb,
  novi_pricing_note       text,
  novi_access             jsonb not null default '[]'::jsonb,

  -- Positioning
  training_approved boolean not null default false,
  is_featured       boolean not null default false,
  price_tier        text   not null default 'mid',
  sort_order        int    not null default 0,

  -- Application routing
  account_rep_name  text,
  account_rep_email text,

  -- Network & Contracts
  uses_network_tiers boolean not null default false,
  network_tiers      jsonb not null default '[]'::jsonb,

  -- Application Form Builder
  custom_fields    jsonb not null default '[]'::jsonb,
  required_fields  jsonb not null default '[]'::jsonb,

  -- Business Rules
  min_order_amount numeric(12,2),
  ships_to_states  text,
  is_active        boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manufacturers_active_idx    on public.manufacturers (is_active);
create index if not exists manufacturers_featured_idx  on public.manufacturers (is_featured);
create index if not exists manufacturers_category_idx  on public.manufacturers (category);
create index if not exists manufacturers_sort_idx      on public.manufacturers (sort_order);

create table if not exists public.manufacturer_applications (
  id              uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  manufacturer_name text,

  provider_id     uuid,
  provider_email  text,
  provider_name   text,
  practice_name   text,
  practice_address text,
  practice_phone  text,

  license_type   text,
  license_number text,
  license_state  text,
  supervising_physician_name  text,
  supervising_physician_email text,

  additional_fields jsonb not null default '{}'::jsonb,

  -- 'submitted' | 'under_review' | 'approved' | 'rejected' | 'more_info_needed'
  status text not null default 'submitted',
  admin_notes text,

  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manufacturer_applications_mfr_idx
  on public.manufacturer_applications (manufacturer_id);
create index if not exists manufacturer_applications_provider_idx
  on public.manufacturer_applications (provider_id);
create index if not exists manufacturer_applications_status_idx
  on public.manufacturer_applications (status);
create index if not exists manufacturer_applications_submitted_idx
  on public.manufacturer_applications (submitted_at desc);
