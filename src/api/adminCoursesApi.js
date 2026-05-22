import { adminApiRequest } from "./adminApiRequest.js";

function coursesListPath(type, { publicCatalog = false } = {}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (publicCatalog) params.set("public", "1");
  const qs = params.toString();
  return `/admin/courses${qs ? `?${qs}` : ""}`;
}

export const adminCoursesApi = {
  list: (type, options) => adminApiRequest(coursesListPath(type, options)),
  getById: (id) => adminApiRequest(`/admin/courses/${id}`),
  create: (payload) =>
    adminApiRequest("/admin/courses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    adminApiRequest(`/admin/courses/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    adminApiRequest(`/admin/courses/${id}`, {
      method: "DELETE",
    }),
};
