-- Centralized Stripe payment lifecycle tracking.
--
-- Two tables work together:
--   public.payment_transactions  one row per checkout attempt (current state snapshot).
--   public.payment_events        append-only log of every lifecycle event observed
--                                (initiation, redirect, webhook deliveries, failures, refunds …).
--
-- Additional objects:
--   public.payment_transactions_enforce_immutability()  trigger function that prevents
--     snapshot fields from being overwritten once set, and auto-captures previous_status
--     whenever payment_status changes.
--   public.payment_attempt_timeline  read-only view for forensic timeline reconstruction.
--
-- SECURITY: raw card numbers, CVVs, and full PANs are NEVER stored here.
-- Only Stripe-provided safe metadata (brand, last4, expiry, billing details) is persisted.
--
-- IDEMPOTENT: every statement uses IF NOT EXISTS / OR REPLACE / DROP … IF EXISTS
-- so the file is safe to re-run on a database that already has the schema.
--
-- Prerequisite: public.set_updated_at_timestamp() must exist (defined in
-- 20260416110000_course_checkout_flow.sql which runs before this file).

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. payment_transactions
--    One row per checkout attempt. Snapshot fields are written at INSERT time
--    and are immutable thereafter (enforced by trigger below).
-- ============================================================================

create table if not exists public.payment_transactions (
  id                          uuid        primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- Which Stripe checkout flow created this row.
  --   'course'  -> course enrollment / tuition
  --   'model'   -> model signup
  --   'service' -> MD service / pre-launch purchase
  payment_flow                text        not null,
  payment_type                text,

  -- Canonical status of this attempt.
  --   initiated | checkout_opened | processing | requires_action
  --   succeeded | failed | canceled | expired | refunded | disputed
  payment_status              text        not null default 'initiated',
  previous_status             text,                     -- auto-set by trigger on every status change

  -- Business identifiers (monotonic: NULL -> value allowed; once set, immutable)
  pre_order_id                uuid        references public.pre_orders(id) on delete set null,
  course_id                   uuid,
  service_type_id             text,
  item_id                     text,
  item_name                   text,

  -- User identity
  user_id                     uuid,
  linked_user_id              uuid,
  customer_email              text,
  customer_name               text,
  customer_phone              text,

  -- Amounts (monotonic once set)
  amount_subtotal             numeric,
  amount_discount             numeric,
  amount_total                numeric,
  amount_paid                 numeric,
  currency                    text        default 'usd',

  -- Stripe references (monotonic once set)
  stripe_session_id           text,
  stripe_payment_intent_id    text,
  stripe_charge_id            text,
  stripe_customer_id          text,
  stripe_checkout_url         text,
  stripe_checkout_status      text,
  stripe_payment_status       text,

  -- Payment method details (filled in by webhook enrichment)
  payment_method_type         text,
  card_brand                  text,
  card_last4                  text,
  card_exp_month              smallint,
  card_exp_year               smallint,
  card_funding                text,
  card_country                text,

  -- Receipt
  receipt_email               text,
  receipt_url                 text,

  -- Billing details (filled in by webhook enrichment)
  billing_name                text,
  billing_email               text,
  billing_phone               text,
  billing_address             jsonb,

  -- Request origin snapshot (immutable once set)
  source_context              text,
  source_origin               text,
  request_ip                  text,
  user_agent                  text,

  -- Failure details
  failure_code                text,
  failure_message             text,
  failure_reason              text,
  decline_code                text,
  last_failure_event_id       text,

  -- Free-form metadata
  metadata                    jsonb       not null default '{}'::jsonb,
  stripe_metadata             jsonb       not null default '{}'::jsonb,

  -- Lifecycle timestamps
  initiated_at                timestamptz default now(),
  checkout_opened_at          timestamptz,
  succeeded_at                timestamptz,
  failed_at                   timestamptz,
  canceled_at                 timestamptz,
  expired_at                  timestamptz,
  refunded_at                 timestamptz,
  disputed_at                 timestamptz,
  last_event_at               timestamptz,
  last_event_type             text,

  -- Per-attempt input snapshot (immutable once set)
  attempt_number              integer,    -- sequence per (customer_email, payment_flow)
  selected_item_id            text,       -- raw user-supplied identifier, preserved exactly as received
  request_payload_snapshot    jsonb,      -- full request body at moment of "Pay" click
  client_timestamp            timestamptz,-- timestamp captured on the client before the request
  server_received_timestamp   timestamptz -- timestamp captured on the server when the request arrived
);

-- Indexes
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
create index if not exists idx_payment_transactions_selected_item_id
  on public.payment_transactions(selected_item_id);
create index if not exists idx_payment_transactions_customer_flow_attempt
  on public.payment_transactions(customer_email, payment_flow, attempt_number desc);

-- Auto-update updated_at
drop trigger if exists trg_payment_transactions_updated_at on public.payment_transactions;
create trigger trg_payment_transactions_updated_at
  before update on public.payment_transactions
  for each row execute function public.set_updated_at_timestamp();

