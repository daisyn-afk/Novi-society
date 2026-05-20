-- Track migrated-user password setup for admin-triggered reset emails.

alter table public.users
  add column if not exists password_setup_status text,
  add column if not exists password_reset_email_sent_at timestamptz,
  add column if not exists password_reset_link_issued_at timestamptz,
  add column if not exists password_reset_completed_at timestamptz;

alter table public.users
  drop constraint if exists users_password_setup_status_check;

alter table public.users
  add constraint users_password_setup_status_check
  check (
    password_setup_status is null
    or password_setup_status in ('password_reset_pending', 'password_created_successfully')
  );

create index if not exists idx_users_password_setup_status
  on public.users(password_setup_status)
  where password_setup_status is not null;
