export function getRequiredServiceTypeIds(manufacturer) {
  const ids = manufacturer?.required_service_type_ids;
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => String(id || "").trim()).filter(Boolean);
}

export function providerHasManufacturerCoverage(manufacturer, activeServiceIds) {
  const required = getRequiredServiceTypeIds(manufacturer);
  if (!required.length) return true;

  const active = activeServiceIds instanceof Set
    ? activeServiceIds
    : new Set((activeServiceIds || []).map((id) => String(id)));

  return required.some((id) => active.has(String(id)));
}

export function resolveRequiredServiceTypes(manufacturer, serviceTypes = []) {
  const required = getRequiredServiceTypeIds(manufacturer);
  const lookup = new Map(serviceTypes.map((st) => [String(st.id), st]));
  return required
    .map((id) => lookup.get(String(id)))
    .filter(Boolean);
}
