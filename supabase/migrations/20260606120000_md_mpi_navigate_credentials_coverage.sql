-- Point "Add MD to MPI" Next Step to Credentials & Coverage (not Practice profile).
update public.launch_roadmap_phases
set steps = (
  select jsonb_agg(
    case
      when step->>'id' = 'md_mpi'
        then step
          - 'navigate_params'
          || jsonb_build_object('navigate_to', 'ProviderCredentialsCoverage')
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
    where step->>'id' = 'md_mpi'
  );
