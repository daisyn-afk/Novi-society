/**
 * NOVI Board MD pool for the **API** (optional dev fallback only).
 *
 * **Primary eligibility:** `medical_director_service_offering` per MD (see MD dashboard → Services I cover).
 *
 * When `MD_ASSIGNMENT_POOL_FALLBACK=1`, the API may also use this pool (env JSON → repo file → NOVI_BOARD_MD_*).
 * Production should rely on per-MD service offerings and round-robin via `mdAssignmentService`.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT_POOL_PATH = join(__dirname, "../../src/config/novi-md-assignment-pool.json");

function envTrim(key) {
  return String(process.env[key] || "").trim();
}

function parsePoolJson(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function normalizePoolRows(parsed) {
  if (!parsed?.length) return [];
  return parsed
    .map((row) => ({
      user_id: String(row.user_id || row.id || "").trim(),
      email: row.email ? String(row.email).trim() : undefined,
      display_name: row.display_name ? String(row.display_name).trim() : undefined,
      service_type_ids: Array.isArray(row.service_type_ids)
        ? row.service_type_ids.map((x) => String(x).trim()).filter(Boolean)
        : ["*"],
    }))
    .filter((row) => row.user_id);
}

function readPoolFromRepoFile() {
  try {
    if (!existsSync(REPO_DEFAULT_POOL_PATH)) return [];
    const raw = readFileSync(REPO_DEFAULT_POOL_PATH, "utf8");
    const parsed = parsePoolJson(raw);
    return normalizePoolRows(parsed || []);
  } catch {
    return [];
  }
}

export function getMdAssignmentPoolFromEnv() {
  const raw = envTrim("MD_ASSIGNMENT_POOL") || envTrim("MD_ASSIGNMENT_POOL_JSON");
  const fromEnv = raw ? normalizePoolRows(parsePoolJson(raw) || []) : [];
  if (fromEnv.length) return fromEnv;

  const fromFile = readPoolFromRepoFile();
  if (fromFile.length) return fromFile;

  const id = envTrim("NOVI_BOARD_MD_USER_ID");
  const email = envTrim("NOVI_BOARD_MD_EMAIL");
  const name = envTrim("NOVI_BOARD_MD_DISPLAY_NAME");
  if (id && email) {
    return [{ user_id: id, email, display_name: name || email, service_type_ids: ["*"] }];
  }
  return [];
}

export function poolEntryCoversService(entry, serviceTypeId) {
  const st = String(serviceTypeId || "").trim();
  const ids = entry?.service_type_ids?.length ? entry.service_type_ids : ["*"];
  if (ids.includes("*")) return true;
  return ids.some((id) => String(id) === st);
}
