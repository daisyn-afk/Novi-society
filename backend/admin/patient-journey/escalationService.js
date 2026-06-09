import { query } from "../db.js";
import { insertComplianceLog } from "../compliance-logs/service.js";
import { insertAppNotification } from "../certificationNotifications.js";
import { resolveActiveMdForProvider } from "../compliance-logs/automationHelpers.js";
import { invokeOpenAiChat } from "../integrations/openaiServer.js";

/** Rule-based red flag detection per NOVI Journey escalation spec. */
export function detectCheckinRedFlags(checkin = {}) {
  const flags = [];
  const day = Number(checkin.day_number) || 1;
  const comfort = Number(checkin.comfort_level);
  const swelling = Number(checkin.swelling_level);
  const bruising = Number(checkin.bruising_level);
  const symptoms = Array.isArray(checkin.symptoms) ? checkin.symptoms.map((s) => String(s)) : [];
  const stage = String(checkin.ai_recovery_stage || "");

  if (swelling >= 4) flags.push({ code: "severe_swelling", label: "Severe swelling" });
  if (bruising >= 4) flags.push({ code: "severe_bruising", label: "Severe bruising" });
  if (comfort <= 1) flags.push({ code: "extreme_discomfort", label: "Extreme discomfort" });
  if (day > 5 && swelling >= 3) flags.push({ code: "persistent_swelling", label: "Persistent swelling past Day 5" });
  if (day > 7 && bruising >= 3) flags.push({ code: "persistent_bruising", label: "Persistent bruising past Day 7" });
  if (symptoms.includes("Itching") && swelling >= 2) {
    flags.push({ code: "allergic_risk", label: "Allergic response risk (itching + swelling)" });
  }
  if (day > 3 && symptoms.includes("Redness") && swelling >= 3) {
    flags.push({ code: "infection_risk", label: "Infection risk (redness + swelling past Day 3)" });
  }
  if (day > 5 && comfort <= 2) flags.push({ code: "ongoing_pain", label: "Ongoing pain past Day 5" });
  if (day > 5 && (stage === "Early Healing" || stage === "Peak Swelling")) {
    flags.push({ code: "slow_recovery", label: "Slow recovery progression past Day 5" });
  }

  return flags;
}

