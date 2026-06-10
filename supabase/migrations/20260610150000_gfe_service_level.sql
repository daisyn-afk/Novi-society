-- GFE (Qualiphy) is configured per service, not on membership plans.

update public.service_type
set requires_gfe = false,
    qualiphy_exam_ids = '[]'::jsonb
where coalesce(is_membership, false) = true
  and (
    requires_gfe = true
    or jsonb_array_length(coalesce(qualiphy_exam_ids, '[]'::jsonb)) > 0
  );