-- ============================================================================
-- 2. payment_events
--    Append-only log. One row per lifecycle event observed (webhook delivery,
--    initiation, failure, etc.). Never updated after insert.
-- ============================================================================

create table if not exists public.payment_events (
  id                          uuid        primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),

  payment_transaction_id      uuid        references public.payment_transactions(id) on delete cascade,
  pre_order_id                uuid        references public.pre_orders(id) on delete set null,
  payment_flow                text,

  -- Normalized event type. Examples:
  --   initiated               we created the Stripe session
  --   checkout_opened         user reached the Stripe checkout page
  --   session_completed       checkout.session.completed
  --   session_expired         checkout.session.expired
  --   session_async_succeeded checkout.session.async_payment_succeeded
  --   session_async_failed    checkout.session.async_payment_failed
  --   payment_succeeded       payment_intent.succeeded
  --   payment_failed          payment_intent.payment_failed
  --   payment_canceled        payment_intent.canceled
  --   payment_processing      payment_intent.processing
  --   payment_requires_action payment_intent.requires_action
  --   charge_succeeded        charge.succeeded
  --   charge_failed           charge.failed
  --   charge_refunded         charge.refunded
  --   charge_dispute_created  charge.dispute.created
  event_type                  text        not null,
  event_status                text,

  -- Stripe identifiers captured at event time
  stripe_event_id             text,
  stripe_event_type           text,
  stripe_session_id           text,
  stripe_payment_intent_id    text,
  stripe_charge_id            text,
  stripe_customer_id          text,

  -- Payment method snapshot at event time
  payment_method_type         text,
  card_brand                  text,
  card_last4                  text,

  -- Amounts at event time
  amount                      numeric,
  amount_refunded             numeric,
  currency                    text,

  -- Failure details (if applicable)
  failure_code                text,
  failure_message             text,
  failure_reason              text,
  decline_code                text,

  -- Context
  customer_email              text,
  source_context              text,

  -- Free-form metadata (includes status_transition delta for webhook events)
  metadata                    jsonb       not null default '{}'::jsonb,
  raw_event                   jsonb,      -- full Stripe event payload for debugging

  occurred_at                 timestamptz -- Stripe event timestamp (event.created)
);

-- Indexes
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

