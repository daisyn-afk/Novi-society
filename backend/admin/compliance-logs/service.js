import { query } from "../db.js";
import { resolveActiveMdForProvider } from "./automationHelpers.js";

const LOG_TYPES = new Set([
  "supervision_check",
  "chart_review",
  "incident_report",
  "license_review",
  "certification_review",
  "note",
]);

export function mapComplianceLogRow(row) {
  return {
    ...row,
    action_required: row.action_required === true,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    source: row.source || "manual",
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

export async function hasOpenAutomatedLog(automatedKey) {
  const key = String(automatedKey || "").trim();
  if (!key) return false;
  const { rows } = await query(
    `select 1
       from public.compliance_logs
      where automated_key = $1
        and resolved_at is null
      limit 1`,
    [key]
  );
  return Boolean(rows[0]);
}

export async function insertComplianceLog({
  provider_id,
  provider_email,
  medical_director_id = null,
  created_by_id = "system",
  created_by_role = "system",
  log_type,
  summary,
  details = null,
  action_required = false,
  action_taken = null,
  attachments = [],
  source = "manual",
  automated_key = null,
}) {
  const type = String(log_type || "note").trim();
  if (!LOG_TYPES.has(type)) {
    throw new Error("Invalid log_type.");
  }
  const summaryText = String(summary || "").trim();
  if (!summaryText) {
    throw new Error("summary is required.");
  }

  let mdId = medical_director_id;
  if (!mdId && provider_id) {
    mdId = await resolveActiveMdForProvider(provider_id);
  }

  const { rows } = await query(
    `insert into public.compliance_logs (
       provider_id,
       provider_email,
       medical_director_id,
       created_by_id,
       created_by_role,
       log_type,
       summary,
       details,
       action_required,
       action_taken,
       attachments,
       source,
       automated_key
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)
     returning *`,
    [
      provider_id || null,
      provider_email || null,
      mdId,
      String(created_by_id || "system"),
      String(created_by_role || "system"),
      type,
      summaryText,
      details ? String(details) : null,
      action_required === true,
      action_taken ? String(action_taken) : null,
      JSON.stringify(Array.isArray(attachments) ? attachments : []),
      source === "automated" ? "automated" : "manual",
      automated_key ? String(automated_key) : null,
    ]
  );
  return mapComplianceLogRow(rows[0]);
}
