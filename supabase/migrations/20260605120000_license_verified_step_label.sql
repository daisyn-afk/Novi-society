-- Use action-oriented copy for the license verification step (Next Step bar).
update public.launch_roadmap_phases
set steps = (
  select jsonb_agg(
    case
      when step->>'id' = 'license_verified'
        then jsonb_set(step, '{label}', '"Get License Verified by NOVI Admin"'::jsonb)
      else step
    end
    order by ordinality
  )
  from jsonb_array_elements(steps) with ordinality as t(step, ordinality)
)
where phase_id = 'foundation'
  and exists (
    select 1
    from jsonb_array_elements(steps) step
    where step->>'id' = 'license_verified'
      and step->>'label' = 'License Verified by NOVI Admin'
  );
