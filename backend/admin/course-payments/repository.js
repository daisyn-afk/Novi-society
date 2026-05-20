import { query } from "../db.js";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/**
 * Ledger of completed course Stripe checkouts (course_payments).
 */
export async function listCoursePayments({ limit = DEFAULT_LIMIT } = {}) {
  const n = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const { rows } = await query(
    `select
       cp.id,
       cp.created_at,
       cp.updated_at,
       cp.customer_name,
       cp.customer_email,
       cp.course_title,
       cp.amount_total,
       cp.amount_subtotal,
       cp.currency,
       cp.status,
       cp.confirmation_email_sent,
       cp.pre_order_id,
       cp.course_id,
       cp.stripe_session_id,
       u.password_setup_status,
       u.password_reset_email_sent_at,
       u.password_reset_link_issued_at,
       u.password_reset_completed_at,
       u.auth_user_id,
       exists (
         select 1
         from public.enrollments e
         where lower(e.provider_email) = lower(cp.customer_email)
           and (cp.course_id is null or e.course_id = cp.course_id)
           and lower(coalesce(e.status, '')) in ('paid', 'confirmed', 'attended', 'completed')
       ) as is_enrolled
     from public.course_payments cp
     left join public.users u on lower(u.email) = lower(cp.customer_email)
     order by cp.created_at desc
     limit $1`,
    [n]
  );
  return rows;
}
