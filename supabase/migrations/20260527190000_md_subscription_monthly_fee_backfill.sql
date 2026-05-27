-- Backfill monthly_fee on active md_subscription rows (first service $279, add-ons $129, 6+ $0).

with ranked as (
  select
    id,
    row_number() over (
      partition by provider_id
      order by coalesce(activated_at, created_at) asc nulls last, created_at asc nulls last
    ) as rn
  from public.md_subscription
  where lower(coalesce(status, '')) = 'active'
    and (service_type_monthly_fee is null or service_type_monthly_fee = 0)
)
update public.md_subscription m
   set service_type_monthly_fee = case
         when r.rn = 1 then 279
         when r.rn <= 5 then 129
         else 0
       end,
       updated_at = now()
  from ranked r
 where m.id = r.id;
