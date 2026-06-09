-- Stripe billing fields for NOVI Journey Premium ($19/mo).

alter table public.patient_journeys
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text;

create index if not exists idx_patient_journeys_stripe_subscription
  on public.patient_journeys (stripe_subscription_id)
  where stripe_subscription_id is not null;
