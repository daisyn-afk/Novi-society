-- AI "My Journey" state: scans, premium tier, onboarding, check-ins, roadmap (patient-facing).

create table if not exists public.patient_journeys (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null,
  patient_email text,
  tier text not null default 'free',
  subscription_status text,
  onboarding_completed boolean not null default false,
  skin_concerns jsonb not null default '[]'::jsonb,
  treatment_goals jsonb not null default '[]'::jsonb,
  budget_comfort text,
  scans jsonb not null default '[]'::jsonb,
  daily_checkins jsonb not null default '[]'::jsonb,
  roadmap jsonb,
  ai_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_journeys_patient_id_key unique (patient_id)
);

create index if not exists idx_patient_journeys_patient_id on public.patient_journeys (patient_id);

drop trigger if exists trg_patient_journeys_updated_at on public.patient_journeys;
create trigger trg_patient_journeys_updated_at
before update on public.patient_journeys
for each row execute function public.set_updated_at_timestamp();
