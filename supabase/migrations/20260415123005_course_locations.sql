create extension if not exists pgcrypto;

create table if not exists public.course_locations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  venue_name text not null,
  street_address text,
  city text not null,
  state text not null,
  zip_code text,
  is_active boolean not null default true
);

create index if not exists idx_course_locations_lookup
on public.course_locations (lower(venue_name), lower(city), lower(state));

create or replace function public.set_course_locations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_course_locations_updated_at on public.course_locations;
create trigger trg_course_locations_updated_at
before update on public.course_locations
for each row execute function public.set_course_locations_updated_at();
