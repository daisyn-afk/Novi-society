create table if not exists public.email_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  trigger      text not null,
  recipient_type text not null default 'provider',
  subject      text not null,
  body_html    text not null default '',
  is_active    boolean not null default true,
  send_delay_minutes integer not null default 0,
  total_sent   integer not null default 0,
  last_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_email_templates_trigger
  on public.email_templates(trigger);

create index if not exists idx_email_templates_is_active
  on public.email_templates(is_active);

-- Auto-update updated_at on row change
create or replace function public.set_email_templates_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_email_templates_updated_at on public.email_templates;
create trigger trg_email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.set_email_templates_updated_at();
