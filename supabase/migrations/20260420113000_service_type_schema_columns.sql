alter table if exists public.service_type
  add column if not exists description text,
  add column if not exists is_active boolean default true,
  add column if not exists requires_novi_course boolean default true,
  add column if not exists allow_external_cert boolean default false,
  add column if not exists requires_license_types text[] default '{}'::text[],
  add column if not exists requires_supervision_months numeric,
  add column if not exists scope_rules jsonb default '[]'::jsonb,
  add column if not exists allowed_areas text[] default '{}'::text[],
  add column if not exists max_units_per_session numeric,
  add column if not exists protocol_notes text,
  add column if not exists platform_agreement_text text,
  add column if not exists md_agreement_text text,
  add column if not exists md_contract_url text,
  add column if not exists protocol_document_urls jsonb default '[]'::jsonb,
  add column if not exists monthly_fee numeric,
  add column if not exists growth_studio_text text,
  add column if not exists supplier_accounts_text text,
  add column if not exists qualiphy_exam_ids jsonb default '[]'::jsonb,
  add column if not exists requires_gfe boolean default false,
  add column if not exists coverage_tiers jsonb default '[]'::jsonb,
  add column if not exists certification_name text;

update public.service_type
set
  description = coalesce(description, metadata->>'description'),
  is_active = coalesce(is_active, coalesce((metadata->>'is_active')::boolean, true)),
  requires_novi_course = coalesce(requires_novi_course, coalesce((metadata->>'requires_novi_course')::boolean, true)),
  allow_external_cert = coalesce(allow_external_cert, coalesce((metadata->>'allow_external_cert')::boolean, false)),
  requires_license_types = coalesce(
    requires_license_types,
    (
      select coalesce(array_agg(value), '{}'::text[])
      from jsonb_array_elements_text(coalesce(metadata->'requires_license_types', '[]'::jsonb)) as t(value)
    )
  ),
  requires_supervision_months = coalesce(requires_supervision_months, nullif(metadata->>'requires_supervision_months', '')::numeric),
  scope_rules = case
    when scope_rules is null then coalesce(metadata->'scope_rules', '[]'::jsonb)
    when scope_rules = '[]'::jsonb and jsonb_typeof(coalesce(metadata->'scope_rules', '[]'::jsonb)) = 'array'
      then metadata->'scope_rules'
    else scope_rules
  end,
  allowed_areas = coalesce(
    allowed_areas,
    (
      select coalesce(array_agg(value), '{}'::text[])
      from jsonb_array_elements_text(coalesce(metadata->'allowed_areas', '[]'::jsonb)) as t(value)
    )
  ),
  max_units_per_session = coalesce(max_units_per_session, nullif(metadata->>'max_units_per_session', '')::numeric),
  protocol_notes = coalesce(protocol_notes, metadata->>'protocol_notes'),
  platform_agreement_text = coalesce(platform_agreement_text, metadata->>'platform_agreement_text'),
  md_agreement_text = coalesce(md_agreement_text, metadata->>'md_agreement_text'),
  md_contract_url = coalesce(md_contract_url, metadata->>'md_contract_url'),
  protocol_document_urls = case
    when protocol_document_urls is null then coalesce(metadata->'protocol_document_urls', '[]'::jsonb)
    when protocol_document_urls = '[]'::jsonb and jsonb_typeof(coalesce(metadata->'protocol_document_urls', '[]'::jsonb)) = 'array'
      then metadata->'protocol_document_urls'
    else protocol_document_urls
  end,
  monthly_fee = coalesce(monthly_fee, nullif(metadata->>'monthly_fee', '')::numeric),
  growth_studio_text = coalesce(growth_studio_text, metadata->>'growth_studio_text'),
  supplier_accounts_text = coalesce(supplier_accounts_text, metadata->>'supplier_accounts_text'),
  qualiphy_exam_ids = case
    when qualiphy_exam_ids is null then coalesce(metadata->'qualiphy_exam_ids', '[]'::jsonb)
    when qualiphy_exam_ids = '[]'::jsonb and jsonb_typeof(coalesce(metadata->'qualiphy_exam_ids', '[]'::jsonb)) = 'array'
      then metadata->'qualiphy_exam_ids'
    else qualiphy_exam_ids
  end,
  requires_gfe = coalesce(requires_gfe, coalesce((metadata->>'requires_gfe')::boolean, false)),
  coverage_tiers = case
    when coverage_tiers is null then coalesce(metadata->'coverage_tiers', '[]'::jsonb)
    when coverage_tiers = '[]'::jsonb and jsonb_typeof(coalesce(metadata->'coverage_tiers', '[]'::jsonb)) = 'array'
      then metadata->'coverage_tiers'
    else coverage_tiers
  end,
  certification_name = coalesce(certification_name, metadata->>'certification_name');

update public.service_type
set
  requires_license_types = coalesce(requires_license_types, '{}'::text[]),
  allowed_areas = coalesce(allowed_areas, '{}'::text[]),
  scope_rules = coalesce(scope_rules, '[]'::jsonb),
  protocol_document_urls = coalesce(protocol_document_urls, '[]'::jsonb),
  qualiphy_exam_ids = coalesce(qualiphy_exam_ids, '[]'::jsonb),
  coverage_tiers = coalesce(coverage_tiers, '[]'::jsonb),
  is_active = coalesce(is_active, true),
  requires_novi_course = coalesce(requires_novi_course, true),
  allow_external_cert = coalesce(allow_external_cert, false),
  requires_gfe = coalesce(requires_gfe, false);

alter table public.service_type
  alter column requires_license_types set default '{}'::text[],
  alter column allowed_areas set default '{}'::text[],
  alter column scope_rules set default '[]'::jsonb,
  alter column protocol_document_urls set default '[]'::jsonb,
  alter column qualiphy_exam_ids set default '[]'::jsonb,
  alter column coverage_tiers set default '[]'::jsonb,
  alter column is_active set default true,
  alter column requires_novi_course set default true,
  alter column allow_external_cert set default false,
  alter column requires_gfe set default false;

alter table public.service_type
  alter column requires_license_types set not null,
  alter column allowed_areas set not null,
  alter column scope_rules set not null,
  alter column protocol_document_urls set not null,
  alter column qualiphy_exam_ids set not null,
  alter column coverage_tiers set not null,
  alter column is_active set not null,
  alter column requires_novi_course set not null,
  alter column allow_external_cert set not null,
  alter column requires_gfe set not null;
