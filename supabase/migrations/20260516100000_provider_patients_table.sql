create table if not exists public.provider_patients (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.users(id) on delete cascade,
  patient_user_id uuid references public.users(id) on delete set null,
  email text not null,
  first_name text,
  last_name text,
  full_name text,
  phone text,
  date_of_birth date,
  gender text,
  is_default_provider boolean not null default true,
  source text not null default 'csv_import'
    check (source in ('csv_import', 'manual')),
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, email)
);

create index if not exists idx_provider_patients_provider_id on public.provider_patients(provider_id);
create index if not exists idx_provider_patients_email on public.provider_patients(email);

drop trigger if exists trg_provider_patients_updated_at on public.provider_patients;
create trigger trg_provider_patients_updated_at
before update on public.provider_patients
for each row execute function public.set_updated_at_timestamp();
