import { adminApiRequest } from "./adminApiRequest";

export const emailTemplatesApi = {
  list: () => adminApiRequest("/admin/email-templates"),

  get: (id) => adminApiRequest(`/admin/email-templates/${id}`),

  create: (payload) =>
    adminApiRequest("/admin/email-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id, payload) =>
    adminApiRequest(`/admin/email-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  patch: (id, payload) =>
    adminApiRequest(`/admin/email-templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (id) =>
    adminApiRequest(`/admin/email-templates/${id}`, {
      method: "DELETE",
    }),

  testSend: (id, to) =>
    adminApiRequest(`/admin/email-templates/${id}/test-send`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
};
