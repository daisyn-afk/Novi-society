import { adminApiRequest } from "./adminApiRequest.js";

export const gfeSimulateApi = {
  getContext: ({ appointmentId, token }) => {
    const params = new URLSearchParams({
      appointment_id: String(appointmentId || ""),
      token: String(token || ""),
    });
    return adminApiRequest(`/admin/qualiphy/gfe-simulate/context?${params.toString()}`, {
      method: "GET",
      retryOnAuthError: false,
    });
  },

  submitOutcome: ({ appointmentId, token, outcome }) =>
    adminApiRequest("/admin/qualiphy/gfe-simulate", {
      method: "POST",
      body: JSON.stringify({
        appointment_id: appointmentId,
        token,
        outcome,
      }),
      retryOnAuthError: false,
    }),
};
