-- Patient appointment requests and provider reviews (marketplace Phase 1).

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null,
  patient_email text,
  patient_name text,
  provider_id text not null,
  provider_email text,
  provider_name text,
  service text not null,
  service_type_id text,
  appointment_date date not null,
  appointment_time text default '09:00',
  patient_notes text,
  referral_code text,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_patient_id on public.appointments (patient_id);
create index if not exists idx_appointments_provider_id on public.appointments (provider_id);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_appointment_date on public.appointments (appointment_date desc);

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at_timestamp();

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  patient_id text,
  patient_name text,
  rating numeric not null check (rating >= 1 and rating <= 5),
  comment text,
  is_verified boolean not null default false,
  response text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reviews_provider_id on public.reviews (provider_id);
create index if not exists idx_reviews_is_verified on public.reviews (is_verified);

drop trigger if exists trg_reviews_updated_at on public.reviews;
create trigger trg_reviews_updated_at
before update on public.reviews
for each row execute function public.set_updated_at_timestamp();
