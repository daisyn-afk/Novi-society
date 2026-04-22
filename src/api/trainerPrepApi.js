import { adminApiRequest } from "./adminApiRequest.js";

export const trainerPrepApi = {
  listSupplyLists: () => adminApiRequest("/admin/trainer-prep/supply-lists"),
  createSupplyList: (payload) =>
    adminApiRequest("/admin/trainer-prep/supply-lists", {
      method: "POST",
      body: JSON.stringify(payload || {})
    }),
  createSupplyItem: (supplyListId, payload) =>
    adminApiRequest(`/admin/trainer-prep/supply-lists/${encodeURIComponent(supplyListId)}/items`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    }),
  getCourseChecklist: (courseIds) =>
    adminApiRequest("/admin/trainer-prep/courses", {
      method: "POST",
      body: JSON.stringify({ course_ids: courseIds || [] })
    }),
  setProgress: ({ scheduled_course_id, supply_item_id, is_checked }) =>
    adminApiRequest("/admin/trainer-prep/progress", {
      method: "POST",
      body: JSON.stringify({ scheduled_course_id, supply_item_id, is_checked })
    }),
  resetProgress: (scheduled_course_id) =>
    adminApiRequest("/admin/trainer-prep/reset", {
      method: "POST",
      body: JSON.stringify({ scheduled_course_id })
    })
};
