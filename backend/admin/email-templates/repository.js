/**
 * Repository for the email_templates table.
 *
 * The canonical list of templates lives in templateRegistry.js. The DB only
 * stores admin overrides (subject/body/cta/active). Reads merge registry
 * defaults with the override row so the API always returns the full catalog.
 */

import { pool } from "../db.js";
import {
  EMAIL_CATEGORIES,
  EMAIL_TEMPLATES,
  COMMON_PLACEHOLDERS,
  getTemplateDefinition,
  listTemplateDefinitions,
} from "../emails/templateRegistry.js";

let tablePresencePromise = null;

async function isTablePresent() {
  if (!tablePresencePromise) {
    tablePresencePromise = pool
      .query(
        `select 1
         from information_schema.tables
         where table_schema = 'public' and table_name = 'email_templates'
         limit 1`
      )
      .then((r) => Boolean(r.rows?.length))
      .catch(() => false);
  }
  return tablePresencePromise;
}

async function fetchAllOverrides() {
  if (!(await isTablePresent())) return new Map();
  const { rows } = await pool.query(
    `select template_key, subject, body_html, cta_label, cta_url_path,
            is_active, total_sent, last_sent_at, created_at, updated_at, name,
            category, recipient_type
       from public.email_templates`
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.template_key, row);
  }
  return map;
}

function mergeDefinition(definition, override = null) {
  const merged = {
    template_key: definition.template_key,
    name: override?.name || definition.name,
    category: override?.category || definition.category,
    recipient_type: override?.recipient_type || definition.recipient_type,
    subject: override?.subject != null ? override.subject : definition.subject,
    body_html: override?.body_html != null ? override.body_html : definition.body_html,
    cta_label: override?.cta_label != null ? override.cta_label : definition.cta_label || "",
    cta_url_path:
      override?.cta_url_path != null ? override.cta_url_path : definition.cta_url_path || "",
    is_active: override ? override.is_active !== false : true,
    total_sent: override?.total_sent || 0,
    last_sent_at: override?.last_sent_at || null,
    has_override: Boolean(override),
    placeholders: definition.placeholders || [],
    include_signoff: definition.include_signoff !== false,
    sample_vars: definition.sample_vars || {},
    default_subject: definition.subject,
    default_body_html: definition.body_html,
    default_cta_label: definition.cta_label || "",
    default_cta_url_path: definition.cta_url_path || "",
    created_at: override?.created_at || null,
    updated_at: override?.updated_at || null,
    id: override ? `tpl_${definition.template_key}` : `default_${definition.template_key}`,
  };
  return merged;
}

export async function listEmailTemplates() {
  const overrides = await fetchAllOverrides();
  return listTemplateDefinitions().map((def) => mergeDefinition(def, overrides.get(def.template_key)));
}

export async function getEmailTemplate(templateKey) {
  const definition = getTemplateDefinition(templateKey);
  if (!definition) return null;
  const overrides = await fetchAllOverrides();
  return mergeDefinition(definition, overrides.get(definition.template_key));
}

export async function upsertEmailTemplate(templateKey, payload = {}) {
  const definition = getTemplateDefinition(templateKey);
  if (!definition) {
    const err = new Error(`Unknown email template: ${templateKey}`);
    err.statusCode = 404;
    throw err;
  }
  if (!(await isTablePresent())) {
    const err = new Error("email_templates table is not present. Run migration 20260530150000_email_templates.sql.");
    err.statusCode = 500;
    throw err;
  }
  const cleaned = {
    template_key: definition.template_key,
    name: String(payload.name ?? definition.name).slice(0, 200),
    category: String(payload.category ?? definition.category).slice(0, 50),
    recipient_type: String(payload.recipient_type ?? definition.recipient_type).slice(0, 50),
    subject: String(payload.subject ?? definition.subject),
    body_html: String(payload.body_html ?? definition.body_html),
    cta_label:
      payload.cta_label === null ? null : String(payload.cta_label ?? definition.cta_label ?? ""),
    cta_url_path:
      payload.cta_url_path === null
        ? null
        : String(payload.cta_url_path ?? definition.cta_url_path ?? ""),
    is_active: payload.is_active == null ? true : Boolean(payload.is_active),
  };

  const { rows } = await pool.query(
    `insert into public.email_templates
       (template_key, name, category, recipient_type, subject, body_html,
        cta_label, cta_url_path, is_active)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (template_key) do update set
       name = excluded.name,
       category = excluded.category,
       recipient_type = excluded.recipient_type,
       subject = excluded.subject,
       body_html = excluded.body_html,
       cta_label = excluded.cta_label,
       cta_url_path = excluded.cta_url_path,
       is_active = excluded.is_active,
       updated_at = now()
     returning template_key, subject, body_html, cta_label, cta_url_path,
               is_active, total_sent, last_sent_at, created_at, updated_at,
               name, category, recipient_type`,
    [
      cleaned.template_key,
      cleaned.name,
      cleaned.category,
      cleaned.recipient_type,
      cleaned.subject,
      cleaned.body_html,
      cleaned.cta_label,
      cleaned.cta_url_path,
      cleaned.is_active,
    ]
  );

  return mergeDefinition(definition, rows[0]);
}

export async function deleteEmailTemplateOverride(templateKey) {
  if (!(await isTablePresent())) return null;
  await pool.query(`delete from public.email_templates where template_key = $1`, [templateKey]);
  return getEmailTemplate(templateKey);
}

export async function setEmailTemplateActive(templateKey, isActive) {
  return upsertEmailTemplate(templateKey, { is_active: Boolean(isActive) });
}

export function listCategoryMetadata() {
  return EMAIL_CATEGORIES.slice();
}

export function listCommonPlaceholders() {
  return COMMON_PLACEHOLDERS.slice();
}

// Re-export so route handlers don't need a separate import for sample data.
export { EMAIL_TEMPLATES };
