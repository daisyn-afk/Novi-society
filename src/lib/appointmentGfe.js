import { format } from "date-fns";

const ACTIVE_GFE_STATUSES = new Set(["pending", "approved", "deferred", "not_available", "not_sent"]);

/** Effective GFE status for UI when service requires an exam. */
export function appointmentGfeDisplayStatus(appt) {
  if (!appt) return "not_required";
  if (appt.gfe_skip_send === true || appt.gfe_prerequisite_satisfied === true) {
    return "approved";
  }
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
  if (appt.gfe_skip_send === true || appt.gfe_prerequisite_satisfied === true) return false;
  const status = appointmentGfeDisplayStatus(appt);
  return status === "not_sent" || status === "pending";
}

/** Patient can start the Qualiphy exam in a new tab (link already issued). */
export function patientCanTakeGfeExam(appt) {
  if (!appt || appt.requires_gfe !== true) return false;
  if (appt.gfe_skip_send === true || appt.gfe_prerequisite_satisfied === true) return false;
  const status = appointmentGfeDisplayStatus(appt);
  if (status === "approved" || status === "deferred") return false;
  return status === "pending" && Boolean(appointmentGfeLink(appt));
}

export function patientAwaitingGfeInvite(appt) {
  if (!appt || appt.requires_gfe !== true) return false;
  if (appt.gfe_skip_send === true || appt.gfe_prerequisite_satisfied === true) return false;
  return appointmentGfeDisplayStatus(appt) === "not_sent";
}

export function appointmentGfeBlocksTreatment(appt) {
  if (!appt || appt.requires_gfe !== true) return false;
  return appt.gfe_prerequisite_satisfied !== true;
}

export function appointmentGfeBlockMessage(appt) {
  if (!appointmentGfeBlocksTreatment(appt)) return null;
  const category = appt.gfe_category_label || appt.gfe_category || "this treatment category";
  if (String(appt.gfe_status || "").toLowerCase() === "deferred") {
    return `The patient's Good Faith Exam for ${category} was deferred. A new approved exam is required before treatment can be logged or completed.`;
  }
  if (appt.gfe_expired === true) {
    return `The patient's Good Faith Exam for ${category} has expired. Send a new GFE and wait for approval before logging treatment.`;
  }
  return `A Good Faith Exam for ${category} must be approved before you can log treatment or mark this appointment done.`;
}

export function appointmentGfeValidityLabel(appt) {
  if (!appt?.gfe_valid_until) return null;
  try {
    return format(new Date(appt.gfe_valid_until), "MMM d, yyyy");
  } catch {
    return null;
  }
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
