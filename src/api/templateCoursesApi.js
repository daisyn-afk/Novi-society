import { adminApiRequest } from "./adminApiRequest.js";

/** Course templates: template_courses + certification + service_type */
export const templateCoursesApi = {
  list: () => adminApiRequest("/admin/template-courses"),
  getById: (id) => adminApiRequest(`/admin/template-courses/${id}`),
  create: (payload) =>
    adminApiRequest("/admin/template-courses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    adminApiRequest(`/admin/template-courses/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    adminApiRequest(`/admin/template-courses/${id}`, {
      method: "DELETE",
    }),
};
