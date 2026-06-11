-- Key patient GFE validity by Qualiphy exam code (not service category alone).

alter table public.appointments
  add column if not exists qualiphy_exam_id text null;

alter table public.patient_gfe_validations
  add column if not exists qualiphy_exam_id text null;

create index if not exists idx_patient_gfe_validations_patient_exam
  on public.patient_gfe_validations (patient_id, qualiphy_exam_id)
  where qualiphy_exam_id is not null and status = 'approved';

create index if not exists idx_patient_gfe_validations_patient_exam_expires
  on public.patient_gfe_validations (patient_id, qualiphy_exam_id, expires_at desc)
  where qualiphy_exam_id is not null and status = 'approved';

