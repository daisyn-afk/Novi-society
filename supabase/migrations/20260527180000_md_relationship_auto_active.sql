-- MD supervision is active immediately when NOVI assigns a provider (no MD acceptance step).

update public.medical_director_relationship
   set status = 'active',
       start_date = coalesce(start_date, current_date),
       updated_at = now()
 where lower(coalesce(status, '')) = 'pending';

update public.md_coverage_request
   set status = 'active',
       updated_at = now()
 where lower(coalesce(status, '')) in ('pending_md_approval', 'pending');
