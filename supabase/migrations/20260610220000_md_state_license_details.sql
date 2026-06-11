-- Per-state MD license details (license number, expiration) + explicit nationwide supervision flag.

alter table public.medical_director_state_license
  add column if not exists license_number text,
  add column if not exists expiration_date date;

alter table public.medical_director_profiles
  add column if not exists supervision_nationwide boolean not null default true;

comment on column public.medical_director_state_license.license_number is
  'State medical license number for this MD in us_state.';

comment on column public.medical_director_state_license.expiration_date is
  'Expiration date for the state license.';

comment on column public.medical_director_profiles.supervision_nationwide is
  'When true, MD is eligible for provider assignment in all states (state matching ignores license rows).';

-- MDs who previously limited supervision via state checkboxes should stay limited.
update public.medical_director_profiles p
set supervision_nationwide = false
where exists (
  select 1
  from public.medical_director_state_license l
  where l.medical_director_id = p.medical_director_id
);
