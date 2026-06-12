import { query } from "../db.js";
import { listEligibleMedicalDirectorsForService } from "../mdEligibleDirectors.js";

function normalizeProviderState(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s || s.length !== 2 || !/^[A-Z]{2}$/.test(s)) return null;
  return s;
}

function usePoolFallback() {
  return String(process.env.MD_ASSIGNMENT_POOL_FALLBACK || "").trim() === "1";
}

function useStateMatching() {
  return String(process.env.MD_ASSIGNMENT_STATE_MATCHING || "").trim() === "1";
}

async function countServiceOfferings(serviceTypeId) {
  const st = String(serviceTypeId || "").trim();
  if (!st) return { total: 0, eligibleRole: 0, wrongRole: 0 };
  const { rows } = await query(
    `select lower(coalesce(u.role, '')) as role
     from public.medical_director_service_offering o
     inner join public.users u on u.auth_user_id::text = o.medical_director_id
     where (o.service_type_id = $1 or o.service_type_id = '*')
       and u.auth_user_id is not null
       and coalesce(u.is_active, true) = true`,
    [st]
  );
  const total = rows.length;
  const eligibleRole = rows.filter((r) => r.role === "medical_director").length;
  return { total, eligibleRole, wrongRole: total - eligibleRole };
}

/**
 * User-facing explanation when auto-rassignment would fail for one sz
 * resrvice.
 */
export async function explainMdAssignmentBlocker(serviceTypeId, serviceTypeName, providerState, { brief = false } = {}) {
  const label = String(serviceTypeName || serviceTypeId || "this service").trim();
  const pState = normalizeProviderState(providerState);
  const prefix = brief ? "" : `No medical director could be assigned for ${label}: `;

  const { total, eligibleRole, wrongRole } = await countServiceOfferings(serviceTypeId);

  if (eligibleRole === 0) {
    if (wrongRole > 0) {
      return `${prefix}Someone is listed under Services I cover, but their account is not set up as a medical director. Contact NOVI support to correct the MD account role.`;
    }
    if (total === 0 && !usePoolFallback()) {
      return `${prefix}No Board MD lists this service under Services I cover in their MD Profile.`;
    }
    if (total === 0) {
      return `${prefix}The assignment pool has no MD for this service.`;
    }
    return `${prefix}No eligible Board MD is available.`;
  }

  if (useStateMatching() && pState) {
    const beforeState = await listEligibleMedicalDirectorsForService(serviceTypeId, {});
    const afterState = await listEligibleMedicalDirectorsForService(serviceTypeId, { providerState: pState });
    if (beforeState.length > 0 && afterState.length === 0) {
      return `${prefix}Board MDs offer this service, but none cover your practice state (${pState}). The supervising MD must enable Nationwide supervision or add a state license for ${pState}.`;
    }
  }

  const eligible = await listEligibleMedicalDirectorsForService(serviceTypeId, {
    providerState: pState,
  });
  if (eligible.length > 0) {
    return brief
      ? "Assignment did not complete during activation — contact NOVI support to retry assignment."
      : `No medical director is linked yet for ${label}. Assignment did not complete during activation — contact NOVI support to retry assignment.`;
  }

  return brief ? "No eligible medical director is available for this service." : `No medical director could be assigned for ${label}.`;
}

/**
 * Primary reason a provider has no supervising MD (null when MD is assigned).
 */
export async function resolveUnassignedMdReason({
  lookupIds,
  providerState,
  hasActiveRelationship,
}) {
  if (hasActiveRelationship) return null;

  const ids = (lookupIds || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!ids.length) {
    return "No supervising MD is assigned. Activate MD Board coverage for a service to be assigned automatically.";
  }

  const { rows: subs } = await query(
    `select service_type_id, service_type_name
     from public.md_subscription
     where provider_id::text = any($1::text[])
       and lower(coalesce(status, '')) = 'active'
     order by activated_at desc nulls last, created_at desc nulls last`,
    [ids]
  );

  if (!subs.length) {
    return "No supervising MD is assigned. Activate MD Board coverage for a service first — NOVI assigns a Board medical director automatically at checkout.";
  }

  const pState = normalizeProviderState(providerState);
  const gaps = [];

  for (const sub of subs) {
    const serviceTypeId = String(sub.service_type_id || "").trim();
    if (!serviceTypeId) continue;
    const { rows: rel } = await query(
      `select 1
       from public.medical_director_relationship
       where provider_id::text = any($1::text[])
         and coalesce(service_type_id, '') = $2
         and lower(coalesce(status, '')) = 'active'
       limit 1`,
      [ids, serviceTypeId]
    );
    if (rel[0]) continue;
    gaps.push(sub);
  }

  if (!gaps.length) {
    return "No supervising MD is linked to your account yet. Contact NOVI support if you believe this is an error.";
  }

  const serviceLabels = [...new Set(
    gaps.map((gap) => String(gap.service_type_name || gap.service_type_id || "").trim()).filter(Boolean)
  )];
  const leadIn = serviceLabels.length
    ? `Your MD coverage is active for ${serviceLabels.join(", ")}, but no supervising physician was assigned. `
    : "Your MD coverage is active, but no supervising physician was assigned. ";

  const reasons = [];
  for (const gap of gaps) {
    reasons.push(
      await explainMdAssignmentBlocker(
        gap.service_type_id,
        gap.service_type_name,
        pState,
        { brief: true }
      )
    );
  }

  return leadIn + [...new Set(reasons)].join(" ");
}
