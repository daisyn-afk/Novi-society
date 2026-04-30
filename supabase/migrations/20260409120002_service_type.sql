create table if not exists public.service_type (
  id text primary key,
  name text not null,
  category text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_type_name on public.service_type (name);
