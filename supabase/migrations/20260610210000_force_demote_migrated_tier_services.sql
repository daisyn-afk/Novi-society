-- Force-fix tier rows that migrations marked as memberships (is_membership = true).
-- Safe to re-run. Run on live if repair migrations did not move rows to Services.

-- 1) Any row linked to a parent is a service, not a membership plan.
update public.service_type
set is_membership = false
where nullif(trim(legacy_parent_membership_id), '') is not null
  and coalesce(is_membership, false) = true;

-- 2) Rows listed on a parent's included_service_ids are services.
update public.service_type child
set
  is_membership = false,
  legacy_parent_membership_id = coalesce(
    nullif(trim(child.legacy_parent_membership_id), ''),
    parent.id
  )
from public.service_type parent
inner join lateral jsonb_array_elements_text(coalesce(parent.included_service_ids, '[]'::jsonb)) as inc(id)
  on true
where child.id = inc.id
  and coalesce(parent.is_membership, false) = true
  and parent.legacy_parent_membership_id is null
  and coalesce(child.is_membership, false) = true;

-- 3) Tier-migration children (metadata.linked_course_ids) are services, not plans.
update public.service_type
set is_membership = false
where coalesce(is_membership, false) = true
  and coalesce(metadata->>'tier_migration_v1', '') = 'true'
  and jsonb_array_length(coalesce(metadata->'linked_course_ids', '[]'::jsonb)) > 0
  and not exists (
    select 1 from public.md_subscription ms where ms.service_type_id = service_type.id
  );

-- 4) Rebuild parent included_service_ids from children.
update public.service_type parent
set included_service_ids = coalesce(child_link.child_ids, '[]'::jsonb)
from (
  select
    c.legacy_parent_membership_id as parent_id,
    jsonb_agg(c.id order by coalesce(c.source_tier_number, 9999), c.name) as child_ids
  from public.service_type c
  where nullif(trim(c.legacy_parent_membership_id), '') is not null
    and coalesce(c.is_membership, false) = false
  group by c.legacy_parent_membership_id
) child_link
where parent.id = child_link.parent_id
  and coalesce(parent.is_membership, false) = true;
