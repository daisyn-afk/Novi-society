import { adminApiRequest } from "./adminApiRequest.js";

export const reviewsApi = {
  listMine: () =>
    adminApiRequest("/admin/reviews?limit=200", { method: "GET" }),

  listForPatient: (patientId) => {
    const params = new URLSearchParams();
    if (patientId) params.set("patient_id", String(patientId));
    params.set("limit", "200");
    return adminApiRequest(`/admin/reviews?${params.toString()}`, { method: "GET" });
  },

  create: (payload) =>
    adminApiRequest("/admin/reviews", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
};
