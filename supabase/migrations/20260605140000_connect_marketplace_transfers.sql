-- Idempotent provider + legacy split transfers after platform-owned marketplace charges.

create table if not exists public.connect_marketplace_transfers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_payment_intent_id text not null,
  transfer_purpose text not null,
  destination_account_id text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  stripe_transfer_id text,
  status text not null default 'pending',
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists uq_connect_marketplace_transfers_pi_purpose
  on public.connect_marketplace_transfers (stripe_payment_intent_id, transfer_purpose);

create index if not exists idx_connect_marketplace_transfers_created_at
  on public.connect_marketplace_transfers (created_at desc);
