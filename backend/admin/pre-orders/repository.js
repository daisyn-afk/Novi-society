import { query } from "../db.js";

let preOrderColumnsPromise = null;

async function getPreOrderColumnsSet() {
  if (!preOrderColumnsPromise) {
    preOrderColumnsPromise = query(
      `select column_name
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'pre_orders'`
    )
      .then((r) => new Set((r.rows || []).map((row) => String(row.column_name || "").toLowerCase())))
      .catch(() => new Set());
  }
  return preOrderColumnsPromise;
}

async function getSelectColumnsSql() {
  const columns = await getPreOrderColumnsSet();
  const has = (name) => columns.has(String(name || "").toLowerCase());
  const col = (name, fallbackSql = "null") => (has(name) ? name : `${fallbackSql} as ${name}`);
  const boolCol = (name, fallback = false) => (has(name) ? name : `${fallback ? "true" : "false"} as ${name}`);
  const jsonCol = (name) => (has(name) ? name : `'{}'::jsonb as ${name}`);

  return `
    id,
    created_at as created_date,
    updated_at as updated_date,
    order_type,
    type,
    status,
    ${col("service_type_id")},
    ${col("service_name")},
    ${col("course_id")},
    ${col("course_title")},
    ${col("course_date")},
    ${col("customer_name")},
    ${col("customer_email")},
    ${col("phone")},
    ${col("license_type")},
    ${col("license_number")},
    ${col("license_image_url")},
    ${col("certification_document_url")},
    ${col("age_range")},
    ${col("experience_level")},
    ${col("treatment_type")},
    ${col("model_time_slot")},
    ${boolCol("is_waitlist", false)},
    ${col("date_of_birth")},
    ${jsonCol("health_questions")},
    ${col("notes")},
    ${col("rejection_reason")},
    ${col("approved_at")},
    ${col("approved_by")},
    ${col("rejected_at")},
    ${col("rejected_by")},
    ${col("payment_link")},
    ${col("payment_link_sent_at")},
    ${col("payment_status")},
    ${col("amount_paid", "0")},
    ${col("amount", "0")},
    ${col("gfe_initiated_at")},
    ${col("gfe_status")},
    ${col("gfe_meeting_url")},
    ${col("gfe_completed_at")},
    ${col("gfe_reminder_sent_at")},
    ${boolCol("confirmation_email_sent", false)},
    ${col("confirmation_email_sent_at")},
    ${col("reminder_email_sent_at")},
    ${boolCol("post_training_email_sent", false)},
    ${boolCol("attendance_confirmed", false)},
    ${col("attendance_confirmed_at")}
  `;
}

export async function listPreOrders({ limit = 200, customerEmail = "", orderType = "" } = {}) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.min(Math.max(Number(limit), 1), 500) : 200;
  const email = String(customerEmail || "").trim().toLowerCase();
  const normalizedOrderType = String(orderType || "").trim().toLowerCase();
  const selectColumns = await getSelectColumnsSql();

  const params = [safeLimit];
  const innerWhereClauses = [];
  if (email) {
    params.push(email);
    innerWhereClauses.push(`lower(customer_email) = $${params.length}`);
  }
  if (normalizedOrderType) {
    params.push(normalizedOrderType);
    innerWhereClauses.push(`lower(order_type) = $${params.length}`);
  }
  const innerWhereSql = innerWhereClauses.length ? `where ${innerWhereClauses.join(" and ")}` : "";

  const { rows } = await query(
    `select sub.*,
            u.password_setup_status,
            u.password_reset_email_sent_at,
            u.password_reset_link_issued_at,
            u.password_reset_completed_at,
            exists (
              select 1
              from public.enrollments e
              where lower(e.provider_email) = lower(sub.customer_email)
                and (sub.course_id is null or e.course_id = sub.course_id)
                and lower(coalesce(e.status, '')) in ('paid', 'confirmed', 'attended', 'completed')
            ) as is_enrolled
     from (
       select ${selectColumns}
       from public.pre_orders
       ${innerWhereSql}
       order by created_at desc
       limit $1
     ) sub
     left join public.users u on lower(u.email) = lower(sub.customer_email)`,
    params
  );
  return rows;
}

export async function getPreOrderById(id) {
  if (!id) return null;
  const selectColumns = await getSelectColumnsSql();
  const { rows } = await query(
    `select ${selectColumns}
     from public.pre_orders
     where id = $1
     limit 1`,
    [id]
  );
  return rows[0] || null;
}

export async function markPreOrderSignupLinkSent({ id, actor }) {
  if (!id) {
    const err = new Error("pre_order_id is required.");
    err.statusCode = 400;
    throw err;
  }
  const selectColumns = await getSelectColumnsSql();
  const { rows } = await query(
    `update public.pre_orders
     set status = 'signup_link_sent',
         approved_at = now(),
         approved_by = $2,
         payment_link = null,
         payment_link_sent_at = now(),
         rejection_reason = null,
         rejected_at = null,
         rejected_by = null,
         updated_at = now()
     where id = $1
     returning ${selectColumns}`,
    [id, actor || null]
  );
  return rows[0] || null;
}

export async function markPreOrderRejected({ id, actor, rejectionReason }) {
  if (!id) {
    const err = new Error("pre_order_id is required.");
    err.statusCode = 400;
    throw err;
  }
  const selectColumns = await getSelectColumnsSql();
  const { rows } = await query(
    `update public.pre_orders
     set status = 'rejected',
         rejection_reason = $3,
         rejected_at = now(),
         rejected_by = $2,
         updated_at = now()
     where id = $1
     returning ${selectColumns}`,
    [id, actor || null, rejectionReason || null]
  );
  return rows[0] || null;
}

export async function confirmPreOrdersAfterPasswordSetup(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return 0;
  const { rowCount } = await query(
    `update public.pre_orders
     set status = 'confirmed',
         updated_at = now()
     where lower(customer_email) = lower($1)
       and status in ('signup_link_sent', 'payment_link_sent', 'approved')`,
    [normalized]
  );
  return rowCount || 0;
}

const PATCHABLE_PRE_ORDER_KEYS = new Set([
  "status",
  "notes",
  "rejection_reason",
  "model_time_slot",
  "is_waitlist",
  "gfe_status",
  "gfe_meeting_url",
  "attendance_confirmed",
  "attendance_confirmed_at"
]);

export async function patchPreOrder(id, patch = {}) {
  if (!id) {
    const err = new Error("pre_order id is required.");
    err.statusCode = 400;
    throw err;
  }

  const { rows: existingRows } = await query(
    `select id from public.pre_orders where id = $1 limit 1`,
    [id]
  );
  if (!existingRows[0]) return null;

  const keys = Object.keys(patch || {}).filter((k) => PATCHABLE_PRE_ORDER_KEYS.has(k));
  if (keys.length === 0) {
    const err = new Error("No valid fields to update.");
    err.statusCode = 400;
    throw err;
  }

  const sets = [];
  const vals = [];
  for (const k of keys) {
    let v = patch[k];
    if (k === "is_waitlist") v = Boolean(v);
    if (k === "attendance_confirmed") v = Boolean(v);
    vals.push(v);
    sets.push(`${k} = $${vals.length}`);
  }
  vals.push(id);
  const selectColumns = await getSelectColumnsSql();
  const { rows } = await query(
    `update public.pre_orders set ${sets.join(", ")} where id = $${vals.length} returning ${selectColumns}`,
    vals
  );
  return rows[0] || null;
}
