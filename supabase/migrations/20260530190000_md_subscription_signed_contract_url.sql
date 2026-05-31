-- Signed MD Board coverage contract PDF (template + provider signature).

alter table if exists public.md_subscription
  add column if not exists signed_contract_url text;

create index if not exists idx_md_subscription_signed_contract
  on public.md_subscription (provider_id)
  where signed_contract_url is not null;
