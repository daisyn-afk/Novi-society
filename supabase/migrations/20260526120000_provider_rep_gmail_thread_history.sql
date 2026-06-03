-- Track every Gmail thread ID seen for a (provider, rep) pair so the UI can
-- list older threads after the user starts a new conversation (the active
-- pointer row still holds only one thread_id).

create table if not exists public.provider_rep_gmail_thread_history (
  id                  uuid primary key default gen_random_uuid(),
  provider_id         uuid not null,
  rep_email           text not null,
  thread_id           text not null,
  subject             text,
  snippet             text,
  last_internal_date  bigint,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider_id, rep_email, thread_id)
);

create index if not exists provider_rep_gmail_thread_history_lookup_idx
  on public.provider_rep_gmail_thread_history (provider_id, rep_email);

create index if not exists provider_rep_gmail_thread_history_sort_idx
  on public.provider_rep_gmail_thread_history (provider_id, rep_email, last_internal_date desc nulls last);
