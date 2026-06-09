import { query } from "../db.js";
import { insertComplianceLog } from "../compliance-logs/service.js";
import { insertAppNotification } from "../certificationNotifications.js";

async function listAdminRecipients() {
  const { rows } = await query(
    `select auth_user_id::text as auth_user_id, email, full_name, first_name
       from public.users
      where lower(coalesce(role, '')) in ('admin', 'super_admin', 'owner')
        and nullif(trim(email), '') is not null`
  );
  return rows || [];
}

async function listSupervisingMds(providerId) {
  const { rows } = await query(
    `select distinct medical_director_id::text as medical_director_id
       from public.medical_director_relationship
      where provider_id::text = $1
        and lower(coalesce(status, '')) = 'active'
        and medical_director_id is not null`,
    [String(providerId)]
  );
  return (rows || []).map((r) => String(r.medical_director_id)).filter(Boolean);
}

async function resolveUserContact(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  const { rows } = await query(
    `select auth_user_id::text as auth_user_id, email, full_name, first_name
       from public.users
      where auth_user_id::text = $1 or id::text = $1
      limit 1`,
    [id]
  );
  const row = rows?.[0];
  if (!row) return { userId: id, email: null, name: "User" };
  return {
    userId: String(row.auth_user_id || id),
    email: String(row.email || "").trim().toLowerCase() || null,
    name: String(row.first_name || row.full_name || "User").trim(),
  };
}

export async function processAdverseReactionEscalation({ treatmentRecordId }) {
  const id = String(treatmentRecordId || "").trim();
  if (!id) {
    const err = new Error("treatment_record_id is required.");
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await query(`select * from public.treatment_records where id = $1::uuid limit 1`, [id]);
  const record = rows?.[0];
  if (!record) {
    const err = new Error("Treatment record not found.");
    err.statusCode = 404;
    throw err;
  }
  if (!record.adverse_reaction) {
    return { escalated: false, reason: "no_adverse_reaction" };
  }

  const patientName = String(record.patient_name || record.patient_email || "Patient").trim();
  const providerName = String(record.provider_name || record.provider_email || "Provider").trim();
  const service = String(record.service || "treatment").trim();
  const notes = String(record.adverse_reaction_notes || "").trim();

  const flagSummary = `Adverse reaction documented during treatment documentation`;
  const details = JSON.stringify(
    {
      source: "adverse_reaction",
      treatment_record_id: id,
      patient_name: patientName,
      patient_id: record.patient_id,
      provider_id: record.provider_id,
      provider_name: providerName,
      service,
      adverse_reaction_notes: notes,
    },
    null,
    2
  );

  const complianceLog = await insertComplianceLog({
    provider_id: record.provider_id,
    provider_email: record.provider_email,
    log_type: "incident_report",
    summary: `Adverse reaction — ${patientName} (${service}) documented by ${providerName}. ${notes || "See treatment record."}`,
    details,
    action_required: true,
    source: "automated",
    automated_key: `adverse_reaction:${id}`,
    created_by_id: "system",
    created_by_role: "system",
  });

  await query(
    `update public.treatment_records
        set status = 'flagged',
            has_flagged_checkins = true,
            updated_at = now()
      where id = $1::uuid`,
    [id]
  );

  const mdIds = await listSupervisingMds(record.provider_id);
  for (const mdId of mdIds) {
    const md = await resolveUserContact(mdId);
    if (!md?.userId) continue;
    await insertAppNotification({
      user_id: md.userId,
      user_email: md.email,
      type: "adverse_reaction_escalation",
      message: `🚨 Adverse Reaction — ${patientName} (${service} with ${providerName}): ${flagSummary}. Review in MD Compliance.`,
      link_page: "MDCompliance",
    });
  }

  const admins = await listAdminRecipients();
  for (const admin of admins) {
    await insertAppNotification({
      user_id: String(admin.auth_user_id || ""),
      user_email: String(admin.email || "").trim().toLowerCase() || null,
      type: "adverse_reaction_escalation",
      message: `🚨 Adverse Reaction — ${patientName} (${service}): provider ${providerName} reported an adverse reaction.`,
      link_page: "AdminCompliance",
    });
  }

  return {
    escalated: true,
    compliance_log_id: complianceLog?.id || null,
    mds_notified: mdIds.length,
    admins_notified: admins.length,
  };
}
