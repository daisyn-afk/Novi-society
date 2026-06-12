import { query } from "../db.js";
import {
  APPOINTMENT_QUALIPHY_EXAM_IDS_SQL,
  APPOINTMENT_REQUIRES_GFE_SQL,
  APPOINTMENT_SERVICE_TYPE_JOINS,
} from "../lib/treatmentServiceType.js";
import { sendAppointmentGfeInviteEmail, notifyPatientGfeInvite } from "../patientAppointmentEmails.js";
import { buildAppointmentGfeRedirectUrls } from "../qualiphy/config.js";
import {
  applyQualiphyTestPatientOverrides,
  getQualiphyApiKey,
  getQualiphyExamInviteApiUrl,
  getQualiphyRuntimeSummary,
  isQualiphyTestMode,
  resolveQualiphyInviteStates,
} from "../qualiphy/inviteConfig.js";
import {
  buildSimulatedQualiphyInvite,
  getGfeSimulationRuntimeSummary,
  isGfeSimulationEnabled,
} from "../qualiphy/gfeSimulation.js";
import { resolveQualiphyExamIdForAppointment } from "./qualiphyExamId.js";

let appointmentColumnsPromise = null;

async function getAppointmentColumnsSet() {
  if (!appointmentColumnsPromise) {
    appointmentColumnsPromise = query(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'appointments'`
    )
      .then((r) => new Set((r.rows || []).map((row) => String(row.column_name || "").toLowerCase())))
      .catch(() => new Set());
  }
  return appointmentColumnsPromise;
}

async function hasAppointmentColumn(name) {
  const cols = await getAppointmentColumnsSet();
  return cols.has(String(name || "").toLowerCase());
}

function splitNameParts(fullName) {
  const clean = String(fullName || "").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "Model" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function loadPatientGfeContact(patientId, patientEmail) {
  const pid = String(patientId || "").trim();
  const email = String(patientEmail || "").trim().toLowerCase();
  let dob = null;
  let phone = null;
  let state = null;

  if (pid) {
    const { rows } = await query(
      `select pp.date_of_birth, pp.phone, pp.state
         from public.users u
         left join public.patient_profiles pp on pp.user_id = u.id
        where u.auth_user_id::text = $1 or u.id::text = $1
        limit 1`,
      [pid]
    );
    const row = rows[0] || {};
    dob = normalizeDateOnly(row.date_of_birth);
    phone = String(row.phone || "").trim() || null;
    state = String(row.state || "").trim() || null;
  }

  return { dob, phone, state };
}

function extractUsStateAbbr(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return null;
  const m1 = s.match(/,\s*([A-Z]{2})\b/);
  if (m1?.[1]) return m1[1];
  const m2 = s.match(/\b([A-Z]{2})\b/);
  if (m2?.[1]) return m2[1];
  return null;
}

async function resolveTeleStateForAppointment({ appointment, patientState }) {
  const patientAbbr = extractUsStateAbbr(patientState);
  if (patientAbbr) return patientAbbr;
  const providerId = String(appointment?.provider_id || "").trim();
  if (providerId) {
    const { rows } = await query(
      `select pp.state from public.users u
        left join public.provider_profiles pp on pp.user_id = u.id
       where u.auth_user_id::text = $1 or u.id::text = $1 limit 1`,
      [providerId]
    );
    const providerAbbr = extractUsStateAbbr(rows[0]?.state);
    if (providerAbbr) return providerAbbr;
  }
  return null;
}

function parseQualiphyInviteResponse(invitePayload) {
  const meetingUrl = String(
    invitePayload?.meeting_url ||
      invitePayload?.url ||
      invitePayload?.exam_invite_url ||
      invitePayload?.gfe_url ||
      invitePayload?.data?.meeting_url ||
      invitePayload?.data?.url ||
      invitePayload?.data?.exam_invite_url ||
      ""
  ).trim();
  const meetingUuid = String(invitePayload?.meeting_uuid || invitePayload?.data?.meeting_uuid || "").trim();
  const patientExams = Array.isArray(invitePayload?.patient_exams)
    ? invitePayload.patient_exams
    : Array.isArray(invitePayload?.data?.patient_exams)
      ? invitePayload.data.patient_exams
      : [];
  const patientExamId =
    patientExams[0]?.patient_exam_id != null ? String(patientExams[0].patient_exam_id) : "";
  return { meetingUrl, meetingUuid, patientExamId };
}

async function requestQualiphyExamInvite(inviteFields, qualiphyRedirectUrls = null) {
  const qualiphyApiKey = getQualiphyApiKey();
  const qualiphyClinicId = process.env.QUALIPHY_CLINIC_ID || "";
  if (!qualiphyApiKey) {
    const err = new Error("QUALIPHY_API_KEY is not configured.");
    err.statusCode = 500;
    throw err;
  }

  const invitePayloadBody = applyQualiphyTestPatientOverrides({
    ...inviteFields,
    api_key: qualiphyApiKey,
  });

  if (qualiphyRedirectUrls && typeof qualiphyRedirectUrls === "object") {
    for (const key of ["redirect_approve", "redirect_reject", "redirect_na", "redirect_missed"]) {
      const value = String(qualiphyRedirectUrls[key] || "").trim();
      if (value) invitePayloadBody[key] = value;
    }
  }

  if (qualiphyClinicId) invitePayloadBody.clinic_id = qualiphyClinicId;

  const sendInvite = async (payload) => {
    const response = await fetch(getQualiphyExamInviteApiUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qualiphyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const responsePayload = await response.json().catch(() => ({}));
    return { response, responsePayload };
  };

  let { response: inviteRes, responsePayload: invitePayload } = await sendInvite(invitePayloadBody);
  let upstreamHttpCode = Number(invitePayload?.http_code || 0);
  let upstreamFailed = !inviteRes.ok || (Number.isFinite(upstreamHttpCode) && upstreamHttpCode >= 400);

  if (Boolean(invitePayloadBody?.clinic_id) && upstreamFailed) {
    const fallbackPayload = { ...invitePayloadBody };
    delete fallbackPayload.clinic_id;
    ({ response: inviteRes, responsePayload: invitePayload } = await sendInvite(fallbackPayload));
    upstreamHttpCode = Number(invitePayload?.http_code || 0);
    upstreamFailed = !inviteRes.ok || (Number.isFinite(upstreamHttpCode) && upstreamHttpCode >= 400);
  }

  if (upstreamFailed) {
    const upstreamError =
      invitePayload?.error_message || invitePayload?.message || invitePayload?.error || "Qualiphy invite request failed.";
    const err = new Error(upstreamError);
    err.statusCode = 502;
    throw err;
  }

  const { meetingUrl, meetingUuid, patientExamId } = parseQualiphyInviteResponse(invitePayload);
  if (!meetingUrl) {
    const err = new Error("Qualiphy did not return a GFE link.");
    err.statusCode = 502;
    throw err;
  }
  return { meetingUrl, meetingUuid, patientExamId };
}

/**
 * Send Qualiphy GFE invite for an appointment (provider-initiated or auto on booking).
 * @param {{ appointmentId: string, bestEffort?: boolean }} options
 */
export async function sendAppointmentQualiphyGfeInviteCore({ appointmentId, bestEffort = false }) {
  const id = String(appointmentId || "").trim();
  if (!id) {
    const err = new Error("appointment_id is required.");
    err.statusCode = 400;
    throw err;
  }

  const { rows: apptRows } = await query(
    `select a.*,
            coalesce(
              case when coalesce(st.is_membership, false) = false then st.name else null end,
              st_svc.name
            ) as service_type_name,
            ${APPOINTMENT_QUALIPHY_EXAM_IDS_SQL} as qualiphy_exam_ids,
            ${APPOINTMENT_REQUIRES_GFE_SQL} as requires_gfe,
            coalesce(nullif(trim(a.patient_email), ''), u.email) as resolved_patient_email,
            coalesce(nullif(trim(a.patient_name), ''), u.full_name) as resolved_patient_name,
            pp.phone as patient_phone,
            pp.state as patient_state,
            pp.date_of_birth as patient_dob
       from public.appointments a
       ${APPOINTMENT_SERVICE_TYPE_JOINS}
       left join public.users u on u.auth_user_id::text = a.patient_id or u.id::text = a.patient_id
       left join public.patient_profiles pp on pp.user_id = u.id
      where a.id = $1
      limit 1`,
    [id]
  );
  const appt = apptRows[0];
  if (!appt) {
    const err = new Error("Appointment not found.");
    err.statusCode = 404;
    throw err;
  }
  if (appt.requires_gfe !== true) {
    const err = new Error("This service does not require a Good Faith Exam.");
    err.statusCode = 400;
    throw err;
  }

  const qualiphyExamId = await resolveQualiphyExamIdForAppointment({
    serviceTypeId: appt.service_type_id,
    serviceName: appt.service || appt.service_type_name,
    qualiphyExamIds: appt.qualiphy_exam_ids,
  });
  if (!qualiphyExamId) {
    const err = new Error("No Qualiphy exam ID found for this service.");
    err.statusCode = 400;
    throw err;
  }

  const patientEmail = String(appt.resolved_patient_email || "").trim();
  if (!patientEmail) {
    const err = new Error("Patient email is required to send a GFE invite.");
    err.statusCode = 400;
    throw err;
  }

  const { firstName, lastName } = splitNameParts(appt.resolved_patient_name);
  if (!firstName || !lastName) {
    const err = new Error("Patient name is required to send a GFE invite.");
    err.statusCode = 400;
    throw err;
  }

  let dob = normalizeDateOnly(appt.patient_dob);
  let patientPhone = String(appt.patient_phone || "").trim();
  let patientState = appt.patient_state;
  const contact = await loadPatientGfeContact(appt.patient_id, patientEmail);
  if (!dob) dob = contact.dob;
  if (!patientPhone && contact.phone) patientPhone = contact.phone;
  if (!patientState && contact.state) patientState = contact.state;

  if (!isQualiphyTestMode()) {
    if (!dob) {
      const err = new Error("Patient date of birth is required before sending GFE.");
      err.statusCode = 400;
      throw err;
    }
    const digitsPhone = String(patientPhone || "").replace(/\D/g, "");
    if (digitsPhone.length < 10) {
      const err = new Error("Patient phone number is required before sending GFE.");
      err.statusCode = 400;
      throw err;
    }
  }

  const digitsPhone = String(patientPhone || "").replace(/\D/g, "");
  const normalizedPhone =
    digitsPhone.length === 10 ? `+1${digitsPhone}` : digitsPhone ? `+${digitsPhone}` : "+15555550100";

  const resolvedStateAbbr = await resolveTeleStateForAppointment({ appointment: appt, patientState });
  if (!isQualiphyTestMode() && !resolvedStateAbbr) {
    const err = new Error("Patient state is required before sending GFE.");
    err.statusCode = 400;
    throw err;
  }

  const { state, tele_state } = resolveQualiphyInviteStates({ stateAbbr: resolvedStateAbbr });

  const invite = isGfeSimulationEnabled()
    ? buildSimulatedQualiphyInvite(appt.id)
    : await requestQualiphyExamInvite(
        {
          exams: [Number(qualiphyExamId)],
          first_name: firstName,
          last_name: lastName,
          email: patientEmail,
          dob: dob || "1990-06-30",
          phone_number: normalizedPhone,
          state,
          tele_state,
          additional_data: JSON.stringify({ source: "novi_appointment", appointment_id: appt.id }),
        },
        buildAppointmentGfeRedirectUrls(appt.id)
      );

  const setParts = [
    "gfe_status = 'pending'",
    "gfe_meeting_url = $2",
    "gfe_exam_url = null",
    "gfe_sent_at = now()",
    "gfe_initiated_at = coalesce(gfe_initiated_at, now())",
    "updated_at = now()",
  ];
  const updateParams = [id, invite.meetingUrl];
  if (invite.meetingUuid && (await hasAppointmentColumn("qualiphy_meeting_uuid"))) {
    updateParams.push(invite.meetingUuid);
    setParts.push(`qualiphy_meeting_uuid = $${updateParams.length}`);
  }
  if (invite.patientExamId && (await hasAppointmentColumn("qualiphy_patient_exam_id"))) {
    updateParams.push(invite.patientExamId);
    setParts.push(`qualiphy_patient_exam_id = $${updateParams.length}`);
  }
  if (qualiphyExamId && (await hasAppointmentColumn("qualiphy_exam_id"))) {
    updateParams.push(String(qualiphyExamId));
    setParts.push(`qualiphy_exam_id = $${updateParams.length}`);
  }
  await query(`update public.appointments set ${setParts.join(", ")} where id = $1`, updateParams);

  try {
    await sendAppointmentGfeInviteEmail({
      to: patientEmail,
      patientName: appt.resolved_patient_name,
      providerName: appt.provider_name,
      serviceLabel: appt.service || appt.service_type_name,
      appointmentDate: appt.appointment_date,
      appointmentTime: appt.appointment_time,
      meetingUrl: invite.meetingUrl,
    });
    await notifyPatientGfeInvite({
      patientId: appt.patient_id,
      patientEmail,
      providerName: appt.provider_name,
      serviceLabel: appt.service || appt.service_type_name,
    });
  } catch (emailErr) {
    if (!bestEffort) throw emailErr;
    // eslint-disable-next-line no-console
    console.warn("[gfe-invite] notification failed:", emailErr?.message || emailErr);
  }

  return {
    success: true,
    meeting_url: invite.meetingUrl,
    email_sent: true,
    ...getQualiphyRuntimeSummary(),
    ...(isGfeSimulationEnabled() ? getGfeSimulationRuntimeSummary() : {}),
  };
}
