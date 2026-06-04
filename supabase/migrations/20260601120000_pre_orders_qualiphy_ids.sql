-- Link Qualiphy exam callbacks to model signups (pre_orders).
alter table if exists public.pre_orders
  add column if not exists qualiphy_meeting_uuid text,
  add column if not exists qualiphy_patient_exam_id text;

create index if not exists idx_pre_orders_qualiphy_meeting_uuid
  on public.pre_orders (qualiphy_meeting_uuid)
  where qualiphy_meeting_uuid is not null;

create index if not exists idx_pre_orders_qualiphy_patient_exam_id
  on public.pre_orders (qualiphy_patient_exam_id)
  where qualiphy_patient_exam_id is not null;