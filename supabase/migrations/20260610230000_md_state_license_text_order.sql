-- Preserve exact expiration text from clinic sheets and keep upload row order.

alter table public.medical_director_state_license
  alter column expiration_date type text using expiration_date::text;

alter table public.medical_director_state_license
  add column if not exists sort_order integer not null default 0;

comment on column public.medical_director_state_license.expiration_date is
  'Expiration date as entered (e.g. 12/31/2026, 4/30/27, or -). Stored verbatim.';

comment on column public.medical_director_state_license.sort_order is
  'Row order from MD upload or manual entry; lower = earlier in the list.';
