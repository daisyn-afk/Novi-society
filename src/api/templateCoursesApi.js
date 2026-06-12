import { adminApiRequest } from "./adminApiRequest.js";

/** Template saves can be slow on cold Vercel + Supabase; default 15s client timeout caused false failures. */
const TEMPLATE_WRITE_TIMEOUT_MS = 60_000;

/** Course templates: template_courses + certification + service_type */
export const templateCoursesApi = {
  list: () => adminApiRequest("/admin/template-courses"),
  getById: (id) => adminApiRequest(`/admin/template-courses/${id}`),
  create: (payload) =>
    adminApiRequest("/admin/template-courses", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: TEMPLATE_WRITE_TIMEOUT_MS,
    }),
  update: (id, payload) =>
    adminApiRequest(`/admin/template-courses/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      timeoutMs: TEMPLATE_WRITE_TIMEOUT_MS,
    }),
  remove: (id) =>
    adminApiRequest(`/admin/template-courses/${id}`, {
      method: "DELETE",
    }),
};
