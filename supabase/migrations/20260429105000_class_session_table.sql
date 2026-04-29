create extension if not exists pgcrypto;

create table if not exists public.class_session (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  enrollment_id text,
  course_id uuid,
  course_title text,
  provider_id uuid,
  provider_name text,
  provider_email text,
  session_date date,
  session_code text not null,
  code_used boolean not null default false,
  code_used_at timestamptz,
  attendance_confirmed boolean not null default false
);

create index if not exists idx_class_session_course_date
  on public.class_session(course_id, session_date);

create unique index if not exists idx_class_session_enrollment_id
  on public.class_session(enrollment_id)
  where enrollment_id is not null;
