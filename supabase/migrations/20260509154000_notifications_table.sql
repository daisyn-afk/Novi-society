create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id text primary key default ('notif_' || replace(gen_random_uuid()::text, '-', '')),
  user_id text null,
  user_email text null,
  type text null,
  message text not null,
  link_page text null,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id
  on public.notifications(user_id);

create index if not exists idx_notifications_user_email
  on public.notifications(lower(user_email));

create index if not exists idx_notifications_created_at
  on public.notifications(created_at desc);
