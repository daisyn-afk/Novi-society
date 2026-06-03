-- Scheduled Google Meet calls between providers and manufacturer reps.

create table if not exists public.provider_rep_calls (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid not null,
  manufacturer_id   uuid not null references public.manufacturers(id) on delete cascade,
  manufacturer_name text,

  rep_name          text,
  rep_email         text not null,

  provider_email    text,
  provider_name     text,

  scheduled_at      timestamptz not null,
  duration_minutes  integer not null default 30,
  timezone          text not null,
  topic             text,
  notes             text,

  google_event_id   text,
  meet_link         text,
  status            text not null default 'scheduled',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists provider_rep_calls_provider_idx
  on public.provider_rep_calls (provider_id);

create index if not exists provider_rep_calls_manufacturer_idx
  on public.provider_rep_calls (manufacturer_id);

create index if not exists provider_rep_calls_scheduled_idx
  on public.provider_rep_calls (scheduled_at);
