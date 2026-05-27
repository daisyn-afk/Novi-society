-- MD Board coverage: Stripe billing lifecycle + audit log (failures, cancellations).

alter table public.md_subscription
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists billing_status text not null default 'pending',
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_notes text,
  add column if not exists cancelled_by_name text,
  add column if not exists last_payment_failed_at timestamptz,
  add column if not exists last_payment_failure_code text,
  add column if not exists last_payment_failure_message text,
  add column if not exists last_stripe_invoice_id text,
  add column if not exists billing_updated_at timestamptz;

create unique index if not exists uq_md_subscription_stripe_subscription_id
  on public.md_subscription (stripe_subscription_id)
  where stripe_subscription_id is not null and stripe_subscription_id <> '';

create index if not exists idx_md_subscription_billing_status
  on public.md_subscription (billing_status);

create index if not exists idx_md_subscription_stripe_checkout_session
  on public.md_subscription (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- Backfill billing_status for existing rows
update public.md_subscription
   set billing_status = case
         when lower(coalesce(status, '')) = 'active' then 'active'
         when lower(coalesce(status, '')) = 'suspended' then 'past_due'
         when lower(coalesce(status, '')) = 'cancelled' then 'cancelled'
         else coalesce(nullif(trim(billing_status), ''), 'active')
       end,
       billing_updated_at = coalesce(billing_updated_at, now())
 where billing_status is null or billing_status = 'pending';

create table if not exists public.md_subscription_billing_event (
  id uuid primary key default gen_random_uuid(),
  md_subscription_id uuid not null references public.md_subscription(id) on delete cascade,
  event_type text not null,
  stripe_event_id text,
  stripe_invoice_id text,
  stripe_subscription_id text,
  failure_code text,
  failure_message text,
  cancellation_reason text,
  cancellation_notes text,
  cancelled_by_name text,
  amount_paid numeric,
  currency text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_md_subscription_billing_event_stripe_event
  on public.md_subscription_billing_event (stripe_event_id)
  where stripe_event_id is not null and stripe_event_id <> '';

create index if not exists idx_md_subscription_billing_event_sub
  on public.md_subscription_billing_event (md_subscription_id, created_at desc);

comment on table public.md_subscription_billing_event is
  'Append-only log of MD coverage billing events (payments, failures, cancellations).';
