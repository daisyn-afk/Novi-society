/** Effective GFE status for UI when service requires an exam. */
export function appointmentGfeDisplayStatus(appt) {
  if (!appt || appt.requires_gfe !== true) return "not_required";
  const status = String(appt.gfe_status || "").trim();
  if (!status || status === "not_required") return "not_sent";
  return status;
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
