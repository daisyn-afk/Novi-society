-- Phase 5: link reviews to completed appointments (one review per visit).

alter table if exists public.reviews
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

create unique index if not exists idx_reviews_appointment_id_unique
  on public.reviews (appointment_id)
  where appointment_id is not null;

create index if not exists idx_reviews_patient_id on public.reviews (patient_id);
