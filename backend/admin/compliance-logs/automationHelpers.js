import { query } from "../db.js";
import { getProviderIdAliases } from "../mdSupervisedAccess.js";

export async function resolveActiveMdForProvider(providerId) {
  const { aliases } = await getProviderIdAliases(providerId);
  if (!aliases.length) return null;
  const { rows } = await query(
    `select medical_director_id
       from public.medical_director_relationship
      where lower(coalesce(status, '')) = 'active'
        and provider_id::text = any($1::text[])
      order by created_at desc nulls last
      limit 1`,
    [aliases]
  );
  return rows?.[0]?.medical_director_id || null;
}
