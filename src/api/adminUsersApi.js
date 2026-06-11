import { adminApiRequest } from "./adminApiRequest";

function browserFrontendOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "";
}

function buildQueryString(params = {}) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of entries) qs.set(k, String(v));
  return `?${qs.toString()}`;
}

export const adminUsersApi = {
  list: ({ page = 1, pageSize = 20, q = "", role = "", isActive = "" } = {}) =>
    adminApiRequest(
      `/admin/users${buildQueryString({
        page,
        page_size: pageSize,
        q,
        role,
        is_active: isActive
      })}`
    ),
  get: (id) => adminApiRequest(`/admin/users/${id}`),
  getProviderDetail: (id) => adminApiRequest(`/admin/users/${id}/provider-detail`),
  create: (payload) =>
    adminApiRequest("/admin/users", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        frontend_origin: payload?.frontend_origin || browserFrontendOrigin()
      })
    }),
  update: (id, payload) =>
    adminApiRequest(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  remove: (id) =>
    adminApiRequest(`/admin/users/${id}`, {
      method: "DELETE"
    }),
  sendPasswordReset: (id) =>
    adminApiRequest(`/admin/users/${id}/send-password-reset`, {
      method: "POST",
      body: JSON.stringify({
        frontend_origin: browserFrontendOrigin()
      })
    }),
  masterLogin: (id) =>
    adminApiRequest(`/admin/users/${id}/master-login`, {
      method: "POST",
      body: JSON.stringify({})
    })
};
