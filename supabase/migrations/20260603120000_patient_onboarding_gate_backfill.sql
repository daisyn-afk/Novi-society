-- Backfill for the new patient onboarding gate.
--
-- Starting with this deploy, any patient whose `patient_journeys.onboarding_completed`
-- is NOT true is hard-redirected into the 6-step PatientOnboarding flow before they
-- can access any other patient-facing page. To avoid trapping existing patients (who
-- signed up before this gate existed) in a forced re-onboarding, we grandfather them
-- in by:
--   1. Flipping every existing patient_journeys row to onboarding_completed = true.
--   2. Inserting a stub completed row for every patient user who doesn't have one yet.
--
-- After this migration runs, only patients who register AFTER this deploy will see
-- the new gate. Existing patients continue uninterrupted.

-- 1. Flip every existing journey row to completed.
update public.patient_journeys
set onboarding_completed = true
where onboarding_completed = false;

-- 2. Create a stub completed journey for every patient user without one.
insert into public.patient_journeys (patient_id, patient_email, onboarding_completed)
select u.id::text, u.email, true
from public.users u
left join public.patient_journeys j on j.patient_id = u.id::text
where u.role = 'patient'
  and j.id is null;
