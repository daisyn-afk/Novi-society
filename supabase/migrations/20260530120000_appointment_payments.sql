-- Patient appointment deposit payments (Stripe Checkout).

alter table if exists public.appointments
  add column if not exists deposit_amount numeric,
  add column if not exists total_amount numeric,
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists consent_signed boolean not null default false,
  add column if not exists duration_minutes integer;

create index if not exists idx_appointments_stripe_session_id
  on public.appointments (stripe_session_id)
  where stripe_session_id is not null;
