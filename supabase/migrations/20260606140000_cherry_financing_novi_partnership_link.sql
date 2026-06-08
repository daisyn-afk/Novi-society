-- Point Cherry Patient Financing to the NOVI Society partnership onboarding page.
update public.launch_roadmap_phases
set steps = (
  select jsonb_agg(
    case
      when step->>'id' = 'cherry_financing'
        then step || jsonb_build_object('link', 'https://withcherry.com/partnerships/novi-society')
      else step
    end
    order by ordinality
  )
  from jsonb_array_elements(steps) with ordinality as t(step, ordinality)
)
where phase_id = 'activation'
  and exists (
    select 1
    from jsonb_array_elements(steps) step
    where step->>'id' = 'cherry_financing'
  );
