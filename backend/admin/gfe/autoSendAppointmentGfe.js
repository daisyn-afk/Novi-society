/**
 * Best-effort Qualiphy GFE invite when a patient books a service that requires_gfe.
 * Failures are logged; booking is never rolled back.
 */
import { query } from "../db.js";
import {
  APPOINTMENT_QUALIPHY_EXAM_IDS_SQL,
  APPOINTMENT_REQUIRES_GFE_SQL,
  APPOINTMENT_SERVICE_TYPE_JOINS,
} from "../lib/treatmentServiceType.js";
import { sendAppointmentQualiphyGfeInviteCore } from "./sendAppointmentQualiphyGfeCore.js";

export async function autoSendAppointmentGfeBestEffort(appointmentId) {
  const id = String(appointmentId || "").trim();
  if (!id) return { sent: false, reason: "missing_appointment_id" };

  try {
    const { rows } = await query(
      `select a.id, a.gfe_status,
              ${APPOINTMENT_REQUIRES_GFE_SQL} as resolved_requires_gfe
         from public.appointments a
         ${APPOINTMENT_SERVICE_TYPE_JOINS}
        where a.id = $1
        limit 1`,
      [id]
    );
    const appt = rows[0];
    if (!appt) return { sent: false, reason: "not_found" };
    if (appt.resolved_requires_gfe !== true && appt.requires_gfe !== true) {
      return { sent: false, reason: "gfe_not_required" };
    }
    const status = String(appt.gfe_status || "").toLowerCase();
    if (status && !["not_sent", "not_required", ""].includes(status)) {
      return { sent: false, reason: "already_initiated" };
    }

    const result = await sendAppointmentQualiphyGfeInviteCore({ appointmentId: id, bestEffort: true });
    return { sent: result?.success === true, ...result };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[gfe-auto] invite skipped:", error?.message || error);
    return { sent: false, reason: error?.message || "failed" };
  }
}
