-- Model admin list / PATCH (`backend/admin/pre-orders/repository.js` SELECT_COLUMNS) expects these columns.
alter table if exists public.pre_orders
  add column if not exists attendance_confirmed boolean not null default false,
  add column if not exists attendance_confirmed_at timestamptz;
