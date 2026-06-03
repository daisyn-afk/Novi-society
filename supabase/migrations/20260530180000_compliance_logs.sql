-- Internal compliance / oversight audit trail (admin + MD only; providers never see these).

create table if not exists public.compliance_logs (
  id uuid primary key default gen_random_uuid(),
  provider_id text,
  provider_email text,
  medical_director_id text,
  created_by_id text not null,
  created_by_role text,
  log_type text not null default 'note',
  summary text not null,
  details text,
  action_required boolean not null default false,
  action_taken text,
  resolved_at timestamptz,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_logs_log_type_check check (
    log_type in (
      'supervision_check',
      'chart_review',
      'incident_report',
      'license_review',
      'certification_review',
      'note'
    )
  )
);

create index if not exists idx_compliance_logs_provider_id on public.compliance_logs (provider_id);
create index if not exists idx_compliance_logs_medical_director_id on public.compliance_logs (medical_director_id);
create index if not exists idx_compliance_logs_created_at on public.compliance_logs (created_at desc);
create index if not exists idx_compliance_logs_action_required on public.compliance_logs (action_required) where action_required = true and resolved_at is null;

drop trigger if exists trg_compliance_logs_updated_at on public.compliance_logs;
create trigger trg_compliance_logs_updated_at
before update on public.compliance_logs
for each row execute function public.set_updated_at_timestamp();
