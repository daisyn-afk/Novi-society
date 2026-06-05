-- Platform-level Stripe Connect settings (legacy Standard account OAuth + fee transfers).

create table if not exists public.platform_stripe_connect_settings (
  id text primary key default 'default',
  legacy_connected_account_id text,
  legacy_account_email text,
  legacy_charges_enabled boolean not null default false,
  legacy_payouts_enabled boolean not null default false,
  legacy_details_submitted boolean not null default false,
  fee_transfer_enabled boolean not null default true,
  connected_at timestamptz,
  connected_by_auth_user_id text,
  updated_at timestamptz not null default now()
);

insert into public.platform_stripe_connect_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.connect_legacy_fee_transfers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_payment_intent_id text not null,
  stripe_charge_id text,
  stripe_transfer_id text,
  legacy_account_id text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending',
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists uq_connect_legacy_fee_transfers_payment_intent
  on public.connect_legacy_fee_transfers (stripe_payment_intent_id);

create index if not exists idx_connect_legacy_fee_transfers_created_at
  on public.connect_legacy_fee_transfers (created_at desc);
