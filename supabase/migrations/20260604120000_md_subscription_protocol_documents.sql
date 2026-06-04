-- Snapshot protocol documents on MD coverage sign-up (read-only for providers in Documents).

alter table if exists public.md_subscription
  add column if not exists protocol_document_urls jsonb not null default '[]'::jsonb;

comment on column public.md_subscription.protocol_document_urls is
  'Protocol documents for this service at sign-up; shown in provider Documents (no signature required).';
