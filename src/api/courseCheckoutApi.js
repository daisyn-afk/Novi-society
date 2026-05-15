import { adminApiRequest } from "./adminApiRequest.js";

export const courseCheckoutApi = {
  createCheckout: (payload) => {
    // Capture the client-side click timestamp synchronously so the backend can
    // detect stale frontend state by comparing it to server_received_timestamp.
    const clientTimestamp = new Date().toISOString();
    return adminApiRequest("/admin/checkout/course", {
      method: "POST",
      body: JSON.stringify({ ...(payload || {}), client_timestamp: clientTimestamp }),
      headers: { "x-novi-client-timestamp": clientTimestamp },
      // Stripe + DB work can exceed default 15s on cold starts/serverless.
      timeoutMs: Number(import.meta.env.VITE_COURSE_CHECKOUT_TIMEOUT_MS || 45000)
    });
  },

  createServicePreOrder: (payload) => {
    const clientTimestamp = new Date().toISOString();
    return adminApiRequest("/admin/checkout/service", {
      method: "POST",
      body: JSON.stringify({ ...(payload || {}), client_timestamp: clientTimestamp }),
      headers: { "x-novi-client-timestamp": clientTimestamp }
    });
  },

  validatePromoCode: ({ course_id, promo_code }) =>
    adminApiRequest("/admin/checkout/promo/validate", {
      method: "POST",
      body: JSON.stringify({ course_id, promo_code })
    }),

  uploadLicensePhoto: async (file) => {
    const body = new FormData();
    body.append("file", file);
    return adminApiRequest("/admin/uploads/license-photo", {
      method: "POST",
      body
    });
  }
};
