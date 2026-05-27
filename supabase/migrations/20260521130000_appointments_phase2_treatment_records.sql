-- Phase 2–4: appointment workflow fields + treatment records for MD review.

alter table if exists public.appointments
  add column if not exists confirmed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists notes text,
  add column if not exists gfe_status text default 'not_required',
  add column if not exists gfe_exam_url text,
  add column if not exists gfe_initiated_at timestamptz,
  add column if not exists treatment_record_id uuid;

create table if not exists public.treatment_records (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  provider_id text not null,
  provider_email text,
  provider_name text,
  patient_id text,
  patient_email text,
  patient_name text,
  service text,
  treatment_date date,
  areas_treated jsonb not null default '[]'::jsonb,
  products_used jsonb not null default '[]'::jsonb,
  units_used text,
  units_label text default 'units',
  clinical_notes text,
  adverse_reaction boolean not null default false,
  adverse_reaction_notes text,
  before_photo_urls jsonb not null default '[]'::jsonb,
  after_photo_urls jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  md_review_notes text,
  md_reviewed_by text,
  md_reviewed_at timestamptz,
  gfe_status text,
  gfe_exam_url text,
  gfe_provider_name text,
  gfe_questions_answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_treatment_records_provider_id on public.treatment_records (provider_id);
create index if not exists idx_treatment_records_patient_id on public.treatment_records (patient_id);
create index if not exists idx_treatment_records_appointment_id on public.treatment_records (appointment_id);
create index if not exists idx_treatment_records_status on public.treatment_records (status);

drop trigger if exists trg_treatment_records_updated_at on public.treatment_records;
create trigger trg_treatment_records_updated_at
before update on public.treatment_records
for each row execute function public.set_updated_at_timestamp();
