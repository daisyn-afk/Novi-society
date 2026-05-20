import { adminApiRequest } from "./adminApiRequest.js";

export const coursePaymentsAdminApi = {
  list: (limit = 500) =>
    adminApiRequest(`/admin/course-payments?limit=${encodeURIComponent(String(limit))}`),
};
