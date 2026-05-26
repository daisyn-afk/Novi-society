-- Gmail messaging foundation.
--
-- 1. Rename provider_google_calendar_connections -> provider_google_connections
--    so a single OAuth grant per provider stores both Calendar and Gmail
--    scopes. The `scopes` column already exists and tells either feature
--    whether its scope was granted.
--
-- 2. Add provider_rep_gmail_threads — a per-(provider, rep_email) pointer to
--    the Gmail thread that represents that conversation. Message bodies are
--    NOT stored here; they are live-fetched from Gmail on dialog open.

-- 1. Rename connection table.
alter table public.provider_google_calendar_connections
  rename to provider_google_connections;

alter index provider_google_calendar_connections_provider_idx
  rename to provider_google_connections_provider_idx;

-- 2. Thread pointer table.
create table if not exists public.provider_rep_gmail_threads (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null,
  rep_email       text not null,
  manufacturer_id uuid,
  thread_id       text not null,
  last_message_id text,
  last_history_id text,
  last_synced_at  timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (provider_id, rep_email)
);

create index if not exists provider_rep_gmail_threads_provider_idx
  on public.provider_rep_gmail_threads (provider_id);

create index if not exists provider_rep_gmail_threads_thread_idx
  on public.provider_rep_gmail_threads (thread_id);
