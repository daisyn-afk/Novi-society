-- Membership / service split
--
-- BEFORE (old admin model):
--   Each service_type row = one MD coverage plan providers purchase
--   coverage_tiers[] on that row = progressive treatment levels inside the plan
--
-- AFTER:
--   Same top-level row (same id) = membership plan (is_membership = true)
--   Each coverage_tier entry = its own service row linked via included_service_ids
--
-- Parent ids are preserved so live md_subscription.service_type_id rows keep working.

alter table if exists public.service_type
  add column if not exists is_membership boolean not null default false,
  add column if not exists included_service_ids jsonb not null default '[]'::jsonb,
  add column if not exists requires_additional_provider_cert boolean not null default false,
  add column if not exists additional_cert_label text,
  add column if not exists legacy_parent_membership_id text,
  add column if not exists source_tier_number integer;

create index if not exists idx_service_type_is_membership on public.service_type (is_membership);
create index if not exists idx_service_type_legacy_parent on public.service_type (legacy_parent_membership_id);

-- Every existing top-level catalog row is a membership plan (what providers purchase).
update public.service_type
set is_membership = true
where legacy_parent_membership_id is null;

-- Turn each coverage_tier into a child service; link on the parent membership.
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
      and jsonb_array_length(coalesce(coverage_tiers, '[]'::jsonb)) > 0
      and coalesce(metadata->>'tier_migration_v1', '') = ''
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
        coalesce(parent_rec.qualiphy_exam_ids, '[]'::jsonb),
        coalesce(parent_rec.requires_gfe, false),
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

-- Memberships without tiers: already is_membership = true, included_service_ids stays [].
