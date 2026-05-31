-- Structured pre-booking inquiry answers (marketplace → provider)

alter table public.appointment_messages
  add column if not exists question_key text;

create index if not exists idx_appointment_messages_pre_booking_q
  on public.appointment_messages (thread_id, sender_id, question_key)
  where question_key is not null;
