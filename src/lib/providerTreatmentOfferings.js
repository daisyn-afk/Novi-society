import {
  servicesInMembership,
  serviceDisplayName,
  treatmentMenuServiceTypes,
  expandActiveServiceIds,
} from "./serviceTypeMembershipModel";

/** Default offering row when membership unlocks a child treatment service. */
export function defaultOfferingForService(st, allServiceTypes = []) {
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

/**
 * Merge default offering stubs for membership-included services not yet in service_offerings_v2.
 */
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

/** Included services unlocked by one membership subscription. */
export function membershipUnlockedServices(membership, serviceTypes = []) {
  return servicesInMembership(membership, serviceTypes);
}
