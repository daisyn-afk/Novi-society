export const COMPLIANCE_LOG_TYPES = [
  "supervision_check",
  "chart_review",
  "incident_report",
  "license_review",
  "certification_review",
  "note",
];

export const COMPLIANCE_LOG_TYPE_INFO = {
  supervision_check: "MD checked in on a provider",
  chart_review: "MD reviewed patient charts",
  incident_report: "Something went wrong / adverse event",
  license_review: "Admin reviewed a provider's license",
  certification_review: "Admin reviewed a certification",
  note: "General free-form note",
};

export const EMPTY_COMPLIANCE_LOG_FORM = {
  log_type: "note",
  summary: "",
  details: "",
  provider_id: "",
  provider_email: "",
  action_required: false,
  attachments: [],
};

export function formatLogTypeLabel(type) {
  return String(type || "note").replace(/_/g, " ");
}

export function isLogPendingAction(log) {
  return Boolean(log?.action_required && !log?.resolved_at);
}

export function isAutomatedLog(log) {
  return String(log?.source || "").toLowerCase() === "automated";
}
