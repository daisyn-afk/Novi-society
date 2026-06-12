import {
  expandActiveServiceIds,
  serviceDisplayName,
  treatmentMenuServiceTypes,
} from "./serviceTypeMembershipModel";
import { isServicePracticable } from "./serviceAttestation";

/**
 * Individual treatment services a provider offers patients (booking + marketplace).
 * Prefers live rows from service_offerings_v2; falls back to all MD-covered services.
 */
export function providerBookableServices({
  providerId,
  providerOfferings = {},
  mdSubscriptions = [],
  serviceTypes = [],
  attestationContext = null,
} = {}) {
  const pid = String(providerId || "").trim();
  if (!pid) return [];

  const activeSubs = (mdSubscriptions || []).filter(
    (s) => String(s.provider_id) === pid && String(s.status || "").toLowerCase() === "active"
  );
  if (!activeSubs.length) return [];

  const offerings =
    providerOfferings && typeof providerOfferings === "object" && !Array.isArray(providerOfferings)
      ? providerOfferings
      : {};

  const activeServiceIds = expandActiveServiceIds(activeSubs, serviceTypes);
  let coveredServices = treatmentMenuServiceTypes(serviceTypes, activeServiceIds);
  if (attestationContext) {
    coveredServices = coveredServices.filter((st) => isServicePracticable(st, attestationContext));
  }

  const liveServices = coveredServices.filter((st) => offerings[String(st.id)]?.is_live === true);
  const pick = liveServices.length > 0 ? liveServices : coveredServices;

  return pick
    .map((st) => ({
      id: String(st.id),
      name: serviceDisplayName(st, serviceTypes),
      category: String(st.category || "").toLowerCase(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function providerBookableServiceNames(options = {}) {
  return providerBookableServices(options).map((s) => s.name);
}
