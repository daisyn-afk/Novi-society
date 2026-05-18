-- Provider MD Board coverage subscriptions and NOVI-assigned MD links (used by ProviderCredentialsCoverage).

create table if not exists public.md_subscription (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  provider_email text,
  provider_name text,
  service_type_id text not null,
  service_type_name text,
  service_type_monthly_fee numeric,
  status text not null default 'active',
  signed_at timestamptz,
  signed_by_name text,
  activated_at timestamptz,
  enrollment_id text,
  signature_data text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_md_subscription_provider
  on public.md_subscription (provider_id);

create index if not exists idx_md_subscription_service
  on public.md_subscription (service_type_id);

create table if not exists public.medical_director_relationship (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  provider_email text,
  provider_name text,
  medical_director_id text not null,
  medical_director_email text,
  medical_director_name text,
  status text not null default 'active',
  start_date date,
  supervision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_medical_director_relationship_provider
  on public.medical_director_relationship (provider_id);
