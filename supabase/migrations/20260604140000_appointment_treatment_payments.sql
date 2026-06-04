-- Treatment balance payments after service (separate from booking deposit).

alter table if exists public.appointments
  add column if not exists treatment_amount numeric,
  add column if not exists treatment_payment_status text not null default 'unpaid',
  add column if not exists treatment_paid_at timestamptz,
  add column if not exists treatment_stripe_session_id text,
  add column if not exists treatment_invoice jsonb;

create index if not exists idx_appointments_treatment_stripe_session_id
  on public.appointments (treatment_stripe_session_id)
  where treatment_stripe_session_id is not null;
