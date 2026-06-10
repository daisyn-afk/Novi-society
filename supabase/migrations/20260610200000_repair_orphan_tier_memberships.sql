-- Follow-up repair when 20260610190000 did not fix live data.
--
-- Common cause: a partial revert dropped legacy_parent_membership_id (or deleted child
-- links) while tier rows remained as top-level is_membership = true plans.
--
-- Run this read-only snapshot on live first:
--
--   select id, name, category, is_membership,
--          legacy_parent_membership_id,
--          jsonb_array_length(coalesce(included_service_ids, '[]')) as included_count,
--          jsonb_array_length(coalesce(coverage_tiers, '[]')) as tier_count,
--          coalesce(metadata->>'tier_migration_v1', '') as tier_migration_v1,
--          jsonb_array_length(coalesce(metadata->'linked_course_ids', '[]')) as linked_courses
--   from service_type
--   order by category, name;
--
--   select p.name as parent, c.name as child, c.is_membership, c.legacy_parent_membership_id
--   from service_type p
--   cross join lateral jsonb_array_elements_text(coalesce(p.included_service_ids, '[]')) inc(id)
--   join service_type c on c.id = inc.id
--   where coalesce(p.is_membership, false) = true
--   order by p.name, c.name;

-- A) Rows listed on a parent membership but still marked as memberships.
update public.service_type child
set
  is_membership = false,
  legacy_parent_membership_id = parent.id
from public.service_type parent
inner join lateral jsonb_array_elements_text(coalesce(parent.included_service_ids, '[]'::jsonb)) as inc(id)
  on true
where child.id = inc.id
  and coalesce(parent.is_membership, false) = true
  and parent.legacy_parent_membership_id is null
  and (
    coalesce(child.is_membership, false) = true
    or coalesce(child.legacy_parent_membership_id, '') = ''
    or child.legacy_parent_membership_id is distinct from parent.id
  );

-- B) Name prefix "Parent — Tier" / "Parent - Tier" without parent link.
update public.service_type child
set
  is_membership = false,
  legacy_parent_membership_id = parent.id
from public.service_type parent
where child.legacy_parent_membership_id is null
  and coalesce(child.is_membership, false) = true
  and parent.legacy_parent_membership_id is null
  and coalesce(parent.is_membership, false) = true
  and (
    child.name like parent.name || ' — %'
    or child.name like parent.name || ' - %'
  );

-- C) Migrated tier rows (metadata.linked_course_ids) → parent via template_courses.
update public.service_type child
set
  is_membership = false,
  legacy_parent_membership_id = match.parent_id
from (
  select distinct on (child.id)
    child.id as child_id,
    parent_id as parent_id
  from public.service_type child
  cross join lateral jsonb_array_elements_text(coalesce(child.metadata->'linked_course_ids', '[]'::jsonb)) as cid(course_id)
  inner join public.template_courses tc on tc.id::text = cid.course_id
  cross join lateral unnest(coalesce(tc.linked_service_type_ids, '{}'::text[])) as parent_id
  inner join public.service_type parent on parent.id = parent_id
  where child.legacy_parent_membership_id is null
    and coalesce(child.is_membership, false) = true
    and parent.legacy_parent_membership_id is null
    and coalesce(parent.is_membership, false) = true
    and child.id <> parent.id
  order by child.id, parent.created_at nulls last
) match
where child.id = match.child_id
  and coalesce(child.legacy_parent_membership_id, '') = '';

-- D) Same category: reparent tier-migration orphans to the membership that has MD subscriptions.
update public.service_type child
set
  is_membership = false,
  legacy_parent_membership_id = parent.id
from (
  select distinct on (child.id)
    child.id as child_id,
    parent.id as parent_id
  from public.service_type child
  inner join public.service_type parent
    on parent.category is not distinct from child.category
   and parent.legacy_parent_membership_id is null
   and coalesce(parent.is_membership, false) = true
   and parent.id <> child.id
  where child.legacy_parent_membership_id is null
    and coalesce(child.is_membership, false) = true
    and coalesce(child.metadata->>'tier_migration_v1', '') = 'true'
    and jsonb_array_length(coalesce(child.metadata->'linked_course_ids', '[]'::jsonb)) > 0
    and exists (
      select 1
      from public.md_subscription ms
      where ms.service_type_id = parent.id
    )
    and not exists (
      select 1
      from public.md_subscription ms
      where ms.service_type_id = child.id
    )
  order by child.id, (
    select count(*)::int
    from public.md_subscription ms
    where ms.service_type_id = parent.id
  ) desc, parent.created_at
) match
where child.id = match.child_id
  and coalesce(child.legacy_parent_membership_id, '') = '';

-- E) Same category with a single membership parent and multiple tier-migration orphans.
update public.service_type child
set
  is_membership = false,
  legacy_parent_membership_id = solo.parent_id
