import { query } from "../db.js";

export function isUsableMdContractUrl(value) {
  const raw = String(value || "").trim();
  return /^https?:\/\//i.test(raw);
}

/** Latest non-empty MD contract URL configured on any service type. */
export async function getGlobalMdContractUrl() {
  const { rows } = await query(
    `select md_contract_url
       from public.service_type
      where coalesce(trim(md_contract_url), '') <> ''
      order by updated_at desc nulls last
      limit 1`
  );
  const url = String(rows[0]?.md_contract_url || "").trim();
  return isUsableMdContractUrl(url) ? url : "";
}

/** Remove MD contract from every service type (column + legacy metadata copy). */
export async function clearMdContractFromAllServices() {
  const { rowCount } = await query(
    `update public.service_type
        set md_contract_url = '',
            metadata = case
              when metadata is not null and jsonb_typeof(metadata) = 'object'
              then metadata - 'md_contract_url'
              else metadata
            end`
  );
  return rowCount ?? 0;
}

/** Apply one MD contract URL to every service type (empty clears all). New services inherit on create. */
export async function propagateMdContractToAllServices(mdContractUrl) {
  const url = String(mdContractUrl || "").trim();
  if (!isUsableMdContractUrl(url)) {
    return clearMdContractFromAllServices();
  }
  const { rowCount } = await query(
    `update public.service_type
        set md_contract_url = $1`,
    [url]
  );
  return rowCount ?? 0;
}
