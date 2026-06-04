-- Provider landing choices: email + path selected before/during signup.
create table if not exists public.provider_join_choices (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  choice text not null,
  auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_join_choices_choice_check
    check (choice in ('need_training', 'need_md_coverage', 'explore_skip'))
);

create unique index if not exists idx_provider_join_choices_email
  on public.provider_join_choices (email);

create index if not exists idx_provider_join_choices_choice
  on public.provider_join_choices (choice);
