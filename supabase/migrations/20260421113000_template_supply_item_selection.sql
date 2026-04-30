alter table public.template_courses
  add column if not exists trainer_prep_supply_item_ids uuid[] not null default '{}'::uuid[];
