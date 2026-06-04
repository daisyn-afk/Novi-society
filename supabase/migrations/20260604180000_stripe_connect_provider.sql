-- Stripe Connect Express accounts for provider marketplace payouts.

alter table if exists public.provider_profiles
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_charges_enabled boolean not null default false,
  add column if not exists stripe_connect_payouts_enabled boolean not null default false,
  add column if not exists stripe_connect_details_submitted boolean not null default false,
  add column if not exists stripe_connect_onboarded_at timestamptz;

create index if not exists idx_provider_profiles_stripe_connect_account_id
  on public.provider_profiles (stripe_connect_account_id)
  where stripe_connect_account_id is not null;