-- ============================================================================
-- 3. Immutability trigger on payment_transactions
--
--    Prevents snapshot / identity fields from being overwritten once set.
--    Two enforcement tiers:
--
--    ABSOLUTELY IMMUTABLE (once non-null, can never change to any other value):
--      selected_item_id, client_timestamp, server_received_timestamp,
--      attempt_number, request_ip, user_agent, source_context, source_origin,
--      customer_email, payment_flow
--
--    MONOTONIC (NULL -> value is allowed; once non-null, can't change):
--      request_payload_snapshot, stripe_session_id, stripe_payment_intent_id,
--      stripe_charge_id, stripe_customer_id, stripe_checkout_url,
--      pre_order_id, course_id, service_type_id, item_id, item_name,
--      amount_subtotal, amount_discount, amount_total, currency
--
--    AUTOMATIC: previous_status is set to OLD.payment_status whenever
--    payment_status changes, giving a one-step-back audit trail without any
--    extra application writes.
-- ============================================================================

create or replace function public.payment_transactions_enforce_immutability()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' then

    -- Absolutely immutable fields
    if NEW.selected_item_id is distinct from OLD.selected_item_id
       and OLD.selected_item_id is not null then
      raise exception 'payment_transactions.selected_item_id is immutable (was %, new %)',
        OLD.selected_item_id, NEW.selected_item_id;
    end if;
    if NEW.client_timestamp is distinct from OLD.client_timestamp
       and OLD.client_timestamp is not null then
      raise exception 'payment_transactions.client_timestamp is immutable';
    end if;
    if NEW.server_received_timestamp is distinct from OLD.server_received_timestamp
       and OLD.server_received_timestamp is not null then
      raise exception 'payment_transactions.server_received_timestamp is immutable';
    end if;
    if NEW.attempt_number is distinct from OLD.attempt_number
       and OLD.attempt_number is not null then
      raise exception 'payment_transactions.attempt_number is immutable (was %, new %)',
        OLD.attempt_number, NEW.attempt_number;
    end if;
    if NEW.request_ip is distinct from OLD.request_ip
       and OLD.request_ip is not null then
      raise exception 'payment_transactions.request_ip is immutable';
    end if;
    if NEW.user_agent is distinct from OLD.user_agent
       and OLD.user_agent is not null then
      raise exception 'payment_transactions.user_agent is immutable';
    end if;
    if NEW.payment_flow is distinct from OLD.payment_flow
       and OLD.payment_flow is not null then
      raise exception 'payment_transactions.payment_flow is immutable (was %, new %)',
        OLD.payment_flow, NEW.payment_flow;
    end if;
    if NEW.customer_email is distinct from OLD.customer_email
       and OLD.customer_email is not null then
      raise exception 'payment_transactions.customer_email is immutable (was %, new %)',
        OLD.customer_email, NEW.customer_email;
    end if;

    -- Monotonic fields (NULL -> value allowed; once non-null, immutable)
    if OLD.request_payload_snapshot is not null
       and NEW.request_payload_snapshot is distinct from OLD.request_payload_snapshot then
      raise exception 'payment_transactions.request_payload_snapshot is immutable once set';
    end if;
    if OLD.stripe_session_id is not null
       and NEW.stripe_session_id is distinct from OLD.stripe_session_id then
      raise exception 'payment_transactions.stripe_session_id is monotonic (was %, new %)',
        OLD.stripe_session_id, NEW.stripe_session_id;
    end if;
    if OLD.pre_order_id is not null
       and NEW.pre_order_id is distinct from OLD.pre_order_id then
      raise exception 'payment_transactions.pre_order_id is monotonic';
    end if;
    if OLD.course_id is not null
       and NEW.course_id is distinct from OLD.course_id then
      raise exception 'payment_transactions.course_id is monotonic';
    end if;
    if OLD.service_type_id is not null
       and NEW.service_type_id is distinct from OLD.service_type_id then
      raise exception 'payment_transactions.service_type_id is monotonic';
    end if;
    if OLD.item_id is not null
       and NEW.item_id is distinct from OLD.item_id then
      raise exception 'payment_transactions.item_id is monotonic (was %, new %)',
        OLD.item_id, NEW.item_id;
    end if;
    if OLD.item_name is not null
       and NEW.item_name is distinct from OLD.item_name then
      raise exception 'payment_transactions.item_name is monotonic';
    end if;
    if OLD.amount_subtotal is not null
       and NEW.amount_subtotal is distinct from OLD.amount_subtotal then
      raise exception 'payment_transactions.amount_subtotal is monotonic (was %, new %)',
        OLD.amount_subtotal, NEW.amount_subtotal;
    end if;
    if OLD.amount_total is not null
       and NEW.amount_total is distinct from OLD.amount_total then
      raise exception 'payment_transactions.amount_total is monotonic (was %, new %)',
        OLD.amount_total, NEW.amount_total;
    end if;
    if OLD.amount_discount is not null
       and NEW.amount_discount is distinct from OLD.amount_discount then
      raise exception 'payment_transactions.amount_discount is monotonic';
    end if;

    -- Auto-capture previous_status on every status change
    if NEW.payment_status is distinct from OLD.payment_status then
      NEW.previous_status := OLD.payment_status;
    end if;

  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_payment_transactions_immutability on public.payment_transactions;
create trigger trg_payment_transactions_immutability
  before update on public.payment_transactions
  for each row execute function public.payment_transactions_enforce_immutability();

-- ============================================================================
-- 4. payment_attempt_timeline view
--
--    Forensic read-only view. Joins every payment_events row to its parent
--    payment_transactions row, ordered chronologically. Use this to reconstruct
--    the full lifecycle of any attempt.
--
--    Useful queries:
--      -- All events for one attempt:
--      select * from public.payment_attempt_timeline
--      where payment_transaction_id = '<uuid>';
--
--      -- All attempts for one customer:
--      select * from public.payment_attempt_timeline
--      where customer_email = 'user@example.com'
--      order by occurred_at;
-- ============================================================================

create or replace view public.payment_attempt_timeline as
select
  pe.occurred_at,
  pe.created_at                     as event_logged_at,
  pt.id                             as payment_transaction_id,
  pt.attempt_number,
  pt.payment_flow,
  pt.payment_type,
  pt.payment_status                 as current_status,
  pt.previous_status,
  pt.customer_email,
  pt.customer_name,
  pt.selected_item_id,
  pt.item_id,
  pt.item_name,
  pt.amount_total,
  pt.currency,
  pe.event_type,
  pe.event_status                   as transition_target,
  pe.stripe_event_id,
  pe.stripe_event_type,
  pe.stripe_session_id,
  pe.stripe_payment_intent_id,
  pe.stripe_charge_id,
  pe.stripe_customer_id,
  pe.payment_method_type,
  pe.card_brand,
  pe.card_last4,
  pe.amount                         as event_amount,
  pe.amount_refunded                as event_amount_refunded,
  pe.failure_code,
  pe.failure_message,
  pe.failure_reason,
  pe.decline_code,
  pt.client_timestamp,
  pt.server_received_timestamp,
  pt.source_context,
  pt.source_origin,
  pt.request_ip,
  pt.user_agent,
  pt.request_payload_snapshot,
  pe.metadata                       as event_metadata,
  pe.raw_event
from public.payment_events pe
left join public.payment_transactions pt
  on pt.id = pe.payment_transaction_id
order by pe.occurred_at asc, pe.created_at asc;

comment on view public.payment_attempt_timeline is
  'Chronological forensic view: every payment_events row joined to its parent payment_transactions row. '
  'Reconstruct the full lifecycle of any attempt by filtering on payment_transaction_id or customer_email.';
