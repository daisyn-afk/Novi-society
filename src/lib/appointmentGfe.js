const ACTIVE_GFE_STATUSES = new Set(["pending", "approved", "deferred", "not_available", "not_sent"]);

/** Effective GFE status for UI when service requires an exam. */
export function appointmentGfeDisplayStatus(appt) {
  if (!appt) return "not_required";
  const status = String(appt.gfe_status || "").trim();
  if (ACTIVE_GFE_STATUSES.has(status)) return status || "not_sent";
  if (appt.requires_gfe !== true) return "not_required";
  return "not_sent";
}

/** Invite link (pending) or results URL (approved). */
export function appointmentGfeLink(appt) {
  if (!appt) return "";
  if (appt.gfe_status === "approved" && appt.gfe_exam_url) {
    return String(appt.gfe_exam_url).trim();
  }
  return String(appt.gfe_meeting_url || appt.gfe_exam_url || "").trim();
}

export function appointmentNeedsGfeSend(appt) {
  if (!appt || appt.requires_gfe !== true) return false;
  const status = appointmentGfeDisplayStatus(appt);
  return status === "not_sent" || status === "pending";
}

/** Patient can start the Qualiphy exam in a new tab (link already issued). */
export function patientCanTakeGfeExam(appt) {
  if (!appt || appt.requires_gfe !== true) return false;
  const status = appointmentGfeDisplayStatus(appt);
  if (status === "approved" || status === "deferred") return false;
  return status === "pending" && Boolean(appointmentGfeLink(appt));
}

export function patientAwaitingGfeInvite(appt) {
  if (!appt || appt.requires_gfe !== true) return false;
  return appointmentGfeDisplayStatus(appt) === "not_sent";
}

const GFE_RETURN_MESSAGES = {
  approved: "Your Good Faith Exam was approved. You're cleared for this visit.",
  deferred: "Your Good Faith Exam needs follow-up. Your provider will contact you if needed.",
  na: "The exam could not be completed right now. You can try again from this appointment.",
  missed: "No provider was available for your exam. Please try again from this appointment.",
};

export function gfeReturnNotice(gfeParam) {
  const key = String(gfeParam || "").trim().toLowerCase();
  return GFE_RETURN_MESSAGES[key] || null;
}