export function shouldEscalateCheckin(checkin = {}) {
  return detectCheckinRedFlags(checkin).length > 0;
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

async function generateClinicalEscalationSummary({
  patientName,
  treatmentName,
  providerName,
  checkin,
  redFlags,
}) {
  const flagList = redFlags.map((f) => f.label).join("; ");
  const prompt = `You are a clinical compliance AI assistant. A premium patient has submitted a daily check-in that triggered red flags requiring MD review.

Patient: ${patientName}
Treatment: ${treatmentName}
Provider: ${providerName}
Recovery day: ${checkin.day_number}
Comfort: ${checkin.comfort_level}/5
Swelling: ${checkin.swelling_level}/5
Bruising: ${checkin.bruising_level}/5
Symptoms: ${(checkin.symptoms || []).join(", ") || "none"}
Recovery stage: ${checkin.ai_recovery_stage || "unknown"}
Notes: ${checkin.notes || "none"}
Red flags triggered: ${flagList}

Write a concise 2-3 sentence clinical escalation summary for the Medical Director.
Use professional clinical language. Reference specific metrics and recommend appropriate next action.

Return JSON: { "clinical_summary": "..." }`;

  try {
    const res = await invokeOpenAiChat({ prompt, responseJson: true, temperature: 0.3 });
    return String(res?.clinical_summary || "").trim();
  } catch {
    return `Patient ${patientName} on Day ${checkin.day_number} post ${treatmentName} reported metrics outside typical recovery (${flagList}). Clinical review recommended.`;
  }
}

async function flagTreatmentRecord(treatmentRecordId, checkin, journeyMeta = {}) {
  const id = String(treatmentRecordId || "").trim();
  if (!id) return;

  const { rows } = await query(`select patient_checkins from public.treatment_records where id = $1::uuid limit 1`, [id]);
  const existing = Array.isArray(rows?.[0]?.patient_checkins) ? rows[0].patient_checkins : [];
  const entry = {
    ...checkin,
    patient_id: journeyMeta.patient_id || null,
    patient_name: journeyMeta.patient_name || null,
    submitted_at: new Date().toISOString(),
    escalated: true,
  };
  const alreadySaved = existing.some((c) => c.date === checkin.date && c.day_number === checkin.day_number);
  const merged = alreadySaved ? existing : [...existing, entry];

  await query(
    `update public.treatment_records set
      status = 'flagged',
      has_flagged_checkins = true,
      patient_checkins = $2::jsonb,
      last_checkin_date = $3,
      last_checkin_stage = $4,
      updated_at = now()
    where id = $1::uuid`,
    [
      id,
      JSON.stringify(merged),
      checkin.date || null,
      checkin.ai_recovery_stage || null,
    ]
  );
}

export async function processPatientCheckinEscalation({ journeyId, checkin, treatmentRecordId = null }) {
  const redFlags = detectCheckinRedFlags(checkin);
  if (!redFlags.length) {
    return { escalated: false, red_flags: [] };
  }

  const { rows } = await query(`select * from public.patient_journeys where id = $1::uuid limit 1`, [String(journeyId)]);
  const journey = rows?.[0];
  if (!journey) return { escalated: false, reason: "journey_not_found", red_flags: redFlags };

  const patientId = String(journey.patient_id || "");
  let appt = null;
  if (checkin.treatment_id) {
    const { rows: apptById } = await query(`select * from public.appointments where id = $1 limit 1`, [String(checkin.treatment_id)]);
    appt = apptById?.[0] || null;
  }
  if (!appt) {
    const { rows: apptRows } = await query(
      `select * from public.appointments
        where patient_id = $1 and status = 'completed'
        order by completed_at desc nulls last, appointment_date desc
        limit 1`,
      [patientId]
    );
    appt = apptRows?.[0] || null;
  }

  const patientName =
    String(appt?.patient_name || checkin.patient_name || journey.patient_email || "Patient").trim();
  const treatmentName = String(checkin.treatment_name || appt?.service || "Treatment").trim();
  const providerName = String(checkin.provider_name || appt?.provider_name || "Provider").trim();
  const providerId = String(appt?.provider_id || "").trim();
  const recordId = String(treatmentRecordId || appt?.treatment_record_id || "").trim();

  const flagSummary = redFlags.map((f) => f.label).join(", ");
  const clinicalSummary = await generateClinicalEscalationSummary({
    patientName,
    treatmentName,
    providerName,
    checkin,
    redFlags,
  });

  const details = JSON.stringify(
    {
      source: "patient_checkin",
      journey_id: journeyId,
      treatment_record_id: recordId || null,
      patient_name: patientName,
      patient_id: patientId,
      provider_id: providerId,
      provider_name: providerName,
      treatment: treatmentName,
      day_number: checkin.day_number,
      metrics: {
        comfort_level: checkin.comfort_level,
        swelling_level: checkin.swelling_level,
        bruising_level: checkin.bruising_level,
        symptoms: checkin.symptoms || [],
        ai_recovery_stage: checkin.ai_recovery_stage,
        ai_texture_score: checkin.ai_texture_score,
      },
      red_flags: redFlags,
      clinical_summary: clinicalSummary,
      checkin_notes: checkin.notes || null,
    },
    null,
    2
  );

  const automatedKey = `checkin_escalation:${journeyId}:${checkin.date || "unknown"}:${redFlags.map((f) => f.code).join(",")}`;

  const complianceLog = await insertComplianceLog({
    provider_id: providerId || null,
    provider_email: appt?.provider_email || null,
    log_type: "incident_report",
    summary: `Patient check-in red flags — ${patientName}, Day ${checkin.day_number} post ${treatmentName}: ${flagSummary}`,
    details,
    action_required: true,
    source: "automated",
    automated_key: automatedKey,
    created_by_id: "system",
    created_by_role: "system",
  });

  const mdAuthUserId = providerId ? await resolveActiveMdForProvider(providerId) : null;
  const md = mdAuthUserId ? await resolveUserContact(mdAuthUserId) : null;
  const provider = providerId ? await resolveUserContact(providerId) : null;

  if (md?.userId) {
    await insertAppNotification({
      user_id: md.userId,
      user_email: md.email,
      type: "patient_checkin_escalation",
      message: `🚨 Patient Red Flag — ${patientName} (Day ${checkin.day_number} post ${treatmentName} with ${providerName}): ${flagSummary}. AI summary: ${clinicalSummary}`,
      link_page: "MDCompliance",
    });
  }

  if (provider?.userId) {
    await insertAppNotification({
      user_id: provider.userId,
      user_email: provider.email,
      type: "patient_recovery_alert",
      message: `⚠️ Patient Recovery Alert — ${patientName} (Day ${checkin.day_number} post ${treatmentName}): ${flagSummary}. Your supervising MD has been notified.`,
      link_page: "ProviderPractice",
    });
  }

  if (recordId) {
    await flagTreatmentRecord(recordId, checkin, {
      patient_id: patientId,
      patient_name: patientName,
    });
  }

  return {
    escalated: true,
    red_flags: redFlags,
    clinical_summary: clinicalSummary,
    compliance_log_id: complianceLog?.id || null,
    flagged_treatment_record_id: recordId || null,
  };
}
