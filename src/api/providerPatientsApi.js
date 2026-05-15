import { adminApiRequest } from "./adminApiRequest.js";

/**
 * POST /admin/provider-patients/csv-parse
 * Sends a CSV file to the backend for parsing.
 * Returns { headers, preview, totalRows }.
 */
export async function parseProviderPatientsCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  return adminApiRequest("/admin/provider-patients/csv-parse", {
    method: "POST",
    body: formData
  });
}

/**
 * POST /admin/provider-patients/csv-import
 * Sends fully-parsed rows + column mapping to import into the DB.
 * Returns { batchId, totalRows, imported, skipped, failed, errors }.
 *
 * @param {Array}  rows    - raw CSV rows (array of objects keyed by original CSV header)
 * @param {Object} mapping - maps system field names → CSV column headers
 *                           e.g. { email: "Email Address", first_name: "First Name", ... }
 */
export async function importProviderPatients(rows, mapping) {
  return adminApiRequest("/admin/provider-patients/csv-import", {
    method: "POST",
    body: JSON.stringify({ rows, mapping })
  });
}

/**
 * GET /admin/provider-patients
 * Returns all patients imported by the authenticated provider.
 */
export async function listProviderPatients() {
  return adminApiRequest("/admin/provider-patients", { method: "GET" });
}
