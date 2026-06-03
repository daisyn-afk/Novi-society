-- Launch roadmap phase definitions (Foundation, Activation, Growth).
-- Global catalog — same steps for all providers.
-- Per-provider completion state lives in provider_launch_roadmap_progress.
-- Interactive-tool steps stay in static frontend config and are merged at read time.

create table if not exists public.launch_roadmap_phases (
  id uuid primary key default gen_random_uuid(),
  phase_id text not null unique,
  label text not null,
  description text not null,
  color text not null,
  text_color text not null,
  icon text not null,
  sort_order integer not null default 0,
  steps jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint launch_roadmap_phases_steps_array check (jsonb_typeof(steps) = 'array')
);

create index if not exists idx_launch_roadmap_phases_sort
  on public.launch_roadmap_phases (sort_order, phase_id);

drop trigger if exists trg_launch_roadmap_phases_updated_at on public.launch_roadmap_phases;
create trigger trg_launch_roadmap_phases_updated_at
before update on public.launch_roadmap_phases
for each row execute function public.set_updated_at_timestamp();
