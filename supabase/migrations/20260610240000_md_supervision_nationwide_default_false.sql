-- New MD profiles should not imply nationwide supervision until explicitly enabled.

alter table public.medical_director_profiles
  alter column supervision_nationwide set default false;

comment on column public.medical_director_profiles.supervision_nationwide is
  'When true, MD is eligible for provider assignment in all states. When false, requires per-state license rows with license numbers (or MD is not assignable until configured).';
