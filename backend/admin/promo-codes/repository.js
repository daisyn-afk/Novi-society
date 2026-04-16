import { query } from "../db.js";

const SELECT_COLUMNS = `
  id,
  created_at,
  updated_at,
  code,
  description,
  discount_type,
  discount_value,
  max_uses,
  times_used,
  starts_at as valid_from,
  ends_at as valid_until,
  active as is_active
`;

function normalizePayload(payload = {}) {
  const rawDiscountType = String(payload.discount_type || "").toLowerCase();
  const normalizedDiscountType = rawDiscountType === "percentage" ? "percent" : rawDiscountType;
  return {
    code: String(payload.code || "").trim().toUpperCase(),
    description: payload.description || null,
    discount_type: normalizedDiscountType,
    discount_value: payload.discount_value === "" ? null : Number(payload.discount_value),
    max_uses: payload.max_uses === "" || payload.max_uses === null || payload.max_uses === undefined ? null : Number(payload.max_uses),
    starts_at: payload.valid_from || payload.starts_at || null,
    ends_at: payload.valid_until || payload.ends_at || null,
    is_active: payload.is_active !== false
  };
}

export async function listPromoCodes() {
  const { rows } = await query(
    `select ${SELECT_COLUMNS}
     from public.course_promo_codes
     order by created_at desc`
  );
  return rows;
}

export async function createPromoCode(payload) {
  const data = normalizePayload(payload);
  const { rows } = await query(
    `insert into public.course_promo_codes (
      code, description, discount_type, discount_value, max_uses, starts_at, ends_at, active
    ) values ($1,$2,$3,$4,$5,$6,$7,$8)
    returning ${SELECT_COLUMNS}`,
    [
      data.code,
      data.description,
      data.discount_type,
      data.discount_value,
      data.max_uses,
      data.starts_at,
      data.ends_at,
      data.is_active
    ]
  );
  return rows[0];
}

export async function updatePromoCode(id, payload) {
  const data = normalizePayload(payload);
  const { rows } = await query(
    `update public.course_promo_codes
     set code = $2,
         description = $3,
         discount_type = $4,
         discount_value = $5,
         max_uses = $6,
         starts_at = $7,
         ends_at = $8,
         active = $9
     where id = $1
     returning ${SELECT_COLUMNS}`,
    [
      id,
      data.code,
      data.description,
      data.discount_type,
      data.discount_value,
      data.max_uses,
      data.starts_at,
      data.ends_at,
      data.is_active
    ]
  );
  return rows[0] || null;
}

export async function deletePromoCode(id) {
  const { rowCount } = await query(`delete from public.course_promo_codes where id = $1`, [id]);
  return rowCount > 0;
}
