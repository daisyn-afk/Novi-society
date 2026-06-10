-- Record MD Board coverage Stripe charges on md_subscription (prorated checkout + recurring).

alter table if exists public.md_subscription
  add column if not exists checkout_prorated_amount_expected numeric,
  add column if not exists checkout_amount_paid numeric,
  add column if not exists last_amount_paid numeric,
  add column if not exists last_amount_paid_at timestamptz,
  add column if not exists payment_transaction_id uuid references public.payment_transactions(id) on delete set null;

create index if not exists idx_md_subscription_payment_transaction
  on public.md_subscription (payment_transaction_id)
  where payment_transaction_id is not null;

comment on column public.md_subscription.checkout_prorated_amount_expected is
  'UI-estimated prorated first charge for this service (signup day through month-end).';
comment on column public.md_subscription.checkout_amount_paid is
  'Actual amount Stripe charged on initial checkout (prorated first invoice).';
comment on column public.md_subscription.last_amount_paid is
  'Most recent successful Stripe invoice amount for this MD subscription.';
comment on column public.md_subscription.payment_transaction_id is
  'Central payment_transactions row for the checkout attempt.';
