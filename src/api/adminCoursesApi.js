import { adminApiRequest } from "./adminApiRequest.js";

export const adminCoursesApi = {
  list: (type) =>
    adminApiRequest(`/admin/courses${type ? `?type=${encodeURIComponent(type)}` : ""}`),
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
