-- Per-provider launch roadmap progress (manual step completions).
-- Links each provider (auth user) to their checklist state.
-- Step definitions remain in launch_roadmap_phases (global catalog).

create table if not exists public.provider_launch_roadmap_progress (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.users(auth_user_id) on delete cascade,
  launch_checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_launch_roadmap_progress_provider_unique unique (provider_id),
  constraint provider_launch_roadmap_progress_checklist_object check (jsonb_typeof(launch_checklist) = 'object')
);

create index if not exists idx_provider_launch_roadmap_progress_provider
  on public.provider_launch_roadmap_progress (provider_id);

drop trigger if exists trg_provider_launch_roadmap_progress_updated_at on public.provider_launch_roadmap_progress;
create trigger trg_provider_launch_roadmap_progress_updated_at
before update on public.provider_launch_roadmap_progress
for each row execute function public.set_updated_at_timestamp();
