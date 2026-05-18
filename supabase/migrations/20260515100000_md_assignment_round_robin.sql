-- Sequential round-robin pointer per service (NOVI Board: multiple MDs covering same service alternate).
create table if not exists public.md_assignment_round_robin (
  service_type_id text primary key,
  seq bigint not null default 0
);

-- Which service activation this supervision row is tied to (analytics + future state rules).
alter table public.medical_director_relationship
  add column if not exists service_type_id text;

create index if not exists idx_medical_director_relationship_service
  on public.medical_director_relationship (service_type_id);


create table if not exists public.medical_director_service_offering (
  medical_director_id text not null,
  service_type_id text not null,
  created_at timestamptz not null default now(),
  primary key (medical_director_id, service_type_id)
);

create index if not exists medical_director_service_offering_service_type_id_idx
  on public.medical_director_service_offering (service_type_id);

comment on table public.medical_director_service_offering is
  'Medical director auth user id (text) to service_type id or * for all services; drives Board MD round-robin.';
