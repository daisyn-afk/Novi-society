import { query } from "../db.js";
import {
  expandActiveServiceIds,
  servicesInMembership,
  serviceDisplayName,
  treatmentMenuServiceTypes,
} from "./serviceTypeMembershipModel.js";

function defaultOfferingForService(st, allServiceTypes = []) {
  const name = serviceDisplayName(st, allServiceTypes);
  const cat = String(st?.category || "other").toLowerCase();
  const isIv = /iv\b|intravenous/i.test(name);

  return {
    is_live: true,
    pricing_model: isIv ? "Flat fee" : cat === "injectables" ? "Per unit" : "Flat fee",
    duration_minutes: isIv ? 60 : cat === "injectables" ? 30 : 45,
    description: st?.description || "",
  };
}

export function seedMembershipTreatmentOfferings({
  existingOfferings = {},
  activeSubscriptions = [],
  serviceTypes = [],
} = {}) {
  const offerings =
    existingOfferings && typeof existingOfferings === "object" && !Array.isArray(existingOfferings)
      ? { ...existingOfferings }
      : {};

  const activeServiceIds = expandActiveServiceIds(activeSubscriptions, serviceTypes);
  const menuServices = treatmentMenuServiceTypes(serviceTypes, activeServiceIds);

  for (const st of menuServices) {
    const key = String(st.id);
    if (offerings[key] && typeof offerings[key] === "object") continue;
    offerings[key] = defaultOfferingForService(st, serviceTypes);
  }

  return offerings;
}

async function loadServiceTypes() {
  const { rows } = await query(
    `select id, name, description, category, is_membership, is_active,
            included_service_ids, legacy_parent_membership_id
       from public.service_type`
  );
  return rows.map((row) => ({
    ...row,
    included_service_ids: Array.isArray(row.included_service_ids) ? row.included_service_ids : [],
  }));
}

/**
 * After MD membership activation, ensure included child services appear in treatment menu offerings.
 */
export async function seedProviderTreatmentOfferingsForMembership({
  providerId,
  membershipServiceTypeId,
}) {
  const pid = String(providerId || "").trim();
  const membershipId = String(membershipServiceTypeId || "").trim();
  if (!pid || !membershipId) return { updated: false };

  const { rows: profileRows } = await query(
    `select pp.metadata
       from public.provider_profiles pp
       join public.users u on u.id = pp.user_id
      where u.auth_user_id = $1
      limit 1`,
    [pid]
  );
  const metadata =
    profileRows[0]?.metadata && typeof profileRows[0].metadata === "object"
      ? profileRows[0].metadata
      : {};

  const serviceTypes = await loadServiceTypes();
  const membership = serviceTypes.find((st) => String(st.id) === membershipId);
  if (!membership) return { updated: false };

  const unlocked = servicesInMembership(membership, serviceTypes);
  if (!unlocked.length) return { updated: false };

  const existing =
    metadata.service_offerings_v2 && typeof metadata.service_offerings_v2 === "object"
      ? metadata.service_offerings_v2
      : {};

  const activeSubscriptions = [{ service_type_id: membershipId, status: "active" }];
  const merged = seedMembershipTreatmentOfferings({
    existingOfferings: existing,
    activeSubscriptions,
    serviceTypes,
  });

  const changed = JSON.stringify(merged) !== JSON.stringify(existing);
  if (!changed) return { updated: false, service_ids: unlocked.map((s) => s.id) };

  const nextMetadata = { ...metadata, service_offerings_v2: merged };
  await query(
    `update public.provider_profiles pp
        set metadata = $2::jsonb,
            updated_at = now()
       from public.users u
      where pp.user_id = u.id
        and u.auth_user_id = $1`,
    [pid, JSON.stringify(nextMetadata)]
  );

  return { updated: true, service_ids: unlocked.map((s) => s.id) };
}
