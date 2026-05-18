-- MD Board coverage request audit trail (auto-assignment → MD approval).
-- Future: state-based eligibility via medical_director_state_license.

create table if not exists public.md_coverage_request (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  service_type_id text not null,
  medical_director_relationship_id uuid references public.medical_director_relationship(id) on delete set null,
  assigned_medical_director_id text not null,
  assigned_medical_director_email text,
  assigned_medical_director_name text,
  status text not null default 'pending_md_approval',
  assignment_reason text,
  round_robin_seq bigint,
  assignment_index int,
  eligible_count int,
  provider_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_md_coverage_request_provider
  on public.md_coverage_request (provider_id);

create index if not exists idx_md_coverage_request_service
  on public.md_coverage_request (service_type_id);

create index if not exists idx_md_coverage_request_md
  on public.md_coverage_request (assigned_medical_director_id);

create index if not exists idx_md_coverage_request_status
  on public.md_coverage_request (status);

comment on table public.md_coverage_request is
  'NOVI auto-assignment: one row per provider service activation; tracks round-robin metadata and MD approval lifecycle.';

-- Empty table = MD is treated as nationwide (all states). Rows = MD is only eligible in listed states (future).
create table if not exists public.medical_director_state_license (
  medical_director_id text not null,
  us_state text not null,
  created_at timestamptz not null default now(),
  primary key (medical_director_id, us_state)
);

create index if not exists medical_director_state_license_state_idx
  on public.medical_director_state_license (us_state);

comment on table public.medical_director_state_license is
  'Future state filter: MD eligibility by US state. No rows = all states; with rows = only listed states.';

alter table public.medical_director_relationship
  add column if not exists end_date date;
