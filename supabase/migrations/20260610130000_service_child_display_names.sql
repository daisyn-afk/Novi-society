-- Child services should use the tier/service name only — not "Membership — Service".
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
