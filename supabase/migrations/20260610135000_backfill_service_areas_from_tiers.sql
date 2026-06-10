-- Move allowed treatment areas (and related scope) from legacy tiers → individual services.
-- Runs before coverage_tiers are cleared on memberships.

do $$
declare
  parent_rec record;
  tier_elem jsonb;
  tier_num int;
  tier_name text;
  tier_areas text[];
  tier_rules jsonb;
  tier_max numeric;
  child_rec record;
begin
  for parent_rec in
    select id, coverage_tiers, allowed_areas, included_service_ids
    from public.service_type
    where coalesce(is_membership, false) = true
      and jsonb_array_length(coalesce(coverage_tiers, '[]'::jsonb)) > 0
  loop
    for tier_elem in
      select value
      from jsonb_array_elements(parent_rec.coverage_tiers)
    loop
      tier_num := coalesce((tier_elem->>'tier_number')::int, 1);
      tier_name := nullif(trim(tier_elem->>'tier_name'), '');
      tier_areas := coalesce(
        (
          select array_agg(trim(value) order by trim(value))
          from jsonb_array_elements_text(coalesce(tier_elem->'allowed_areas', '[]'::jsonb)) as t(value)
          where trim(value) <> ''
        ),
        '{}'::text[]
      );
      if cardinality(tier_areas) = 0 and cardinality(coalesce(parent_rec.allowed_areas, '{}')) > 0 then
        tier_areas := parent_rec.allowed_areas;
      end if;

      tier_rules := coalesce(tier_elem->'scope_rules', '[]'::jsonb);
      tier_max := nullif(tier_elem->>'max_units_per_session', '')::numeric;

      for child_rec in
        select c.id, c.name, c.allowed_areas, c.scope_rules, c.max_units_per_session, c.source_tier_number
        from public.service_type c
        left join lateral (
          select ordinality as pos, value as child_id
          from jsonb_array_elements_text(coalesce(parent_rec.included_service_ids, '[]'::jsonb))
            with ordinality as t(value, ordinality)
        ) inc on inc.child_id = c.id
        where c.legacy_parent_membership_id = parent_rec.id
          and coalesce(c.is_membership, false) = false
          and (
            c.source_tier_number = tier_num
            or (tier_name is not null and lower(trim(c.name)) = lower(tier_name))
            or lower(trim(c.name)) = lower('tier ' || tier_num::text)
            or inc.pos = tier_num
          )
      loop
        update public.service_type
        set
          allowed_areas = case
            when cardinality(coalesce(tier_areas, '{}')) > 0 then (
              select coalesce(array_agg(distinct a order by a), '{}'::text[])
              from (
                select unnest(coalesce(allowed_areas, '{}'::text[])) as a
                union
                select unnest(tier_areas)
              ) merged
              where a is not null and trim(a) <> ''
            )
            else allowed_areas
          end,
          scope_rules = case
            when jsonb_array_length(coalesce(tier_rules, '[]'::jsonb)) > 0
              and jsonb_array_length(coalesce(scope_rules, '[]'::jsonb)) = 0
            then tier_rules
            else scope_rules
          end,
          max_units_per_session = coalesce(max_units_per_session, tier_max)
        where id = child_rec.id;
      end loop;
    end loop;
  end loop;
end $$;

-- Included services with no areas yet: copy membership root allowed_areas.
update public.service_type child
set allowed_areas = parent.allowed_areas
from public.service_type parent
inner join lateral jsonb_array_elements_text(coalesce(parent.included_service_ids, '[]'::jsonb)) as inc(id)
  on true
where coalesce(parent.is_membership, false) = true
  and child.id = inc.id
  and cardinality(coalesce(child.allowed_areas, '{}')) = 0
  and cardinality(coalesce(parent.allowed_areas, '{}')) > 0;

-- Migrated tier children still empty: copy parent membership allowed_areas.
update public.service_type child
set allowed_areas = parent.allowed_areas
from public.service_type parent
where child.legacy_parent_membership_id = parent.id
  and cardinality(coalesce(child.allowed_areas, '{}')) = 0
  and cardinality(coalesce(parent.allowed_areas, '{}')) > 0;

-- Scope is service-level only — clear from membership rows after backfill.
update public.service_type
set
  allowed_areas = '{}'::text[],
  scope_rules = '[]'::jsonb,
  max_units_per_session = null
where coalesce(is_membership, false) = true
  and (
    cardinality(coalesce(allowed_areas, '{}')) > 0
    or jsonb_array_length(coalesce(scope_rules, '[]'::jsonb)) > 0
    or max_units_per_session is not null
  );
