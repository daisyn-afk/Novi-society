create extension if not exists pgcrypto;

create table if not exists public.class_code_redemption (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_session(id) on delete cascade,
  course_id uuid,
  session_date date,
  enrollment_id text,
  provider_auth_id uuid,
  provider_user_id uuid,
  provider_id uuid,
  provider_email text,
  redeemed_at timestamptz not null default now()
);

create index if not exists idx_class_code_redemption_session
  on public.class_code_redemption(class_session_id);

create index if not exists idx_class_code_redemption_course_date
  on public.class_code_redemption(course_id, session_date);

create index if not exists idx_class_code_redemption_provider_auth
  on public.class_code_redemption(class_session_id, provider_auth_id)
  where provider_auth_id is not null;

create index if not exists idx_class_code_redemption_provider_email
  on public.class_code_redemption(class_session_id, lower(provider_email))
  where provider_email is not null;

-- Best-effort backfill: shared class_date sessions marked code_used with attended enrollments.
insert into public.class_code_redemption (
  class_session_id,
  course_id,
  session_date,
  enrollment_id,
  provider_id,
  provider_email,
  redeemed_at
)
select distinct on (cs.id, e.id)
  cs.id,
  cs.course_id,
  cs.session_date,
  e.id::text,
  e.provider_id,
  lower(nullif(trim(e.provider_email), '')),
  coalesce(cs.code_used_at, now())
from public.class_session cs
inner join public.enrollments e
  on e.course_id = cs.course_id
 and e.session_date::date = cs.session_date::date
 and lower(coalesce(e.status, '')) in ('attended', 'completed')
where cs.enrollment_id like 'class_date:%'
  and cs.code_used = true
  and not exists (
    select 1
    from public.class_code_redemption r
    where r.class_session_id = cs.id
      and (
        r.enrollment_id = e.id::text
        or (
          r.provider_id is not null
          and e.provider_id is not null
          and r.provider_id = e.provider_id
        )
        or (
          r.provider_email is not null
          and e.provider_email is not null
          and lower(r.provider_email) = lower(e.provider_email)
        )
      )
  );
