import { pool } from "../db.js";
import { sendEmailFromTemplate } from "../emails/renderTemplate.js";

let notificationTablePromise = null;
let notificationColumnsByTablePromise = null;

async function getNotificationTableName() {
  if (!notificationTablePromise) {
    notificationTablePromise = pool
      .query(
        `select table_name
         from information_schema.tables
         where table_schema = 'public'
           and table_name in ('notification', 'notifications')
         order by case when table_name = 'notification' then 0 else 1 end
         limit 1`
      )
      .then((r) => r.rows?.[0]?.table_name || null)
      .catch(() => null);
  }
  return notificationTablePromise;
}

async function getNotificationTableColumnsByName() {
  if (!notificationColumnsByTablePromise) {
    notificationColumnsByTablePromise = (async () => {
      const tableName = await getNotificationTableName();
      if (!tableName) return { tableName: null, columns: new Set() };
      const result = await pool.query(
        `select column_name
         from information_schema.columns
         where table_schema = 'public' and table_name = $1`,
        [tableName]
      );
      return {
        tableName,
        columns: new Set(
          (result.rows || []).map((row) =>
            String(row.column_name || "").toLowerCase()
          )
        ),
      };
    })().catch(() => ({ tableName: null, columns: new Set() }));
  }
  return notificationColumnsByTablePromise;
}

async function listAdminRecipients() {
  try {
    const { rows } = await pool.query(
      `select auth_user_id, email, full_name, first_name
       from public.users
       where lower(coalesce(role, '')) in ('admin', 'super_admin', 'owner')
         and nullif(trim(email), '') is not null`
    );
    return rows || [];
  } catch {
    return [];
  }
}

async function insertNotificationRow({
  userId,
  userEmail,
  type,
  message,
  linkPage,
}) {
  const { tableName, columns } = await getNotificationTableColumnsByName();
  if (!tableName || columns.size === 0) return;

  const valuesByColumn = {
    user_id: userId,
    user_email: userEmail,
    type,
    message,
    link_page: linkPage,
  };
  const insertColumns = Object.keys(valuesByColumn).filter((c) => columns.has(c));
  if (insertColumns.length === 0) return;

  const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
  const params = insertColumns.map((c) => valuesByColumn[c]);

  await pool
    .query(
      `insert into public.${tableName} (${insertColumns.join(", ")})
       values (${placeholders})`,
      params
    )
    .catch(() => {});
}

function isValidEmail(value) {
  const recipient = String(value || "").trim();
  return Boolean(recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient));
}

function mapOrderItemsForRegistry(rawOrderItems) {
  return normalizeOrderItemsForEmail(rawOrderItems)
    .map((item) => ({
      product: item?.product_name || item?.product || item?.name || "Item",
      sku: item?.sku || "",
      quantity:
        item?.quantity != null
          ? `${String(item.quantity)}${item?.unit ? ` ${item.unit}` : ""}`.trim()
          : "",
      unit_price: item?.unit_price || item?.price || "",
    }))
    .filter((item) => item.product || item.sku || item.quantity || item.unit_price);
}

const ADDITIONAL_FIELD_LABELS = {
  provider_id: "NOVI Provider ID",
  phone: "Phone",
  practice_address_full: "Practice address",
  specialty: "Specialty",
  city: "City",
  state: "State",
  npi: "NPI",
  dea_number: "DEA number",
  md_coverage: "MD Board coverage",
  verified_licenses_summary: "Verified licenses",
  certifications_summary: "Certifications",
};

const SKIP_ADDITIONAL_KEYS = new Set([
  "md_coverage_details",
  "verified_licenses",
  "certifications",
  "supervising_md_details",
]);

function formatAdditionalValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (typeof value[0] === "object") {
      return value
        .map((item) =>
          Object.entries(item || {})
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        )
        .filter(Boolean)
        .join("; ");
    }
    return value.join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  return String(value);
}

function buildSummaryBullets({ application, manufacturer }) {
  const additional = application?.additional_fields || {};
  const providerId =
    application?.provider_id || additional.provider_id || null;

  const lines = [
    `Supplier: ${manufacturer?.name || application?.manufacturer_name || "Unknown"}`,
    providerId ? `NOVI Provider ID: ${providerId}` : null,
    `Provider: ${application?.provider_name || application?.provider_email || "Unknown"}`,
    application?.provider_email ? `Provider email: ${application.provider_email}` : null,
    application?.practice_name ? `Practice: ${application.practice_name}` : null,
    application?.practice_phone ? `Phone: ${application.practice_phone}` : null,
    application?.practice_address ? `Practice address: ${application.practice_address}` : null,
    application?.license_type || application?.license_number
      ? `Primary license: ${[application.license_type, application.license_number, application.license_state].filter(Boolean).join(" / ")}`
      : null,
    additional.verified_licenses_summary
      ? `All verified licenses: ${additional.verified_licenses_summary}`
      : null,
    additional.md_coverage ? `MD Board coverage: ${additional.md_coverage}` : null,
    application?.supervising_physician_name
      ? `Supervising MD: ${application.supervising_physician_name}${application.supervising_physician_email ? ` (${application.supervising_physician_email})` : ""}`
      : null,
    additional.certifications_summary
      ? `Certifications: ${additional.certifications_summary}`
      : null,
  ].filter(Boolean);

  for (const [key, value] of Object.entries(additional)) {
    if (SKIP_ADDITIONAL_KEYS.has(key)) continue;
    if (["provider_id", "md_coverage", "verified_licenses_summary", "certifications_summary"].includes(key)) {
      continue;
    }
    const formatted = formatAdditionalValue(value);
    if (!formatted) continue;
    const label = ADDITIONAL_FIELD_LABELS[key] || key.replace(/_/g, " ");
    lines.push(`${label}: ${formatted}`);
  }
  return lines;
}

