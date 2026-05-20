import { adminApiRequest } from "./adminApiRequest.js";

export const migratedUsersAdminApi = {
  trackingSummary: () => adminApiRequest("/admin/migrated-users/tracking-summary"),

  sendPasswordReset: (payload) =>
    adminApiRequest("/admin/migrated-users/send-password-reset", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        frontend_origin:
          payload?.frontend_origin ||
          (typeof window !== "undefined" ? window.location.origin : ""),
      }),
    }),

  getPasswordSetupStatus: (email) =>
    adminApiRequest(
      `/admin/migrated-users/password-setup-status?email=${encodeURIComponent(String(email || ""))}`
    ),
};
