import { query } from "../db.js";

export async function backfillPaidEnrollments() {
  const { rows } = await query(
    `with candidates as (
       select
         p.id as pre_order_id,
         p.course_id,
         p.customer_name as provider_name,
         p.customer_email as provider_email,
         p.customer_name,
         case when p.status = 'completed' then 'confirmed' else p.status end as enrollment_status,
         p.course_date as session_date,
         p.amount_paid,
         coalesce(p.paid_at, now()) as paid_at
       from public.pre_orders p
       left join public.enrollments e on e.pre_order_id = p.id
       where p.order_type = 'course'
         and p.status in ('paid', 'confirmed', 'completed')
         and p.course_id is not null
         and e.id is null
     )
     insert into public.enrollments (
       course_id, pre_order_id, provider_name, provider_email, customer_name,
       status, session_date, amount_paid, paid_at
     )
     select
       course_id, pre_order_id, provider_name, provider_email, customer_name,
       enrollment_status, session_date, amount_paid, paid_at
     from candidates
     returning id, pre_order_id`,
    []
  );

  return {
    created_count: rows.length,
    created_enrollment_ids: rows.map((r) => r.id),
    created_pre_order_ids: rows.map((r) => r.pre_order_id)
  };
}
