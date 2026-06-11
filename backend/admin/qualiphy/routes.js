import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { getBearerTokenFromRequest, hasAdminAccess } from "../auth/helpers.js";
import { processQualiphyExamWebhookBody } from "./webhookHandler.js";
import {
  buildGfeSimulationUrl,
  isGfeSimulationEnabled,
  mapSimulationOutcomeToExamStatus,
  verifyGfeSimulationToken,
  buildSimulatedWebhookPayload,
} from "./gfeSimulation.js";

export const qualiphyRouter = Router();

async function loadAppointmentForSimulation(appointmentId) {
  const id = String(appointmentId || "").trim();
  if (!id) return null;

  const { rows } = await query(
    `select a.id,
            a.patient_id,
            a.provider_id,
            a.patient_email,
            a.patient_name,
            a.provider_name,
            a.service,
            a.gfe_status,
            a.gfe_meeting_url,
            coalesce(nullif(trim(a.patient_email), ''), u.email) as resolved_patient_email,
            coalesce(nullif(trim(a.patient_name), ''), u.full_name) as resolved_patient_name,
            coalesce(st.requires_gfe, false) as requires_gfe
       from public.appointments a
       left join public.users u on u.auth_user_id::text = a.patient_id or u.id::text = a.patient_id
       left join public.service_type st on st.id::text = a.service_type_id::text
      where a.id = $1
      limit 1`,
    [id]
  );
  return rows[0] || null;
}

async function assertSimulationAccess({ appointmentId, token, me }) {
  const appt = await loadAppointmentForSimulation(appointmentId);
  if (!appt) {
    const err = new Error("Appointment not found.");
    err.statusCode = 404;
    throw err;
  }
  if (!isGfeSimulationEnabled()) {
    const err = new Error("GFE simulation is only available when QUALIPHY_ENV=test.");
    err.statusCode = 403;
    throw err;
  }
  if (appt.requires_gfe !== true) {
    const err = new Error("This appointment does not require a Good Faith Exam.");
    err.statusCode = 400;
    throw err;
  }

  const tokenOk = verifyGfeSimulationToken(appointmentId, token);
  const isPatientOwner = me && String(appt.patient_id || "") === String(me.id || "");
  const isPrivileged =
    me && (hasAdminAccess(me.role) || String(appt.provider_id || "") === String(me.id || ""));

  if (!tokenOk && !isPatientOwner && !isPrivileged) {
    const err = new Error("Invalid or missing simulation access token.");
    err.statusCode = 403;
    throw err;
  }

  return appt;
}

async function optionalMe(req) {
  const token = getBearerTokenFromRequest(req);
  if (!token) return null;
  try {
    return await getMeFromAccessToken(token);
  } catch {
    return null;
  }
}

qualiphyRouter.get("/gfe-simulate/context", async (req, res, next) => {
  try {
    const appointmentId = String(req.query.appointment_id || "").trim();
    const token = String(req.query.token || "").trim();
    const me = await optionalMe(req);
    const appt = await assertSimulationAccess({ appointmentId, token, me });

    const gfeStatus = String(appt.gfe_status || "").trim().toLowerCase();
    const alreadyCompleted = gfeStatus === "approved" || gfeStatus === "deferred";

    return res.json({
      simulation_enabled: true,
      appointment_id: appt.id,
      patient_name: appt.resolved_patient_name || appt.patient_name || "Patient",
      provider_name: appt.provider_name || "Provider",
      service_label: appt.service || "Appointment",
      gfe_status: appt.gfe_status || "pending",
      already_completed: alreadyCompleted,
      simulation_url: buildGfeSimulationUrl(appt.id, req),
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return next(error);
  }
});

qualiphyRouter.post("/gfe-simulate", async (req, res, next) => {
  try {
    const appointmentId = String(req.body?.appointment_id || "").trim();
    const token = String(req.body?.token || "").trim();
    const outcome = String(req.body?.outcome || "").trim();
    const me = await optionalMe(req);
    const appt = await assertSimulationAccess({ appointmentId, token, me });

    const examStatus = mapSimulationOutcomeToExamStatus(outcome);
    if (!examStatus) {
      return res.status(400).json({ error: "outcome must be approved or deferred." });
    }

    const currentStatus = String(appt.gfe_status || "").trim().toLowerCase();
    if (currentStatus === "approved") {
      return res.status(409).json({
        error: "This GFE is already approved.",
        gfe_status: appt.gfe_status,
      });
    }

    const payload = buildSimulatedWebhookPayload({
      appointmentId: appt.id,
      patientEmail: appt.resolved_patient_email || appt.patient_email,
      outcome,
      providerName: appt.provider_name || "GFE Simulator",
    });

    const result = await processQualiphyExamWebhookBody(payload);
    if (!result.handled) {
      return res.status(500).json({
        error: "Simulation webhook did not update the appointment.",
        result,
      });
    }

    const redirectGfe = examStatus === "Approved" ? "approved" : "deferred";
    return res.json({
      success: true,
      outcome: redirectGfe,
      gfe_status: result.gfe_status || redirectGfe,
      redirect_path: `/PatientAppointments?gfe=${redirectGfe}&appointment_id=${encodeURIComponent(appt.id)}`,
      webhook_result: result,
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return next(error);
  }
});
