-- New model: memberships + services only (no coverage tiers / tier unlock).

update public.service_type
set coverage_tiers = '[]'::jsonb
where is_membership = true
  and jsonb_array_length(coalesce(coverage_tiers, '[]'::jsonb)) > 0;

update public.service_type
set source_tier_number = null
where source_tier_number is not null;
