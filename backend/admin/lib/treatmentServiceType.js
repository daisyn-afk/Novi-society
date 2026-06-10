/**
 * Resolve the individual treatment service row for appointments / GFE.
 * Membership plans never carry GFE settings — only child services do.
 */
export async function resolveTreatmentServiceType(query, { serviceName, serviceTypeId } = {}) {
  const name = String(serviceName || "").trim();
  const stId = String(serviceTypeId || "").trim();

  if (stId) {
    const { rows } = await query(
      `select id, name, requires_gfe, qualiphy_exam_ids, is_membership
         from public.service_type
        where id = $1
        limit 1`,
      [stId]
    );
    const row = rows[0];
    if (row && row.is_membership !== true) return row;
  }

  if (name) {
    const { rows } = await query(
      `select id, name, requires_gfe, qualiphy_exam_ids, is_membership
         from public.service_type
        where coalesce(is_membership, false) = false
          and lower(trim(name)) = lower(trim($1))
        limit 1`,
      [name]
    );
    if (rows[0]) return rows[0];
  }

  return null;
}

/** SQL fragments for appointment joins — prefer service row matched by name over membership id. */
export const APPOINTMENT_SERVICE_TYPE_JOINS = `
  left join public.service_type st on st.id::text = a.service_type_id::text
  left join public.service_type st_svc on coalesce(st_svc.is_membership, false) = false
    and lower(trim(st_svc.name)) = lower(trim(coalesce(a.service, '')))
`;

export const APPOINTMENT_REQUIRES_GFE_SQL = `coalesce(
  case when coalesce(st.is_membership, false) = false then st.requires_gfe else null end,
  st_svc.requires_gfe,
  false
)`;

export const APPOINTMENT_QUALIPHY_EXAM_IDS_SQL = `coalesce(
  case when coalesce(st.is_membership, false) = false then st.qualiphy_exam_ids else null end,
  st_svc.qualiphy_exam_ids,
  '[]'::jsonb
)`;
