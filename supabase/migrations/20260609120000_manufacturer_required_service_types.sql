-- Link manufacturers to MD memberships (service types) required to apply/purchase.

alter table public.manufacturers
  add column if not exists required_service_type_ids jsonb not null default '[]'::jsonb;

create index if not exists manufacturers_required_service_types_idx
  on public.manufacturers using gin (required_service_type_ids);
