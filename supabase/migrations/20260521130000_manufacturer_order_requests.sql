-- Provider order / rep contact requests from the supplier marketplace.

create table if not exists public.manufacturer_order_requests (
  id                uuid primary key default gen_random_uuid(),
  manufacturer_id   uuid not null references public.manufacturers(id) on delete cascade,
  manufacturer_name text,

  provider_id       uuid,
  provider_email    text,
  provider_name     text,
  practice_name     text,

  contact_type      text not null default 'order',
  subject           text,
  message           text,
  order_items       jsonb not null default '[]'::jsonb,

  rep_email         text,
  status            text not null default 'submitted',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists manufacturer_order_requests_manufacturer_idx
  on public.manufacturer_order_requests (manufacturer_id);

create index if not exists manufacturer_order_requests_provider_idx
  on public.manufacturer_order_requests (provider_id);

create index if not exists manufacturer_order_requests_created_idx
  on public.manufacturer_order_requests (created_at desc);