function normalizeOrderItemsForEmail(orderItems) {
  if (Array.isArray(orderItems)) return orderItems;
  if (typeof orderItems === "string") {
    try {
      const parsed = JSON.parse(orderItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function notifyAdminsOfManufacturerApplication({
  application,
  manufacturer,
}) {
  const admins = await listAdminRecipients();
  if (!admins.length) return;

  const summary = buildSummaryBullets({ application, manufacturer });
  const manufacturerName = manufacturer?.name || application?.manufacturer_name || "Unknown";

  for (const admin of admins) {
    const adminUserId = String(admin?.auth_user_id || "").trim() || null;
    const adminEmail = String(admin?.email || "").trim().toLowerCase() || null;
    const greetingName = admin?.first_name || admin?.full_name || "Admin";

    await insertNotificationRow({
      userId: adminUserId,
      userEmail: adminEmail,
      type: "manufacturer_application_submitted",
      message: `${application?.provider_name || application?.provider_email || "A provider"} applied to ${manufacturerName}.`,
      linkPage: `AdminManufacturers?focus_application=${encodeURIComponent(application?.id || "")}`,
    });

    if (!adminEmail || !isValidEmail(adminEmail)) continue;
    await sendEmailFromTemplate("manufacturer_application_admin_alert", {
      to: adminEmail,
      first_name: greetingName,
      manufacturer_name: manufacturerName,
      summary_lines: summary,
    });
  }
}

export async function notifyRepOfManufacturerApplication({
  application,
  manufacturer,
}) {
  const repEmail = String(manufacturer?.account_rep_email || "").trim();
  if (!repEmail || !isValidEmail(repEmail)) return;

  const summary = buildSummaryBullets({ application, manufacturer });
  await sendEmailFromTemplate("manufacturer_application_rep", {
    to: repEmail,
    first_name: manufacturer?.account_rep_name || "there",
    manufacturer_name: manufacturer?.name || application?.manufacturer_name || "your account",
    summary_lines: summary,
  });
}

export async function notifyRepOfContactRequest({
  orderRequest,
  manufacturer,
  providerEmail,
  providerPhone = "",
  savedRep = null,
}) {
  const repEmail = String(
    orderRequest?.rep_email || savedRep?.rep_email || manufacturer?.account_rep_email || ""
  ).trim();
  if (!repEmail || !isValidEmail(repEmail)) return { repSent: false, providerSent: false };

  const repGreetingName =
    savedRep?.rep_name || manufacturer?.account_rep_name || "there";

  const isOrder = orderRequest?.contact_type === "order";
  const mfrName = manufacturer?.name || orderRequest?.manufacturer_name || "Supplier";
  const providerName = orderRequest?.provider_name || "NOVI Provider";
  const subject =
    orderRequest?.subject ||
    (isOrder
      ? `Order Request — ${providerName} (${mfrName})`
      : `Provider Message — ${providerName}`);

  const basicProviderLines = [
    `Supplier: ${mfrName}`,
    `Provider: ${providerName}`,
    orderRequest?.provider_email ? `Provider email: ${orderRequest.provider_email}` : null,
    providerPhone ? `Phone: ${providerPhone}` : null,
    orderRequest?.practice_name ? `Practice: ${orderRequest.practice_name}` : null,
  ].filter(Boolean);

  const summary = isOrder
    ? [...basicProviderLines, "Request type: Product order"]
    : [...basicProviderLines, `Request type: ${orderRequest?.contact_type || "message"}`];

  const intro = isOrder
    ? `${providerName} submitted a product order request through NOVI. Basic contact details and order lines are below — reply directly to confirm pricing and fulfillment.`
    : `${providerName} sent a message through the NOVI supplier marketplace. Reply directly to follow up.`;

  const orderItems = isOrder
    ? mapOrderItemsForRegistry(
        orderRequest?.order_items?.length ? orderRequest.order_items : orderRequest?.orderItems
      )
    : [];
  const providerMessage = orderRequest?.message || "";

  const repResult = await sendEmailFromTemplate("manufacturer_contact_rep", {
    to: repEmail,
    first_name: repGreetingName,
    contact_subject: subject,
    intro,
    summary_lines: summary,
    order_items: orderItems,
    message: providerMessage,
  });
  const repSent = repResult.ok === true;

  let providerSent = false;
  const copyEmail = String(providerEmail || orderRequest?.provider_email || "").trim();
  if (copyEmail && isValidEmail(copyEmail)) {
    const copyIntro = isOrder
      ? `A copy of your order request to ${mfrName} is below. Their rep team typically responds within 3–5 business days.`
      : `A copy of your message to ${mfrName} is below. Their rep team typically responds within 3–5 business days.`;
    const providerResult = await sendEmailFromTemplate("manufacturer_contact_provider_copy", {
      to: copyEmail,
      first_name: providerName || "there",
      contact_subject: subject,
      intro: copyIntro,
      summary_lines: summary,
      order_items: orderItems,
      message: providerMessage,
    });
    providerSent = providerResult.ok === true;
  }

  return { repSent, providerSent };
}
