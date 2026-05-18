create table if not exists public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  phone text,
  city text,
  state text,
  date_of_birth date,
  gender text,
  allergies text,
  current_medications text,
  medical_conditions text,
  health_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patient_profiles_user_id on public.patient_profiles(user_id);

drop trigger if exists trg_patient_profiles_updated_at on public.patient_profiles;
create trigger trg_patient_profiles_updated_at
before update on public.patient_profiles
for each row execute function public.set_updated_at_timestamp();
