alter table if exists public.pre_orders
  add column if not exists gfe_status text,
  add column if not exists gfe_meeting_url text,
  add column if not exists date_of_birth date,
  add column if not exists health_questions jsonb not null default '{}'::jsonb;

create index if not exists idx_pre_orders_gfe_status on public.pre_orders(gfe_status);
