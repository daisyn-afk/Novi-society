create extension if not exists pgcrypto;

create table if not exists public.scheduled_courses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,

  type text not null default 'scheduled' check (type = 'scheduled'),
  template_id uuid not null references public.template_courses(id) on delete restrict,

  title text not null,
  description text,
  category text check (category in ('botox','fillers','prp','laser','chemical_peel','microneedling','kybella','skincare','other')),
  level text check (level in ('beginner','intermediate','advanced')),

  price numeric,
  duration_hours numeric,
  location text,
  max_seats integer,
  available_seats integer check (available_seats is null or max_seats is null or available_seats <= max_seats),

  instructor_name text,
  instructor_bio text,
  cover_image_url text,
  syllabus text,
  requirements text,
  what_to_bring text,
  getting_ready_info text,

  is_active boolean not null default true,
  is_featured boolean not null default false,

  session_dates jsonb not null default '[]'::jsonb,
  certifications_awarded jsonb not null default '[]'::jsonb,
  linked_service_type_ids text[] not null default '{}',
  pre_course_materials jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'
);

create index if not exists idx_scheduled_courses_template_id on public.scheduled_courses(template_id);
create index if not exists idx_scheduled_courses_created_at on public.scheduled_courses(created_at desc);
create index if not exists idx_scheduled_courses_type on public.scheduled_courses(type);

create or replace function public.set_scheduled_courses_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_scheduled_courses_updated_at on public.scheduled_courses;
create trigger trg_scheduled_courses_updated_at
before update on public.scheduled_courses
for each row execute function public.set_scheduled_courses_updated_at();
