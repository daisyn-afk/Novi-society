import { adminApiRequest } from "./adminApiRequest.js";

export const adminLocationsApi = {
  list: (search = "") =>
    adminApiRequest(
      `/admin/locations${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),
  create: (payload) =>
    adminApiRequest("/admin/locations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
