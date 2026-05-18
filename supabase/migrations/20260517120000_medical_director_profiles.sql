-- Medical director self-service profile (contact, credentials, avatar).

create table if not exists public.medical_director_profiles (
  medical_director_id text primary key,
  phone text,
  city text,
  state text,
  bio text,
  specialty text,
  avatar_url text,
  npi text,
  medical_license_number text,
  license_state text,
  board_certifications text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_medical_director_profiles_updated_at on public.medical_director_profiles;
create trigger trg_medical_director_profiles_updated_at
before update on public.medical_director_profiles
for each row execute function public.set_updated_at_timestamp();

comment on table public.medical_director_profiles is
  'NOVI medical director profile; medical_director_id matches auth user id used in assignments.';
