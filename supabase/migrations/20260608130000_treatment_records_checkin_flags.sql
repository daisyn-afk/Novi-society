-- Patient recovery check-ins synced from NOVI Journey + escalation flags.

alter table if exists public.treatment_records
  add column if not exists patient_checkins jsonb not null default '[]'::jsonb,
  add column if not exists has_flagged_checkins boolean not null default false,
  add column if not exists last_checkin_date text,
  add column if not exists last_checkin_stage text;

create index if not exists idx_treatment_records_flagged_checkins
  on public.treatment_records (has_flagged_checkins)
  where has_flagged_checkins = true;
