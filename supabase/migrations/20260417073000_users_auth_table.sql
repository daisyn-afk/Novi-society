create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  auth_user_id uuid not null unique,
  email text not null unique,
  first_name text,
  last_name text,
  full_name text,
  role text not null default 'provider' check (role in ('provider', 'patient', 'medical_director', 'admin')),
  is_active boolean not null default true
);

create index if not exists idx_users_auth_user_id on public.users(auth_user_id);
create index if not exists idx_users_role on public.users(role);

create or replace function public.set_users_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_users_updated_at();
