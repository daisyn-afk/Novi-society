create table if not exists public.certification (
  id uuid primary key default gen_random_uuid(),
  template_course_id uuid not null references public.template_courses(id) on delete cascade,
  service_type_id text not null references public.service_type(id) on delete restrict,
  service_type_name text,
  cert_name text,
  sort_order integer not null default 0
);

create index if not exists idx_certification_template on public.certification (template_course_id);
create index if not exists idx_certification_service_type on public.certification (service_type_id);
