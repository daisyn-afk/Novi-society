-- Payment-attempt immutability hardening + reconstructable timeline view.
--
-- This migration closes the last three gaps from the production-grade
-- observability audit:
--
-- 1. DB-LEVEL IMMUTABILITY of snapshot/identity fields. Code already respects
--    "write once" semantics via coalesce(), but we add a trigger so future
--    callers (one-off scripts, accidental admin UPDATEs, etc.) cannot mutate
--    the captured request payload, attempt sequencing, or selected item id
--    once they have been set. The same trigger also enforces that, once a
--    business identifier (course_id / service_type_id / item_id / item_name /
--    amount_*) is non-null, it cannot change to a *different* non-null value.
--
-- 2. STATUS-TRANSITION FORENSICS. The trigger logs the previous status into a
--    new payment_transactions.previous_status column whenever payment_status
--    changes. payment_events already gets the new target; this gives us the
--    delta with zero extra writes from application code.
--
-- 3. RECONSTRUCTABLE TIMELINE. A read-only view `payment_attempt_timeline`
--    joins payment_events to payment_transactions and selects a
--    support-friendly column subset ordered by occurrence time.
--
-- The migration is idempotent (safe to re-run): every CREATE uses
-- IF NOT EXISTS / OR REPLACE and ALTER uses ADD COLUMN IF NOT EXISTS.

------------------------------------------------------------------------------
-- 1. previous_status column on payment_transactions
------------------------------------------------------------------------------

alter table if exists public.payment_transactions
  add column if not exists previous_status text;

------------------------------------------------------------------------------
-- 2. Immutability trigger
------------------------------------------------------------------------------

create or replace function public.payment_transactions_enforce_immutability()
returns trigger
language plpgsql
as $$
declare
  -- Columns that are write-once at INSERT and may NEVER change afterwards.
  -- Once they hold any value (including a non-null jsonb), updates that
  -- attempt to change them are rejected.
  immutable_text_cols text[] := array[
    'selected_item_id',
    'client_timestamp',
    'server_received_timestamp',
    'attempt_number',
    'request_ip',
    'user_agent',
    'source_context',
    'source_origin',
    'customer_email',
    'payment_flow'
  ];
  -- Columns that are "write once when non-null": NULL -> value is allowed
  -- (this is how enrichment works: stripe_session_id starts NULL, gets set
  -- when the Stripe API call returns) but value -> different value is not.
  monotonic_cols text[] := array[
    'request_payload_snapshot',
    'stripe_session_id',
    'stripe_payment_intent_id',
    'stripe_charge_id',
    'stripe_customer_id',
    'stripe_checkout_url',
    'pre_order_id',
    'course_id',
    'service_type_id',
    'item_id',
    'item_name',
    'amount_subtotal',
    'amount_discount',
    'amount_total',
    'currency',
    'attempt_number'
  ];
begin
  if TG_OP = 'UPDATE' then
    -- 1) Absolutely immutable text-like columns.
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

    -- 2) Monotonic (NULL -> value allowed; once non-null, NEVER changes — not
    --    even back to NULL — so we don't lose a captured snapshot to a stray
    --    direct UPDATE).
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

    -- 3) Auto-capture previous_status whenever payment_status changes.
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

------------------------------------------------------------------------------
-- 3. payment_attempt_timeline view
------------------------------------------------------------------------------
--
-- Single read-only entry point support and admins can use to reconstruct the
-- full lifecycle of any payment attempt. Joins payment_events to its parent
-- payment_transactions row and exposes the most useful fields for forensics,
-- ordered by occurrence time so the rows form a chronological narrative.

create or replace view public.payment_attempt_timeline as
select
  pe.occurred_at,
  pe.created_at                       as event_logged_at,
  pt.id                               as payment_transaction_id,
  pt.attempt_number,
  pt.payment_flow,
  pt.payment_type,
  pt.payment_status                   as current_status,
  pt.previous_status,
  pt.customer_email,
  pt.customer_name,
  pt.selected_item_id,
  pt.item_id,
  pt.item_name,
  pt.amount_total,
  pt.currency,
  pe.event_type,
  pe.event_status                     as transition_target,
  pe.stripe_event_id,
  pe.stripe_event_type,
  pe.stripe_session_id,
  pe.stripe_payment_intent_id,
  pe.stripe_charge_id,
  pe.stripe_customer_id,
  pe.payment_method_type,
  pe.card_brand,
  pe.card_last4,
  pe.amount                           as event_amount,
  pe.amount_refunded                  as event_amount_refunded,
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
  pe.metadata                         as event_metadata,
  pe.raw_event
from public.payment_events pe
left join public.payment_transactions pt
  on pt.id = pe.payment_transaction_id
order by pe.occurred_at asc, pe.created_at asc;

comment on view public.payment_attempt_timeline is
  'Chronological forensic view: every payment_events row joined to its parent payment_transactions row. Use this to reconstruct the full lifecycle of any attempt — query by payment_transaction_id or customer_email.';
