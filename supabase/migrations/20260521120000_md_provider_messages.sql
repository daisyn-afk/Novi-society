-- MD ↔ Provider direct messaging table
-- One row per message. thread_id is computed as [md_auth_id, provider_auth_id].sort().join('-')
-- ensuring exactly one thread per MD-provider pair regardless of who initiates.

create table if not exists public.md_messages (
  id              uuid        primary key default gen_random_uuid(),
  thread_id       text        not null,
  sender_id       text        not null,
  sender_email    text,
  sender_name     text,
  sender_role     text,
  recipient_id    text        not null,
  recipient_email text,
  recipient_name  text,
  message         text        not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_md_messages_thread_id    on public.md_messages(thread_id);
create index if not exists idx_md_messages_sender_id    on public.md_messages(sender_id);
create index if not exists idx_md_messages_recipient_id on public.md_messages(recipient_id);
create index if not exists idx_md_messages_created_at   on public.md_messages(created_at);
