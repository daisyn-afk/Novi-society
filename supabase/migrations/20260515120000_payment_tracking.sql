-- Centralized payment lifecycle tracking.
--
-- Two tables work together:
--   public.payment_transactions: one row per checkout attempt (current state snapshot).
--   public.payment_events:       append-only log of every lifecycle event we observe
--                                (initiation, redirect, webhook deliveries, failures, refunds, etc.).
--
-- These tables are the source of truth for admin/support investigations:
--   - Failed payments (declined cards, insufficient funds, auth failures, etc.)
--   - Abandoned / expired checkouts
--   - Successful purchases
--   - Stripe processing issues (webhook delivery, async results)
--
-- SECURITY NOTE: we deliberately do NOT store raw card numbers, CVVs, full PANs, or
-- any other PCI-protected data. Only Stripe-provided safe metadata (brand, last4,
-- expiry month/year, billing details) is persisted.

create extension if not exists pgcrypto;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- High level classification of which Stripe checkout flow created this row.
  -- 'course'  -> tuition / course enrollment
  -- 'model'   -> model signup
  -- 'service' -> MD service / pre-launch service purchase
  -- 'other'   -> any future flow (kept open for forward compatibility)
  payment_flow text not null,
  payment_type text,

  -- Current canonical status for this transaction.
  -- 'initiated'        -> we created a Stripe checkout session
  -- 'checkout_opened'  -> user visited the Stripe-hosted page
  -- 'processing'       -> intent created/processing (async settlement)
  -- 'requires_action'  -> 3DS / authentication required
  -- 'succeeded'        -> payment captured successfully
  -- 'failed'           -> declined / card error / auth failed
  -- 'canceled'         -> user canceled / intent canceled
  -- 'expired'          -> checkout session expired without payment
  -- 'refunded'         -> charge refunded (full or partial)
  -- 'disputed'         -> chargeback / dispute opened
  payment_status text not null default 'initiated',

  pre_order_id uuid references public.pre_orders(id) on delete set null,
  course_id uuid,
  service_type_id text,
  item_id text,
  item_name text,

  user_id uuid,
  linked_user_id uuid,
  customer_email text,
  customer_name text,
  customer_phone text,

  amount_subtotal numeric,
  amount_discount numeric,
  amount_total numeric,
  amount_paid numeric,
  currency text default 'usd',

  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_customer_id text,
  stripe_checkout_url text,
  stripe_checkout_status text,
  stripe_payment_status text,

  payment_method_type text,
  card_brand text,
  card_last4 text,
  card_exp_month smallint,
  card_exp_year smallint,
  card_funding text,
  card_country text,

  receipt_email text,
  receipt_url text,

  billing_name text,
  billing_email text,
  billing_phone text,
  billing_address jsonb,

  source_context text,
  source_origin text,
  request_ip text,
  user_agent text,

  failure_code text,
  failure_message text,
  failure_reason text,
  decline_code text,
  last_failure_event_id text,

  metadata jsonb not null default '{}'::jsonb,
  stripe_metadata jsonb not null default '{}'::jsonb,

  initiated_at timestamptz default now(),
  checkout_opened_at timestamptz,
  succeeded_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  expired_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  last_event_at timestamptz,
  last_event_type text
);

create index if not exists idx_payment_transactions_status
  on public.payment_transactions(payment_status);
create index if not exists idx_payment_transactions_flow
  on public.payment_transactions(payment_flow);
create index if not exists idx_payment_transactions_email
  on public.payment_transactions(customer_email);
create index if not exists idx_payment_transactions_pre_order_id
  on public.payment_transactions(pre_order_id);
create unique index if not exists uq_payment_transactions_stripe_session_id
  on public.payment_transactions(stripe_session_id)
  where stripe_session_id is not null;
create index if not exists idx_payment_transactions_payment_intent
  on public.payment_transactions(stripe_payment_intent_id);
create index if not exists idx_payment_transactions_charge
  on public.payment_transactions(stripe_charge_id);
create index if not exists idx_payment_transactions_customer_id
  on public.payment_transactions(stripe_customer_id);
create index if not exists idx_payment_transactions_created_at
  on public.payment_transactions(created_at desc);

drop trigger if exists trg_payment_transactions_updated_at on public.payment_transactions;
create trigger trg_payment_transactions_updated_at
before update on public.payment_transactions
for each row execute function public.set_updated_at_timestamp();


create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  payment_transaction_id uuid references public.payment_transactions(id) on delete cascade,
  pre_order_id uuid references public.pre_orders(id) on delete set null,
  payment_flow text,

  -- Normalized lifecycle event type. Examples:
  --   'initiated'                - we created the Stripe session
  --   'checkout_opened'          - user reached the Stripe checkout page
  --   'session_completed'        - checkout.session.completed
  --   'session_expired'          - checkout.session.expired
  --   'session_async_succeeded'  - checkout.session.async_payment_succeeded
  --   'session_async_failed'     - checkout.session.async_payment_failed
  --   'payment_succeeded'        - payment_intent.succeeded
  --   'payment_failed'           - payment_intent.payment_failed
  --   'payment_canceled'         - payment_intent.canceled
  --   'payment_processing'       - payment_intent.processing
  --   'payment_requires_action'  - payment_intent.requires_action
  --   'charge_succeeded'         - charge.succeeded
  --   'charge_failed'            - charge.failed
  --   'charge_refunded'          - charge.refunded
  --   'charge_dispute_created'   - charge.dispute.created
  event_type text not null,
  event_status text,

  stripe_event_id text,
  stripe_event_type text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_customer_id text,

  payment_method_type text,
  card_brand text,
  card_last4 text,

  amount numeric,
  amount_refunded numeric,
  currency text,

  failure_code text,
  failure_message text,
  failure_reason text,
  decline_code text,

  customer_email text,
  source_context text,

  metadata jsonb not null default '{}'::jsonb,
  raw_event jsonb,

  occurred_at timestamptz
);

create unique index if not exists uq_payment_events_stripe_event_id
  on public.payment_events(stripe_event_id)
  where stripe_event_id is not null;
create index if not exists idx_payment_events_transaction_id
  on public.payment_events(payment_transaction_id);
create index if not exists idx_payment_events_pre_order_id
  on public.payment_events(pre_order_id);
create index if not exists idx_payment_events_session_id
  on public.payment_events(stripe_session_id);
create index if not exists idx_payment_events_intent_id
  on public.payment_events(stripe_payment_intent_id);
create index if not exists idx_payment_events_charge_id
  on public.payment_events(stripe_charge_id);
create index if not exists idx_payment_events_event_type
  on public.payment_events(event_type);
create index if not exists idx_payment_events_created_at
  on public.payment_events(created_at desc);
create index if not exists idx_payment_events_customer_email
  on public.payment_events(customer_email);
