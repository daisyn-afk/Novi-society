import { query } from "../db.js";

const SELECT_COLUMNS = `
  id,
  created_at as created_date,
  updated_at as updated_date,
  order_type,
  type,
  status,
  service_type_id,
  service_name,
  course_id,
  course_title,
  course_date,
  customer_name,
  customer_email,
  phone,
  license_type,
  license_number,
  license_image_url,
  certification_document_url,
  notes,
  rejection_reason,
  approved_at,
  approved_by,
  rejected_at,
  rejected_by,
  payment_link,
  payment_link_sent_at,
  amount_paid
`;

export async function listPreOrders({ limit = 200 } = {}) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.min(Math.max(Number(limit), 1), 500) : 200;
  const { rows } = await query(
    `select ${SELECT_COLUMNS}
     from public.pre_orders
     order by created_at desc
     limit $1`,
    [safeLimit]
  );
  return rows;
}

export async function updatePreOrderStatus({ id, action, rejectionReason, actor }) {
  if (!id) {
    const err = new Error("pre_order_id is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!["approve", "reject"].includes(action)) {
    const err = new Error("action must be 'approve' or 'reject'.");
    err.statusCode = 400;
    throw err;
  }

  if (action === "approve") {
    const paymentLink = `/PreOrderCheckout?pre_order_id=${encodeURIComponent(id)}`;
    const { rows } = await query(
      `update public.pre_orders
       set status = 'payment_link_sent',
           approved_at = now(),
           approved_by = $2,
           payment_link = $3,
           payment_link_sent_at = now(),
           rejection_reason = null,
           rejected_at = null,
           rejected_by = null
       where id = $1
       returning ${SELECT_COLUMNS}`,
      [id, actor || null, paymentLink]
    );
    return rows[0] || null;
  }

  const { rows } = await query(
    `update public.pre_orders
     set status = 'rejected',
         rejection_reason = $3,
         rejected_at = now(),
         rejected_by = $2
     where id = $1
     returning ${SELECT_COLUMNS}`,
    [id, actor || null, rejectionReason || null]
  );
  return rows[0] || null;
}
