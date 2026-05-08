import { adminApiRequest } from "./adminApiRequest.js";

export const courseCheckoutApi = {
  createCheckout: (payload) =>
    adminApiRequest("/admin/checkout/course", {
      method: "POST",
      body: JSON.stringify(payload),
      // Stripe + DB work can exceed default 15s on cold starts/serverless.
      timeoutMs: Number(import.meta.env.VITE_COURSE_CHECKOUT_TIMEOUT_MS || 45000)
    }),

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
