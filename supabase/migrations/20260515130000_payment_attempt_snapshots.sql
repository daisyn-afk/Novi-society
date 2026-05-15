-- Per-attempt input snapshotting + sequencing for payment_transactions.
--
-- Adds the fields needed to satisfy:
--   - Every "Pay" click yields a new row (already true; now explicit).
--   - The exact request payload is preserved at the moment of attempt.
--   - Client-side click time vs server-receive time can be compared to detect
--     stale frontend state.
--   - Attempts can be sequenced per (customer_email, payment_flow) so support
--     can answer "this user tried 5 times in 10 minutes".
--
-- All columns are nullable to keep the migration safe to run on a database
-- that already contains rows from the previous schema version.

alter table if exists public.payment_transactions
  add column if not exists attempt_number integer,
  add column if not exists selected_item_id text,
  add column if not exists request_payload_snapshot jsonb,
  add column if not exists client_timestamp timestamptz,
  add column if not exists server_received_timestamp timestamptz;

create index if not exists idx_payment_transactions_selected_item_id
  on public.payment_transactions(selected_item_id);

create index if not exists idx_payment_transactions_customer_flow_attempt
  on public.payment_transactions(customer_email, payment_flow, attempt_number desc);
