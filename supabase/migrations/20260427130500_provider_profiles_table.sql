create or replace function public.set_updated_at_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  dob date,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  onboarding_completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_profiles_user_id on public.provider_profiles(user_id);

drop trigger if exists trg_provider_profiles_updated_at on public.provider_profiles;
create trigger trg_provider_profiles_updated_at
before update on public.provider_profiles
for each row execute function public.set_updated_at_timestamp();
