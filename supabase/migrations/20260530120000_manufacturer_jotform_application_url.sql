-- Optional external JotForm URL for supplier applications (Application Routing).

alter table public.manufacturers
  add column if not exists jotform_application_url text;
