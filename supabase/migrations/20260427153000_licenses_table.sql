create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.users(auth_user_id) on delete cascade,
  provider_email text,
  license_type text not null,
  license_number text not null,
  issuing_state text,
  expiration_date date,
  document_url text,
  status text not null default 'pending_review' check (status in ('pending_review', 'verified', 'rejected', 'expired')),
  rejection_reason text,
  verified_at timestamptz,
  verified_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_licenses_provider_id on public.licenses(provider_id);
create index if not exists idx_licenses_status on public.licenses(status);
create index if not exists idx_licenses_created_at on public.licenses(created_at desc);

drop trigger if exists trg_licenses_updated_at on public.licenses;
create trigger trg_licenses_updated_at
before update on public.licenses
for each row execute function public.set_updated_at_timestamp();
