-- Patient-level GFE validity by treatment category (appointments only).

create table if not exists public.patient_gfe_validations (
  id text primary key default ('pgfe_' || md5(random()::text || clock_timestamp()::text)),
  patient_id text not null,
  gfe_category text not null,
  status text not null default 'approved',
  completed_at timestamptz not null,
  expires_at timestamptz not null,
  source_appointment_id text null,
  qualiphy_patient_exam_id text null,
  platform_fee_collected_at timestamptz null,
  fee_appointment_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patient_gfe_validations_patient_category
  on public.patient_gfe_validations (patient_id, gfe_category);

create index if not exists idx_patient_gfe_validations_expires
  on public.patient_gfe_validations (patient_id, gfe_category, expires_at desc)
  where status = 'approved';

-- Backfill from approved appointment GFEs (appointments scope only).
insert into public.patient_gfe_validations (
  patient_id,
  gfe_category,
  status,
  completed_at,
  expires_at,
  source_appointment_id,
  qualiphy_patient_exam_id,
  platform_fee_collected_at,
  fee_appointment_id
)
select distinct on (a.patient_id, lower(trim(coalesce(st.category, 'other'))))
  a.patient_id,
  lower(trim(coalesce(st.category, 'other'))),
  'approved',
  a.gfe_completed_at,
  a.gfe_completed_at + interval '365 days',
  a.id,
  a.qualiphy_patient_exam_id,
  case
    when a.treatment_payment_status = 'paid'
      and coalesce(st.requires_gfe, false) = true
    then coalesce(a.treatment_paid_at, a.updated_at, a.gfe_completed_at)
    else null
  end,
  case
    when a.treatment_payment_status = 'paid'
      and coalesce(st.requires_gfe, false) = true
    then a.id
    else null
  end
from public.appointments a
left join public.service_type st on st.id::text = a.service_type_id::text
where a.patient_id is not null
  and lower(coalesce(a.gfe_status, '')) = 'approved'
  and a.gfe_completed_at is not null
  and trim(coalesce(st.category, '')) <> ''
order by a.patient_id, lower(trim(coalesce(st.category, 'other'))), a.gfe_completed_at desc;
