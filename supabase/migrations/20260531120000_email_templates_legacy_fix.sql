-- Repair email_templates tables that predate the templateRegistry schema.
--
-- Older installs (the original base44 build) shipped extra NOT NULL columns
-- such as "trigger" with no default. The new AdminEmailTemplates upsert does
-- not know about those columns, so every save failed with:
--   null value in column "trigger" ... violates not-null constraint
--
-- This migration is idempotent and non-destructive:
--   1. Ensures every column the current code expects exists.
--   2. Relaxes NOT NULL on any *legacy* column the code never populates, so
--      inserts succeed without dropping the column or losing data.

-- 1. Ensure all expected columns exist (no-op if already present).
alter table public.email_templates
  add column if not exists template_key   text,
  add column if not exists name           text,
  add column if not exists category       text,
  add column if not exists recipient_type text default 'provider',
  add column if not exists subject        text,
  add column if not exists body_html      text,
  add column if not exists cta_label      text,
  add column if not exists cta_url_path   text,
  add column if not exists is_active      boolean default true,
  add column if not exists total_sent     integer default 0,
  add column if not exists last_sent_at   timestamptz,
  add column if not exists created_at     timestamptz default now(),
  add column if not exists updated_at     timestamptz default now();

-- 2. Drop NOT NULL on any legacy column the new code never writes.
do $$
declare
  col record;
  known text[] := array[
    'id','template_key','name','category','recipient_type','subject',
    'body_html','cta_label','cta_url_path','is_active','total_sent',
    'last_sent_at','created_at','updated_at'
  ];
begin
  for col in
    select column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'email_templates'
       and is_nullable = 'NO'
       and column_default is null
       and not (column_name = any(known))
  loop
    execute format(
      'alter table public.email_templates alter column %I drop not null',
      col.column_name
    );
    raise notice 'Relaxed NOT NULL on legacy column %', col.column_name;
  end loop;
end$$;
