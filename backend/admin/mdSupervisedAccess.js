import { query } from "./db.js";

export function isMedicalDirectorRole(role) {
  return String(role || "").trim().toLowerCase() === "medical_director";
}

/** Resolve auth_user_id and app users.id for a provider identifier. */
export async function getProviderIdAliases(providerId) {
  const id = String(providerId || "").trim();
  if (!id) return [];
  const aliases = new Set([id]);
  const { rows } = await query(
    `select id::text as app_user_id, auth_user_id::text as auth_user_id, lower(email) as email
     from public.users
     where auth_user_id::text = $1 or id::text = $1
     limit 1`,
    [id]
  );
  const row = rows?.[0];
  if (row?.app_user_id) aliases.add(String(row.app_user_id));
  if (row?.auth_user_id) aliases.add(String(row.auth_user_id));
  return { aliases: Array.from(aliases), email: row?.email || null };
}

/** True when MD has an active supervision relationship with this provider. */
export async function mdHasActiveSupervisionOf(me, providerId) {
  if (!isMedicalDirectorRole(me?.role)) return false;
  const { aliases } = await getProviderIdAliases(providerId);
  if (!aliases.length) return false;
  const { rows } = await query(
    `select 1
       from public.medical_director_relationship r
      where r.medical_director_id = $1
        and lower(coalesce(r.status, '')) = 'active'
        and r.provider_id::text = any($2::text[])
      limit 1`,
    [String(me.id || ""), aliases]
  );
  return Boolean(rows[0]);
}
