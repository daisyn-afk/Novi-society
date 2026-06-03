-- Store Qualiphy meeting / patient exam IDs for webhook matching when additional_data is missing.

alter table if exists public.appointments
  add column if not exists qualiphy_meeting_uuid text,
  add column if not exists qualiphy_patient_exam_id text;

create index if not exists idx_appointments_qualiphy_meeting_uuid
  on public.appointments (qualiphy_meeting_uuid)
  where qualiphy_meeting_uuid is not null;
