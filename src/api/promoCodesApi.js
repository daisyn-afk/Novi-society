import { adminApiRequest } from "./adminApiRequest";

export const promoCodesApi = {
  list: () => adminApiRequest("/admin/promo-codes"),
  create: (payload) =>
    adminApiRequest("/admin/promo-codes", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  update: (id, payload) =>
    adminApiRequest(`/admin/promo-codes/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  remove: (id) =>
    adminApiRequest(`/admin/promo-codes/${id}`, {
      method: "DELETE"
    })
};
