-- OAuth tokens for provider Google Calendar (Schedule Call sends invites from provider email).

create table if not exists public.provider_google_calendar_connections (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null unique,
  google_email    text not null,
  access_token    text not null,
  refresh_token   text,
  token_expiry    timestamptz,
  scopes          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists provider_google_calendar_connections_provider_idx
  on public.provider_google_calendar_connections (provider_id);
