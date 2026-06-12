function normalizeArea(value) {
  return String(value || "").trim().toLowerCase();
}

function areasMatch(allowed, treated) {
  const a = normalizeArea(allowed);
  const t = normalizeArea(treated);
  if (!a || !t) return false;
  return a === t || t.includes(a) || a.includes(t);
}

/**
 * Validate treatment log against ServiceType scope (allowed_areas, max_units_per_session, scope_rules).
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function validateTreatmentAgainstServiceScope(serviceType, payload = {}) {
  const violations = [];
  if (!serviceType) return { ok: true, violations };

  const serviceName = String(serviceType.name || "this service").trim();
  const areasTreated = Array.isArray(payload.areas_treated) ? payload.areas_treated : [];
  const unitsUsed = payload.units_used;
  const unitsLabel = String(payload.units_label || "units").trim() || "units";

  const allowedAreas = Array.isArray(serviceType.allowed_areas)
    ? serviceType.allowed_areas.map((a) => String(a || "").trim()).filter(Boolean)
    : [];

  if (allowedAreas.length > 0) {
    for (const area of areasTreated) {
      const trimmed = String(area || "").trim();
      if (!trimmed) continue;
      if (!allowedAreas.some((allowed) => areasMatch(allowed, trimmed))) {
        violations.push(
          `"${trimmed}" is not an allowed treatment area for ${serviceName}. Allowed: ${allowedAreas.join(", ")}.`
        );
      }
    }
  }

  const maxUnits = serviceType.max_units_per_session;
  if (maxUnits != null && maxUnits !== "" && unitsUsed != null && unitsUsed !== "") {
    const used = Number(unitsUsed);
    const max = Number(maxUnits);
    if (Number.isFinite(used) && Number.isFinite(max) && used > max) {
      violations.push(
        `${used} ${unitsLabel} exceeds the ${max} ${unitsLabel} maximum per session for ${serviceName}.`
      );
    }
  }

  const scopeRules = Array.isArray(serviceType.scope_rules) ? serviceType.scope_rules : [];
  for (const rule of scopeRules) {
    const ruleName = String(rule?.rule_name || "").trim();
    const ruleNameLower = ruleName.toLowerCase();
    const ruleValue = String(rule?.rule_value ?? "").trim();
    const ruleUnit = String(rule?.unit || "").trim();

    if (!ruleName || !ruleValue) continue;

    if (
      (ruleNameLower.includes("max units") || ruleNameLower.includes("max unit")) &&
      unitsUsed != null &&
      unitsUsed !== ""
    ) {
      const used = Number(unitsUsed);
      const limit = Number(ruleValue);
      if (Number.isFinite(used) && Number.isFinite(limit) && used > limit) {
        violations.push(
          `${ruleName}: ${used} ${unitsLabel} exceeds limit of ${limit}${ruleUnit ? ` ${ruleUnit}` : ""}.`
        );
      }
    }

    if (ruleNameLower.includes("max syringe") && unitsUsed != null && unitsUsed !== "") {
      const used = Number(unitsUsed);
      const limit = Number(ruleValue);
      if (Number.isFinite(used) && Number.isFinite(limit) && used > limit) {
        violations.push(
          `${ruleName}: ${used} exceeds limit of ${limit}${ruleUnit ? ` ${ruleUnit}` : ""}.`
        );
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

export async function loadServiceTypeScopeForTreatment(query, { serviceTypeId, serviceName } = {}) {
  const stId = String(serviceTypeId || "").trim();
  const name = String(serviceName || "").trim();

  if (stId) {
    const { rows } = await query(
      `select id, name, allowed_areas, max_units_per_session, scope_rules, protocol_document_urls, requires_gfe
         from public.service_type
        where id = $1
          and coalesce(is_membership, false) = false
        limit 1`,
      [stId]
    );
    if (rows[0]) return rows[0];
  }

  if (name) {
    const { rows } = await query(
      `select id, name, allowed_areas, max_units_per_session, scope_rules, protocol_document_urls, requires_gfe
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
