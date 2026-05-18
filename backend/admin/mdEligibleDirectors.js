import { query } from "./db.js";
import { getMdAssignmentPoolFromEnv, poolEntryCoversService } from "./mdAssignmentPool.js";

function normalizeProviderState(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s.length || s.length !== 2) return null;
  if (!/^[A-Z]{2}$/.test(s)) return null;
  return s;
}

function usePoolFallback() {
  return String(process.env.MD_ASSIGNMENT_POOL_FALLBACK || "").trim() === "1";
}

function useStateMatching() {
  return String(process.env.MD_ASSIGNMENT_STATE_MATCHING || "").trim() === "1";
}

async function runSql(client, text, params) {
  if (client) return client.query(text, params);
  return query(text, params);
}

/**
 * When state matching is on: MDs with no rows in `medical_director_state_license` are treated as
 * nationwide; MDs with rows must include `providerState`.
 */
async function filterEligibleByProviderState(client, mdList, providerState) {
  const st = normalizeProviderState(providerState);
  if (!st || !mdList.length) return mdList;
  const ids = mdList.map((m) => m.id).filter(Boolean);
  if (!ids.length) return [];

  const { rows: counts } = await runSql(
    client,
    `select medical_director_id, count(*)::int as cnt
     from public.medical_director_state_license
     where medical_director_id = any($1::text[])
     group by medical_director_id`,
    [ids]
  );
  const licensedCount = new Map((counts || []).map((r) => [String(r.medical_director_id), Number(r.cnt) || 0]));

  const { rows: matchRows } = await runSql(
    client,
    `select distinct medical_director_id
     from public.medical_director_state_license
     where medical_director_id = any($1::text[])
       and upper(trim(us_state)) = $2`,
    [ids, st]
  );
  const stateOk = new Set((matchRows || []).map((r) => String(r.medical_director_id)));

  return mdList.filter((m) => {
    const n = licensedCount.get(m.id) ?? 0;
    if (n === 0) return true;
    return stateOk.has(m.id);
  });
}

async function listEligibleFromServiceOfferings(client, serviceTypeId) {
  const st = String(serviceTypeId || "").trim();
  if (!st) return [];
  const { rows: fromDb } = await runSql(
    client,
    `select distinct u.auth_user_id::text as id, u.email, u.full_name
     from public.medical_director_service_offering o
     inner join public.users u on u.auth_user_id::text = o.medical_director_id
     where lower(coalesce(u.role, '')) = 'medical_director'
       and u.auth_user_id is not null
       and coalesce(u.is_active, true) = true
       and (o.service_type_id = $1 or o.service_type_id = '*')`,
    [st]
  );
  return (fromDb || [])
    .map((row) => ({
      id: String(row.id || "").trim(),
      email: String(row.email || "").trim(),
      full_name: String(row.full_name || "").trim(),
    }))
    .filter((row) => row.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function listEligibleFromPool(client, serviceTypeId) {
  const st = String(serviceTypeId || "").trim();
  if (!st) return [];
  const pool = getMdAssignmentPoolFromEnv();
  const { rows: mdRows } = await runSql(
    client,
    `select auth_user_id::text as id, email, full_name, role
     from public.users
     where lower(coalesce(role, '')) = 'medical_director'
       and auth_user_id is not null
       and coalesce(is_active, true) = true`
  );
  const mdById = new Map((mdRows || []).map((u) => [String(u.id || "").trim(), u]));
  const eligible = [];
  for (const entry of pool) {
    if (!poolEntryCoversService(entry, st)) continue;
    const uid = String(entry.user_id || "").trim();
    const row = mdById.get(uid);
    if (!row) continue;
    eligible.push({
      id: uid,
      email: entry.email || row.email || "",
      full_name: entry.display_name || row.full_name || row.email || "",
    });
  }
  eligible.sort((a, b) => a.id.localeCompare(b.id));
  return eligible;
}

/**
 * Board MDs eligible for auto-assignment for a given service_type_id.
 *
 * Primary (Ashlan): only active MDs with a row in `medical_director_service_offering` for this service or `*`.
 * Optional env `MD_ASSIGNMENT_STATE_MATCHING=1` + provider state: filter via `medical_director_state_license`.
 * Dev-only fallback: `MD_ASSIGNMENT_POOL_FALLBACK=1` restores env/JSON pool behaviour.
 *
 * @param {string} serviceTypeId
 * @param {{ providerState?: string|null }} [options]
 * @param {import('pg').PoolClient|null} [client]
 */
export async function listEligibleMedicalDirectorsForService(serviceTypeId, options = {}, client = null) {
  let list = await listEligibleFromServiceOfferings(client, serviceTypeId);
  if (!list.length && usePoolFallback()) {
    list = await listEligibleFromPool(client, serviceTypeId);
  }
  if (useStateMatching()) {
    list = await filterEligibleByProviderState(client, list, options.providerState);
  }
  return list;
}