from (
  select
    child.id as child_id,
    parent.id as parent_id
  from public.service_type child
  inner join (
    select category, min(id) as parent_id
    from public.service_type p
    where p.legacy_parent_membership_id is null
      and coalesce(p.is_membership, false) = true
      and exists (
        select 1
        from public.service_type peer
        where peer.legacy_parent_membership_id is null
          and coalesce(peer.is_membership, false) = true
          and peer.category is not distinct from p.category
          and coalesce(peer.metadata->>'tier_migration_v1', '') = 'true'
          and jsonb_array_length(coalesce(peer.metadata->'linked_course_ids', '[]'::jsonb)) > 0
          and peer.id <> p.id
      )
    group by category
    having count(*) = 1
  ) solo on solo.category is not distinct from child.category
  inner join public.service_type parent on parent.id = solo.parent_id
  where child.legacy_parent_membership_id is null
    and coalesce(child.is_membership, false) = true
    and coalesce(child.metadata->>'tier_migration_v1', '') = 'true'
    and jsonb_array_length(coalesce(child.metadata->'linked_course_ids', '[]'::jsonb)) > 0
    and child.id <> parent.id
    and not exists (
      select 1
      from public.md_subscription ms
      where ms.service_type_id = child.id
    )
) match
where child.id = match.child_id
  and coalesce(child.legacy_parent_membership_id, '') = '';

-- F) Re-sync parent included_service_ids from children.
update public.service_type parent
set included_service_ids = coalesce(child_link.child_ids, '[]'::jsonb)
from (
  select
    c.legacy_parent_membership_id as parent_id,
    jsonb_agg(c.id order by coalesce(c.source_tier_number, 9999), c.name) as child_ids
  from public.service_type c
  where c.legacy_parent_membership_id is not null
    and coalesce(c.is_membership, false) = false
  group by c.legacy_parent_membership_id
) child_link
where parent.id = child_link.parent_id
  and coalesce(parent.is_membership, false) = true;

-- G) Parents that still have tier JSON but no children — split (same as prior repair).
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
        id, name, category, description, is_active, is_membership, included_service_ids,
        requires_novi_course, allow_external_cert, requires_license_types, requires_supervision_months,
        scope_rules, allowed_areas, max_units_per_session, protocol_notes, platform_agreement_text,
        md_agreement_text, md_contract_url, protocol_document_urls, monthly_fee, growth_studio_text,
        supplier_accounts_text, qualiphy_exam_ids, requires_gfe, coverage_tiers, certification_name,
        requires_additional_provider_cert, additional_cert_label, legacy_parent_membership_id,
        source_tier_number, metadata
      ) values (
        child_id, child_display_name, parent_rec.category,
        coalesce(nullif(trim(tier_elem->>'description'), ''), parent_rec.description, ''),
        coalesce(parent_rec.is_active, true), false, '[]'::jsonb,
        coalesce(parent_rec.requires_novi_course, true), coalesce(parent_rec.allow_external_cert, false),
        coalesce(parent_rec.requires_license_types, '{}'::text[]), parent_rec.requires_supervision_months,
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
        parent_rec.protocol_notes, parent_rec.platform_agreement_text, parent_rec.md_agreement_text,
        parent_rec.md_contract_url, coalesce(tier_elem->'protocol_document_urls', '[]'::jsonb),
        parent_rec.monthly_fee, parent_rec.growth_studio_text, parent_rec.supplier_accounts_text,
        coalesce(tier_elem->'qualiphy_exam_ids', '[]'::jsonb),
        coalesce((tier_elem->>'requires_gfe')::boolean, parent_rec.requires_gfe, false),
        '[]'::jsonb, parent_rec.certification_name,
        coalesce(parent_rec.requires_additional_provider_cert, false), parent_rec.additional_cert_label,
        parent_rec.id, tier_num,
        coalesce(parent_rec.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'tier_migration_v1', true,
            'linked_course_ids', coalesce(tier_elem->'linked_course_ids', '[]'::jsonb)
          )
      );

      child_ids := array_append(child_ids, child_id);
    end loop;

    update public.service_type
    set included_service_ids = to_jsonb(child_ids)
    where id = parent_rec.id;
  end loop;
end $$;

-- H) Final sync + cleanup.
update public.service_type parent
set included_service_ids = coalesce(child_link.child_ids, '[]'::jsonb)
from (
  select
    c.legacy_parent_membership_id as parent_id,
    jsonb_agg(c.id order by coalesce(c.source_tier_number, 9999), c.name) as child_ids
  from public.service_type c
  where c.legacy_parent_membership_id is not null
    and coalesce(c.is_membership, false) = false
  group by c.legacy_parent_membership_id
) child_link
where parent.id = child_link.parent_id
  and coalesce(parent.is_membership, false) = true;

update public.service_type
set is_membership = false
where legacy_parent_membership_id is not null
  and coalesce(is_membership, false) = true;

update public.service_type
set coverage_tiers = '[]'::jsonb
where coalesce(is_membership, false) = true
  and jsonb_array_length(coalesce(coverage_tiers, '[]'::jsonb)) > 0;
