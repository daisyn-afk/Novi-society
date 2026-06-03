import { query } from "../db.js";

const CONTACT_TYPES = new Set(["order", "call", "message"]);
const ORDER_REQUEST_COLUMNS = `
  id,
  manufacturer_id,
  manufacturer_name,
  provider_id,
  provider_email,
  provider_name,
  practice_name,
  contact_type,
  subject,
  message,
  order_items,
  rep_email,
  status,
  created_at,
  updated_at
`;

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asTrimmedString(value, fallback = "") {
  const s = asString(value, fallback);
  return typeof s === "string" ? s.trim() : fallback;
}

function asJsonbArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function normalizeOrderItems(items) {
  return asJsonbArray(items)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const productName = asTrimmedString(item.product_name);
      if (!productName || productName === "__other__") return null;
      const quantity = Number(item.quantity);
      return {
        product_name: productName,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        unit: asTrimmedString(item.unit, "units") || "units",
        notes: asTrimmedString(item.notes, ""),
      };
    })
    .filter(Boolean);
}

function rowToApi(row) {
  if (!row) return null;
  const orderItems = asJsonbArray(
    typeof row.order_items === "string" ? JSON.parse(row.order_items) : row.order_items
  );
  return {
    id: row.id,
    manufacturer_id: row.manufacturer_id,
    manufacturer_name: row.manufacturer_name ?? "",
    provider_id: row.provider_id,
    provider_email: row.provider_email ?? "",
    provider_name: row.provider_name ?? "",
    practice_name: row.practice_name ?? "",
    contact_type: row.contact_type ?? "order",
    subject: row.subject ?? "",
    message: row.message ?? "",
    order_items: orderItems,
    rep_email: row.rep_email ?? "",
    status: row.status ?? "submitted",
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

export async function createManufacturerOrderRequest(payload = {}) {
  const manufacturerId = asTrimmedString(payload.manufacturer_id);
  if (!manufacturerId) {
    const err = new Error("manufacturer_id is required.");
    err.statusCode = 400;
    throw err;
  }

  const contactType = asTrimmedString(payload.contact_type || payload.type, "order");
  if (!CONTACT_TYPES.has(contactType)) {
    const err = new Error(`contact_type must be one of: ${[...CONTACT_TYPES].join(", ")}.`);
    err.statusCode = 400;
    throw err;
  }

  const orderItems = contactType === "order"
    ? normalizeOrderItems(payload.order_items)
    : [];

  if (contactType === "order" && orderItems.length === 0) {
    const err = new Error("At least one valid order item is required.");
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await query(
    `insert into public.manufacturer_order_requests (
       manufacturer_id,
       manufacturer_name,
       provider_id,
       provider_email,
       provider_name,
       practice_name,
       contact_type,
       subject,
       message,
       order_items,
       rep_email
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
     returning ${ORDER_REQUEST_COLUMNS}`,
    [
      manufacturerId,
      asString(payload.manufacturer_name, ""),
      payload.provider_id || null,
      asString(payload.provider_email, ""),
      asString(payload.provider_name, ""),
      asString(payload.practice_name, ""),
      contactType,
      asString(payload.subject, ""),
      asString(payload.message, ""),
      JSON.stringify(orderItems),
      asString(payload.rep_email, ""),
    ]
  );

  return rowToApi(rows[0]);
}

export async function listManufacturerOrderRequests({
  providerId,
  manufacturerId,
  contactType,
  sort = "-created_at",
} = {}) {
  const values = [];
  const where = [];

  if (providerId) {
    values.push(String(providerId));
    where.push(`provider_id = $${values.length}`);
  }
  if (manufacturerId) {
    values.push(String(manufacturerId));
    where.push(`manufacturer_id = $${values.length}`);
  }
  if (contactType) {
    values.push(String(contactType));
    where.push(`contact_type = $${values.length}`);
  }

  const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
  const sortDir = sort.startsWith("-") ? "desc" : "asc";
  const allowedSort = new Set(["created_at", "updated_at"]);
  const orderBy = allowedSort.has(sortField) ? sortField : "created_at";

  const { rows } = await query(
    `select ${ORDER_REQUEST_COLUMNS}
     from public.manufacturer_order_requests
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by ${orderBy} ${sortDir}`,
    values
  );

  return rows.map(rowToApi);
}

export function flattenOrderRequestsToInventoryLines(orders = []) {
  const lines = [];
  for (const order of orders) {
    if (order.contact_type !== "order" || !order.order_items?.length) continue;
    order.order_items.forEach((item, index) => {
      lines.push({
        id: `${order.id}:${index}`,
        order_request_id: order.id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit || "units",
        notes: item.notes || "",
        provider_id: order.provider_id,
        provider_name: order.provider_name,
        provider_email: order.provider_email,
        manufacturer_id: order.manufacturer_id,
        manufacturer_name: order.manufacturer_name,
        contact_type: order.contact_type,
        message: order.message,
        status: order.status,
        created_at: order.created_at,
        created_date: order.created_at,
      });
    });
  }
  return lines.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function listManufacturerOrderInventoryLines(filters = {}) {
  const orders = await listManufacturerOrderRequests(filters);
  return flattenOrderRequestsToInventoryLines(orders);
}
