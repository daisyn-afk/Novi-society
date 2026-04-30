import { adminApiRequest } from "./adminApiRequest.js";

export const courseCheckoutApi = {
  createCheckout: (payload) =>
    adminApiRequest("/admin/checkout/course", {
      method: "POST",
      body: JSON.stringify(payload)
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
