-- Repair live DB after service-type membership migrations were run more than once
-- (e.g. migrations applied before app deploy, then re-applied after deploy).
--
-- Run this diagnostic on live BEFORE applying (replace nothing — read-only):
--
--   select
--     (select count(*) from service_type where legacy_parent_membership_id is not null) as child_rows,
--     (select count(*) from service_type where legacy_parent_membership_id is not null and is_membership) as children_marked_membership,
--     (select count(*) from service_type where coalesce(is_membership,false) and jsonb_array_length(coalesce(coverage_tiers,'[]')) > 0) as parents_still_with_tiers,
--     (select count(*) from service_type p where coalesce(p.is_membership,false) and jsonb_array_length(coalesce(p.included_service_ids,'[]')) = 0
--        and exists (select 1 from service_type c where c.legacy_parent_membership_id = p.id)) as parents_missing_included_ids,
--     (select count(*) from service_type p where coalesce(p.is_membership,false) and jsonb_array_length(coalesce(p.coverage_tiers,'[]')) > 0
--        and not exists (select 1 from service_type c where c.legacy_parent_membership_id = p.id)) as parents_needing_split;
--
-- Fixes:
--   • tier child rows incorrectly marked is_membership = true (show in Memberships tab)
--   • parent included_service_ids out of sync with migrated children
--   • parents still holding coverage_tiers but no child rows (split skipped due to tier_migration_v1)
--   • re-applies area backfill, tier clear, GFE-on-service, and child display names

-- 1) Tier children are services, not purchasable membership plans.
update public.service_type
set is_membership = false
where legacy_parent_membership_id is not null
  and coalesce(is_membership, false) = true;

-- 2) Membership parents that were accidentally flipped to is_membership = false.
update public.service_type parent
set is_membership = true
where legacy_parent_membership_id is null
  and coalesce(is_membership, false) = false
  and (
    jsonb_array_length(coalesce(included_service_ids, '[]'::jsonb)) > 0
    or exists (
      select 1 from public.service_type c
      where c.legacy_parent_membership_id = parent.id
    )
    or exists (
      select 1 from public.md_subscription ms
      where ms.service_type_id = parent.id
    )
    or coalesce(parent.metadata->>'tier_migration_v1', '') = 'true'
  );

-- 3) Re-link included_service_ids from existing migrated children.
update public.service_type parent
set included_service_ids = coalesce(child_link.child_ids, '[]'::jsonb)
from (
  select
    c.legacy_parent_membership_id as parent_id,
    jsonb_agg(c.id order by coalesce(c.source_tier_number, 9999), c.name) as child_ids
  from public.service_type c
  where c.legacy_parent_membership_id is not null
  group by c.legacy_parent_membership_id
) child_link
where parent.id = child_link.parent_id
  and coalesce(parent.is_membership, false) = true;

-- 4) Parents that still have coverage_tiers JSON but no child rows — split tiers now.
do $$
declare
  parent_rec record;
  tier_elem jsonb;
  child_id text;
  child_ids text[] := '{}';
  tier_num int;
  tier_name text;
  child_display_name text;
