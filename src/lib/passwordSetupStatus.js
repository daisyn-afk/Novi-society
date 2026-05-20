/** Matches public.users.password_setup_status (see migration 20260520140000). */

export const PASSWORD_SETUP_STATUS = {
  PENDING: "password_reset_pending",
  COMPLETED: "password_created_successfully",
};

export const PASSWORD_SETUP_LABELS = {
  [PASSWORD_SETUP_STATUS.PENDING]: "Password Reset Pending",
  [PASSWORD_SETUP_STATUS.COMPLETED]: "Password Created Successfully",
  not_sent: "Reset Email Not Sent",
};

export function isPasswordSetupComplete(status) {
  return status === PASSWORD_SETUP_STATUS.COMPLETED;
}

export function getPasswordSetupLabel(status) {
  if (!status) return PASSWORD_SETUP_LABELS.not_sent;
  return PASSWORD_SETUP_LABELS[status] || status;
}
