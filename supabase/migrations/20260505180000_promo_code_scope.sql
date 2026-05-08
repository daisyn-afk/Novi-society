alter table if exists public.course_promo_codes
  add column if not exists applies_to text;

update public.course_promo_codes
set applies_to = 'course'
where applies_to is null;

alter table if exists public.course_promo_codes
  alter column applies_to set default 'course';

alter table if exists public.course_promo_codes
  drop constraint if exists course_promo_codes_applies_to_check;

alter table if exists public.course_promo_codes
  add constraint course_promo_codes_applies_to_check
  check (applies_to in ('course', 'model'));

create index if not exists idx_course_promo_codes_applies_to
  on public.course_promo_codes(applies_to);
