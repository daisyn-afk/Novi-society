-- Expand certification table so it can store provider-submitted certifications.
-- Keep template-course fields intact for existing admin/template workflows.

alter table if exists public.certification
  add column if not exists provider_id text,
  add column if not exists provider_email text,
  add column if not exists provider_name text,
  add column if not exists user_id text,
  add column if not exists user_email text,
  add column if not exists user_name text,
  add column if not exists submitted_by_name text,
  add column if not exists submitted_by_email text,
  add column if not exists created_by text,
  add column if not exists created_by_email text,
  add column if not exists certification_name text,
  add column if not exists issued_by text,
  add column if not exists issued_by_email text,
  add column if not exists category text,
  add column if not exists issued_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists certificate_number text,
  add column if not exists status text,
  add column if not exists course_id text,
  add column if not exists enrollment_id text,
  add column if not exists certificate_url text,
  add column if not exists certification_url text,
  add column if not exists certification_file_url text,
  add column if not exists document_url text,
  add column if not exists file_url text,
  add column if not exists attachment_url text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Provider submissions may not map to a template course.
alter table if exists public.certification
  alter column template_course_id drop not null;

-- Some certification submissions can start as "generic" docs and be linked later.
alter table if exists public.certification
  alter column service_type_id drop not null;

-- Sensible defaults for review workflow.
update public.certification
   set status = coalesce(nullif(status, ''), 'pending')
 where status is null or status = '';

-- Helpful indexes for provider/admin lookups.
create index if not exists idx_certification_provider_id on public.certification (provider_id);
create index if not exists idx_certification_provider_email on public.certification (lower(provider_email));
create index if not exists idx_certification_status on public.certification (status);

