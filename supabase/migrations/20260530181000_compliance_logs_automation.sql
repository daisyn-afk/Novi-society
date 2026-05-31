-- Track manual vs scheduled compliance log creation and dedupe automated runs.

alter table if exists public.compliance_logs
  add column if not exists source text not null default 'manual',
  add column if not exists automated_key text;

alter table if exists public.compliance_logs
  drop constraint if exists compliance_logs_source_check;

alter table if exists public.compliance_logs
  add constraint compliance_logs_source_check check (source in ('manual', 'automated'));

create unique index if not exists idx_compliance_logs_automated_key_open
  on public.compliance_logs (automated_key)
  where automated_key is not null and resolved_at is null;

create index if not exists idx_compliance_logs_source on public.compliance_logs (source);
