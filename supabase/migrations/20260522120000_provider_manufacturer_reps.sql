-- Provider-assigned manufacturer rep contacts (saved after activation or when rep reaches out).

create table if not exists public.provider_manufacturer_reps (
  id                          uuid primary key default gen_random_uuid(),
  provider_id                 uuid not null,
  manufacturer_id             uuid not null references public.manufacturers(id) on delete cascade,
  manufacturer_application_id uuid references public.manufacturer_applications(id) on delete set null,
  rep_name                    text,
  rep_email                   text not null,
  rep_phone                   text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (provider_id, manufacturer_id)
);

create index if not exists provider_manufacturer_reps_provider_idx
  on public.provider_manufacturer_reps (provider_id);

create index if not exists provider_manufacturer_reps_manufacturer_idx
  on public.provider_manufacturer_reps (manufacturer_id);
