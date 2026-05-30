import { adminApiRequest } from "./adminApiRequest.js";

function sortByTreatmentDate(rows, descending = true) {
  return [...(rows || [])].sort((a, b) => {
    const av = a.treatment_date || a.created_at || "";
    const bv = b.treatment_date || b.created_at || "";
    if (av === bv) return 0;
    return descending ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
  });
}

export const treatmentRecordsApi = {
  listMine: async () => {
    const rows = await adminApiRequest("/admin/treatment-records?limit=200", {
      method: "GET",
    });
    return sortByTreatmentDate(Array.isArray(rows) ? rows : []);
  },

  listForPatient: async (patientId) => {
    const params = new URLSearchParams();
    if (patientId) params.set("patient_id", String(patientId));
    params.set("limit", "200");
    const rows = await adminApiRequest(`/admin/treatment-records?${params.toString()}`, {
      method: "GET",
    });
    return sortByTreatmentDate(Array.isArray(rows) ? rows : []);
  },
};
