create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'course_category_enum') then
    create type public.course_category_enum as enum (
      'botox', 'fillers', 'prp', 'laser', 'chemical_peel',
      'microneedling', 'kybella', 'skincare', 'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'course_level_enum') then
    create type public.course_level_enum as enum ('beginner', 'intermediate', 'advanced');
  end if;
end $$;

create table if not exists public.template_courses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,

  title text not null,
  description text,
  category public.course_category_enum not null default 'other',
  level public.course_level_enum not null default 'beginner',
  price numeric(10,2),
  duration_hours numeric(6,2),
  location text,
  max_seats integer,
  available_seats integer,
  instructor_name text,
  instructor_bio text,
  cover_image_url text,
  syllabus text,
  requirements text,
  what_to_bring text,
  getting_ready_info text,

  pre_course_materials jsonb not null default '[]'::jsonb,
  session_dates jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  is_active boolean not null default true,
  is_featured boolean not null default false,
  platform_coverage text[] not null default '{}'::text[],
  linked_service_type_ids text[] not null default '{}'::text[],
  certification_name text,

  constraint chk_template_pre_materials_array check (jsonb_typeof(pre_course_materials) = 'array'),
  constraint chk_template_session_dates_array check (jsonb_typeof(session_dates) = 'array'),
  constraint chk_template_seats check (
    max_seats is null or available_seats is null or available_seats <= max_seats
  )
);

create index if not exists idx_template_courses_created on public.template_courses (created_at desc);
create index if not exists idx_template_courses_active on public.template_courses (is_active);

create or replace function public.set_template_courses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_template_courses_updated on public.template_courses;
create trigger trg_template_courses_updated
before update on public.template_courses
for each row
execute function public.set_template_courses_updated_at();
