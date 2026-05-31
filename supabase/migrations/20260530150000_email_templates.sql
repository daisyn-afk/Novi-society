-- Email templates catalog.
-- One row per template key (e.g. "license_approved"). Admins edit subject/body/CTA
-- via the AdminEmailTemplates page; the backend always falls back to the in-code
-- templateRegistry defaults if a row is missing or inactive, so transactional
-- emails never silently break.

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  category text not null,
  recipient_type text not null default 'provider',
  subject text not null,
  body_html text not null,
  cta_label text null,
  cta_url_path text null,
  is_active boolean not null default true,
  total_sent integer not null default 0,
  last_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_templates_category
  on public.email_templates (category, template_key);

create index if not exists idx_email_templates_is_active
  on public.email_templates (is_active);

drop trigger if exists trg_email_templates_updated_at on public.email_templates;
create trigger trg_email_templates_updated_at
before update on public.email_templates
for each row execute function public.set_updated_at_timestamp();
