create extension if not exists pgcrypto;

create table if not exists public.trainer_prep_supply_lists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null unique
);

create table if not exists public.trainer_prep_supply_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  supply_list_id uuid not null references public.trainer_prep_supply_lists(id) on delete cascade,
  item_name text not null,
  purchase_type text not null check (purchase_type in ('every_course', 'one_time')),
  qty integer,
  sort_order integer not null default 0
);

create index if not exists idx_trainer_prep_supply_items_list on public.trainer_prep_supply_items(supply_list_id, sort_order, created_at);

create table if not exists public.trainer_prep_course_progress (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scheduled_course_id uuid not null references public.scheduled_courses(id) on delete cascade,
  supply_item_id uuid not null references public.trainer_prep_supply_items(id) on delete cascade,
  is_checked boolean not null default false,
  checked_at timestamptz,
  unique (scheduled_course_id, supply_item_id)
);

create index if not exists idx_trainer_prep_progress_course on public.trainer_prep_course_progress(scheduled_course_id);

alter table public.template_courses
  add column if not exists trainer_prep_supply_list_id uuid references public.trainer_prep_supply_lists(id) on delete set null;

create or replace function public.set_trainer_prep_supply_lists_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_trainer_prep_supply_lists_updated_at on public.trainer_prep_supply_lists;
create trigger trg_trainer_prep_supply_lists_updated_at
before update on public.trainer_prep_supply_lists
for each row execute function public.set_trainer_prep_supply_lists_updated_at();

create or replace function public.set_trainer_prep_supply_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_trainer_prep_supply_items_updated_at on public.trainer_prep_supply_items;
create trigger trg_trainer_prep_supply_items_updated_at
before update on public.trainer_prep_supply_items
for each row execute function public.set_trainer_prep_supply_items_updated_at();

create or replace function public.set_trainer_prep_course_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_trainer_prep_course_progress_updated_at on public.trainer_prep_course_progress;
create trigger trg_trainer_prep_course_progress_updated_at
before update on public.trainer_prep_course_progress
for each row execute function public.set_trainer_prep_course_progress_updated_at();

with upsert_list as (
  insert into public.trainer_prep_supply_lists (name)
  values ('General Injectable Course Supplies')
  on conflict (name) do update set updated_at = now()
  returning id
)
insert into public.trainer_prep_supply_items (supply_list_id, item_name, purchase_type, qty, sort_order)
select
  (select id from upsert_list),
  x.item_name,
  x.purchase_type,
  x.qty,
  x.sort_order
from (
  values
    ('Neurotoxin (Botox, Xeomin, Dysport, etc.)', 'every_course', null, 1),
    ('Dermal filler (Juvederm, Restylane, etc.)', 'every_course', null, 2),
    ('Bacteriostatic Saline (0.9% Sodium Chloride)', 'every_course', null, 3),
    ('Reconstitution Syringe — 3 mL Luer-Lock syringe', 'every_course', null, 4),
    ('Reconstitution Needle — 23G (Brand: ZIG)', 'every_course', null, 5),
    ('Vial Decapper Tool (13mm / 20mm)', 'one_time', 1, 6),
    ('Insulin Syringes — 31G, 5/16" (8mm), 0.3 cc (standard for neurotoxin)', 'every_course', null, 7),
    ('Alcohol prep pads', 'every_course', null, 8),
    ('White skin marking pencils', 'every_course', null, 9),
    ('Pencil sharpeners', 'one_time', 2, 10),
    ('Numbing Cream', 'every_course', null, 11),
    ('Dental bibs', 'every_course', null, 12),
    ('Face sheets / facial anatomy mapping sheets', 'every_course', null, 13),
    ('Gauze (2x2 or 4x4)', 'every_course', null, 14),
    ('Cotton tip applicators', 'every_course', null, 15),
    ('Handheld mirrors', 'one_time', 4, 16),
    ('Stress squeeze balls', 'one_time', 4, 17),
    ('Disposable draping', 'every_course', null, 18),
    ('Silicone practice faces / injection practice heads', 'one_time', 2, 19),
    ('Sharps containers', 'every_course', null, 20),
    ('Nitrile gloves', 'every_course', null, 21),
    ('Biohazard bags', 'every_course', null, 22)
) as x(item_name, purchase_type, qty, sort_order)
where not exists (
  select 1
  from public.trainer_prep_supply_items existing
  where existing.supply_list_id = (select id from upsert_list)
    and existing.item_name = x.item_name
);

update public.template_courses
set trainer_prep_supply_list_id = (
  select id from public.trainer_prep_supply_lists where name = 'General Injectable Course Supplies' limit 1
)
where trainer_prep_supply_list_id is null;
