import crypto from "node:crypto";
import { resolveAppBaseUrl } from "../lib/frontendBaseUrl.js";
import { getQualiphyApiKey, isQualiphyTestMode } from "./inviteConfig.js";

export const GFE_SIMULATE_PAGE_PATH = "/GfeSimulate";

function simulationSecret() {
  return getQualiphyApiKey() || String(process.env.GFE_SIMULATION_SECRET || "novi-gfe-sim-dev").trim();
}

export function isGfeSimulationEnabled() {
  return isQualiphyTestMode();
}

export function buildGfeSimulationToken(appointmentId) {
  const id = String(appointmentId || "").trim();
  if (!id) return "";
  return crypto.createHmac("sha256", simulationSecret()).update(`gfe-sim:${id}`).digest("hex");
}

export function verifyGfeSimulationToken(appointmentId, token) {
  const expected = buildGfeSimulationToken(appointmentId);
  const provided = String(token || "").trim();
  if (!expected || !provided || expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function buildGfeSimulationUrl(appointmentId, req = null) {
  const id = String(appointmentId || "").trim();
  if (!id) return "";
  const base = resolveAppBaseUrl(req);
  const token = buildGfeSimulationToken(id);
  const params = new URLSearchParams({ appointment_id: id, token });
  return `${base}${GFE_SIMULATE_PAGE_PATH}?${params.toString()}`;
}

export function isGfeSimulationUrl(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  try {
    const parsed = new URL(value, "http://localhost");
    return parsed.pathname.replace(/\/+$/, "").toLowerCase().endsWith(GFE_SIMULATE_PAGE_PATH.toLowerCase());
  } catch {
    return value.toLowerCase().includes(GFE_SIMULATE_PAGE_PATH.toLowerCase());
  }
}

export function buildSimulatedQualiphyInvite(appointmentId, req = null) {
  const id = String(appointmentId || "").trim();
  return {
    meetingUrl: buildGfeSimulationUrl(id, req),
    meetingUuid: `sim_${id}`,
    patientExamId: `sim_exam_${id}`,
    webhookUrl: null,
    simulated: true,
  };
}

export function mapSimulationOutcomeToExamStatus(outcome) {
  const value = String(outcome || "").trim().toLowerCase();
  if (value === "approved" || value === "approve") return "Approved";
  if (value === "deferred" || value === "reject" || value === "rejected") return "Deferred";
  return null;
}

export function buildSimulatedWebhookPayload({
  appointmentId,
  patientEmail,
  outcome,
  providerName = "GFE Simulator",
}) {
  const id = String(appointmentId || "").trim();
  const examStatus = mapSimulationOutcomeToExamStatus(outcome);
  if (!id || !examStatus) return null;

  return {
    event: "exam_completed",
    exam_status: examStatus,
    patient_email: String(patientEmail || "").trim(),
    provider_name: providerName,
    meeting_uuid: `sim_${id}`,
    patient_exam_id: `sim_exam_${id}`,
    exam_url: buildGfeSimulationUrl(id),
    additional_data: JSON.stringify({
      source: "novi_appointment",
      appointment_id: id,
      gfe_simulation: true,
    }),
    questions_answers: [
      {
        no: 1,
        question: "GFE simulation outcome",
        answer: examStatus === "Approved" ? "Approved (simulated)" : "Deferred (simulated)",
      },
    ],
  };
}
