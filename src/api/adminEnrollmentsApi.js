import { adminApiRequest } from "./adminApiRequest.js";

export const adminEnrollmentsApi = {
  repairPaidEnrollments: () =>
    adminApiRequest("/admin/enrollments/repair", {
      method: "POST"
    })
};