begin
  for parent_rec in
    select *
    from public.service_type
    where legacy_parent_membership_id is null
      and coalesce(is_membership, false) = true
      and jsonb_array_length(coalesce(coverage_tiers, '[]'::jsonb)) > 0
      and not exists (
        select 1
        from public.service_type c
        where c.legacy_parent_membership_id = service_type.id
      )
  loop
    child_ids := '{}';

    for tier_elem in
      select value
      from jsonb_array_elements(parent_rec.coverage_tiers)
      order by coalesce((value->>'tier_number')::int, 9999)
    loop
      tier_num := coalesce((tier_elem->>'tier_number')::int, 1);
      tier_name := nullif(trim(tier_elem->>'tier_name'), '');
      child_display_name := coalesce(tier_name, 'Tier ' || tier_num::text);
      child_id := gen_random_uuid()::text;

      insert into public.service_type (
        id,
        name,
        category,
        description,
        is_active,
        is_membership,
        included_service_ids,
        requires_novi_course,
        allow_external_cert,
        requires_license_types,
        requires_supervision_months,
        scope_rules,
        allowed_areas,
        max_units_per_session,
        protocol_notes,
        platform_agreement_text,
        md_agreement_text,
        md_contract_url,
        protocol_document_urls,
        monthly_fee,
        growth_studio_text,
        supplier_accounts_text,
        qualiphy_exam_ids,
        requires_gfe,
        coverage_tiers,
        certification_name,
        requires_additional_provider_cert,
        additional_cert_label,
        legacy_parent_membership_id,
        source_tier_number,
        metadata
      ) values (
        child_id,
        child_display_name,
        parent_rec.category,
        coalesce(nullif(trim(tier_elem->>'description'), ''), parent_rec.description, ''),
        coalesce(parent_rec.is_active, true),
        false,
        '[]'::jsonb,
        coalesce(parent_rec.requires_novi_course, true),
        coalesce(parent_rec.allow_external_cert, false),
        coalesce(parent_rec.requires_license_types, '{}'::text[]),
        parent_rec.requires_supervision_months,
        coalesce(tier_elem->'scope_rules', '[]'::jsonb),
        case
          when jsonb_array_length(coalesce(tier_elem->'allowed_areas', '[]'::jsonb)) > 0 then (
            select coalesce(array_agg(trim(value) order by trim(value)), '{}'::text[])
            from jsonb_array_elements_text(tier_elem->'allowed_areas') as t(value)
            where trim(value) <> ''
          )
          else coalesce(parent_rec.allowed_areas, '{}'::text[])
        end,
        nullif(tier_elem->>'max_units_per_session', '')::numeric,
        parent_rec.protocol_notes,
        parent_rec.platform_agreement_text,
        parent_rec.md_agreement_text,
        parent_rec.md_contract_url,
        coalesce(tier_elem->'protocol_document_urls', '[]'::jsonb),
        parent_rec.monthly_fee,
        parent_rec.growth_studio_text,
        parent_rec.supplier_accounts_text,
        coalesce(tier_elem->'qualiphy_exam_ids', '[]'::jsonb),
        coalesce((tier_elem->>'requires_gfe')::boolean, parent_rec.requires_gfe, false),
        '[]'::jsonb,
        parent_rec.certification_name,
        coalesce(parent_rec.requires_additional_provider_cert, false),
        parent_rec.additional_cert_label,
        parent_rec.id,
        tier_num,
        coalesce(parent_rec.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'tier_migration_v1', true,
            'linked_course_ids', coalesce(tier_elem->'linked_course_ids', '[]'::jsonb)
          )
      );

      child_ids := array_append(child_ids, child_id);
    end loop;

    update public.service_type
    set
      is_membership = true,
      included_service_ids = to_jsonb(child_ids),
      metadata = coalesce(metadata, '{}'::jsonb) || '{"tier_migration_v1": true}'::jsonb
    where id = parent_rec.id;
  end loop;
end $$;

-- 5) Sync included_service_ids again after any new children were created.
update public.service_type parent
set included_service_ids = coalesce(child_link.child_ids, '[]'::jsonb)
from (
  select
    c.legacy_parent_membership_id as parent_id,
    jsonb_agg(c.id order by coalesce(c.source_tier_number, 9999), c.name) as child_ids
  from public.service_type c
  where c.legacy_parent_membership_id is not null
  group by c.legacy_parent_membership_id
) child_link
where parent.id = child_link.parent_id
  and coalesce(parent.is_membership, false) = true;

-- 6) Child display names — strip "Membership — Service" prefix if present.
update public.service_type as child
set name = trim(substr(child.name, length(parent.name) + 4))
from public.service_type as parent
where child.legacy_parent_membership_id = parent.id
  and child.name like parent.name || ' — %';

update public.service_type as child
set name = trim(substr(child.name, length(parent.name) + 4))
from public.service_type as parent
where child.legacy_parent_membership_id = parent.id
  and child.name like parent.name || ' - %';

-- 7) Backfill allowed_areas / scope from legacy tiers onto child services (idempotent).
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

update public.service_type child
set allowed_areas = parent.allowed_areas
from public.service_type parent
inner join lateral jsonb_array_elements_text(coalesce(parent.included_service_ids, '[]'::jsonb)) as inc(id)
  on true
where coalesce(parent.is_membership, false) = true
  and child.id = inc.id
  and cardinality(coalesce(child.allowed_areas, '{}')) = 0
  and cardinality(coalesce(parent.allowed_areas, '{}')) > 0;

update public.service_type child
set allowed_areas = parent.allowed_areas
from public.service_type parent
where child.legacy_parent_membership_id = parent.id
  and cardinality(coalesce(child.allowed_areas, '{}')) = 0
  and cardinality(coalesce(parent.allowed_areas, '{}')) > 0;

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

-- 8) Clear legacy tier JSON from membership rows; GFE lives on services only.
update public.service_type
set coverage_tiers = '[]'::jsonb
where is_membership = true
  and jsonb_array_length(coalesce(coverage_tiers, '[]'::jsonb)) > 0;

update public.service_type
set source_tier_number = null
where source_tier_number is not null;

update public.service_type
set requires_gfe = false,
    qualiphy_exam_ids = '[]'::jsonb
where coalesce(is_membership, false) = true
  and (
    requires_gfe = true
    or jsonb_array_length(coalesce(qualiphy_exam_ids, '[]'::jsonb)) > 0
  );
