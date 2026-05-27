-- Appointment GFE tracking (Qualiphy invite → completion webhook).

alter table if exists public.appointments
  add column if not exists gfe_meeting_url text,
  add column if not exists gfe_sent_at timestamptz,
  add column if not exists gfe_completed_at timestamptz,
  add column if not exists gfe_provider_name text,
  add column if not exists gfe_questions_answers jsonb not null default '[]'::jsonb;
