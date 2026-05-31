-- Patient ↔ Provider appointment messaging (thread_id = appointment id or pre-{provider_id})

create table if not exists public.appointment_messages (
  id              uuid        primary key default gen_random_uuid(),
  thread_id       text        not null,
  appointment_id  text        not null,
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

create index if not exists idx_appointment_messages_thread_id on public.appointment_messages(thread_id);
create index if not exists idx_appointment_messages_sender_id on public.appointment_messages(sender_id);
create index if not exists idx_appointment_messages_recipient_id on public.appointment_messages(recipient_id);
create index if not exists idx_appointment_messages_created_at on public.appointment_messages(created_at);
