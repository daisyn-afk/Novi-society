-- Revert 20260610120000 … 20260610150000 (membership / tier split).
-- Best-effort: rebuilds coverage_tiers from migrated child rows, then removes children and new columns.
-- Run on live only after reviewing a backup. Name / tier JSON may differ slightly from pre-migration.

-- Undo 20260610150000_gfe_service_level
update public.service_type parent
set
  requires_gfe = coalesce(src.requires_gfe, false),
  qualiphy_exam_ids = coalesce(src.qualiphy_exam_ids, '[]'::jsonb)
from (
  select distinct on (c.legacy_parent_membership_id)
    c.legacy_parent_membership_id as parent_id,
    c.requires_gfe,
    c.qualiphy_exam_ids
  from public.service_type c
  where c.legacy_parent_membership_id is not null
    and coalesce(c.metadata->>'tier_migration_v1', '') = 'true'
  order by
    c.legacy_parent_membership_id,
    jsonb_array_length(coalesce(c.qualiphy_exam_ids, '[]'::jsonb)) desc,
    c.name
) src
where parent.id = src.parent_id
  and coalesce(parent.is_membership, false) = true;

-- Undo 20260610140000_clear_tier_fields — rebuild coverage_tiers from migrated children
update public.service_type parent
set coverage_tiers = coalesce(tier_data.tiers, '[]'::jsonb)
from (
  select
    p.id as parent_id,
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'tier_number', t.ord,
          'tier_name', case
            when c.name ~* '^tier [0-9]+$' then null
            else c.name
          end,
          'description', nullif(
            trim(c.description),
            trim(coalesce(p.description, ''))
          ),
          'allowed_areas', to_jsonb(coalesce(c.allowed_areas, '{}'::text[])),
          'scope_rules', coalesce(c.scope_rules, '[]'::jsonb),
          'max_units_per_session', c.max_units_per_session,
          'protocol_document_urls', coalesce(c.protocol_document_urls, '[]'::jsonb),
          'linked_course_ids', coalesce(c.metadata->'linked_course_ids', '[]'::jsonb)
        )
      )
      order by t.ord
    ) as tiers
  from public.service_type p
  inner join lateral jsonb_array_elements_text(
    coalesce(p.included_service_ids, '[]'::jsonb)
  ) with ordinality as t(child_id, ord) on true
  inner join public.service_type c on c.id = t.child_id
  where coalesce(p.is_membership, false) = true
    and coalesce(p.metadata->>'tier_migration_v1', '') = 'true'
    and coalesce(c.metadata->>'tier_migration_v1', '') = 'true'
  group by p.id
) tier_data
where parent.id = tier_data.parent_id;

-- Undo 20260610135000_backfill_service_areas_from_tiers — restore membership root scope from children
update public.service_type parent
set
  allowed_areas = coalesce((
    select c.allowed_areas
    from public.service_type c
    where c.legacy_parent_membership_id = parent.id
      and coalesce(c.metadata->>'tier_migration_v1', '') = 'true'
    order by cardinality(coalesce(c.allowed_areas, '{}')) desc, c.name
    limit 1
  ), '{}'::text[]),
  scope_rules = coalesce((
    select c.scope_rules
    from public.service_type c
    where c.legacy_parent_membership_id = parent.id
      and coalesce(c.metadata->>'tier_migration_v1', '') = 'true'
      and jsonb_array_length(coalesce(c.scope_rules, '[]'::jsonb)) > 0
    order by jsonb_array_length(c.scope_rules) desc, c.name
    limit 1
  ), '[]'::jsonb),
  max_units_per_session = (
    select c.max_units_per_session
    from public.service_type c
    where c.legacy_parent_membership_id = parent.id
      and coalesce(c.metadata->>'tier_migration_v1', '') = 'true'
      and c.max_units_per_session is not null
    order by c.max_units_per_session desc nulls last, c.name
    limit 1
  )
where coalesce(parent.is_membership, false) = true
  and coalesce(parent.metadata->>'tier_migration_v1', '') = 'true';

-- Re-point certifications that reference migrated child rows back to the parent membership.
update public.certification cert
set
  service_type_id = child.legacy_parent_membership_id,
  service_type_name = parent.name
from public.service_type child
inner join public.service_type parent on parent.id = child.legacy_parent_membership_id
where cert.service_type_id = child.id
  and child.legacy_parent_membership_id is not null
  and coalesce(child.metadata->>'tier_migration_v1', '') = 'true';

-- Undo 20260610120000_service_type_membership_model — remove migrated children
delete from public.service_type child
where child.legacy_parent_membership_id is not null
  and coalesce(child.metadata->>'tier_migration_v1', '') = 'true';

-- Reset parent membership rows to the pre-split catalog shape
update public.service_type
set
  is_membership = false,
  included_service_ids = '[]'::jsonb,
  metadata = coalesce(metadata, '{}'::jsonb) - 'tier_migration_v1'
where legacy_parent_membership_id is null
  and coalesce(metadata->>'tier_migration_v1', '') = 'true';

update public.service_type
set is_membership = false
where legacy_parent_membership_id is null
  and is_membership = true;

drop index if exists idx_service_type_is_membership;
drop index if exists idx_service_type_legacy_parent;

alter table if exists public.service_type
  drop column if exists is_membership,
  drop column if exists included_service_ids,
  drop column if exists requires_additional_provider_cert,
  drop column if exists additional_cert_label,
  drop column if exists legacy_parent_membership_id,
  drop column if exists source_tier_number;
