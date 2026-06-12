import { pool } from "../db.js";
import { getProviderIdAliases } from "../mdSupervisedAccess.js";
import { resolveUnassignedMdReason } from "./mdAssignmentDiagnostics.js";

function asTrimmed(value) {
  return String(value ?? "").trim();
}

async function safeQuery(sql, params = []) {
  try {
    const { rows } = await pool.query(sql, params);
    return rows || [];
  } catch {
    return [];
  }
}

export function normalizeUsState(value) {
  const code = asTrimmed(value).toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

export function collectProviderStates({
  profileState,
  userState,
  licenses = [],
  practiceAddress = "",
} = {}) {
  const states = new Set();
  for (const raw of [profileState, userState]) {
    const code = normalizeUsState(raw);
    if (code) states.add(code);
  }
  for (const lic of licenses) {
    const code = normalizeUsState(lic.issuing_state || lic.license_state);
    if (code) states.add(code);
  }
  const addr = asTrimmed(practiceAddress);
  const stateFromAddr = addr.match(/(?:,\s*|\s+)([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
  if (stateFromAddr) states.add(stateFromAddr[1]);
  return [...states].sort();
}

export function isRealLicenseValue(value) {
  const raw = asTrimmed(value);
  return raw && raw !== "-" && !/^n\/?a$/i.test(raw);
}

export function filterMdLicensesForProviderStates(allLicenses, providerStates) {
  if (!Array.isArray(allLicenses)) return [];
  if (!providerStates?.length) return allLicenses;
  const set = new Set(providerStates.map(normalizeUsState).filter(Boolean));
  return allLicenses.filter((row) => set.has(normalizeUsState(row.us_state)));
}

export function formatMdLicenseEmailLine(license) {
  const state = normalizeUsState(license?.us_state) || asTrimmed(license?.us_state);
  const num = asTrimmed(license?.license_number);
  const exp = asTrimmed(license?.expiration_date);
  const numLabel = isRealLicenseValue(num) ? num : "—";
  const expLabel = isRealLicenseValue(exp) ? exp : "—";
  return `MD license (${state}): ${numLabel} / ${expLabel}`;
}

export async function fetchMdProfileAndStateLicenses(medicalDirectorId) {
  const mid = asTrimmed(medicalDirectorId);
  if (!mid) {
    return { npi: null, supervision_nationwide: false, state_licenses: [] };
  }

  const [profileRows, licenseRows] = await Promise.all([
    safeQuery(
      `select npi, coalesce(supervision_nationwide, false) as supervision_nationwide
       from public.medical_director_profiles
       where medical_director_id = $1
       limit 1`,
      [mid]
    ),
    safeQuery(
      `select us_state, license_number, expiration_date, sort_order
       from public.medical_director_state_license
       where medical_director_id = $1
       order by sort_order, us_state`,
      [mid]
    ),
  ]);

  const profile = profileRows[0] || {};
  return {
    npi: profile.npi ? asTrimmed(profile.npi) : null,
    supervision_nationwide: profile.supervision_nationwide === true,
    state_licenses: (licenseRows || []).map((row) => ({
      us_state: normalizeUsState(row.us_state) || asTrimmed(row.us_state).toUpperCase(),
      license_number: row.license_number != null ? asTrimmed(row.license_number) : "",
      expiration_date: row.expiration_date != null ? asTrimmed(row.expiration_date) : "",
    })),
  };
}

export function buildSupervisingMdCoverageContext({ mdProfile, providerStates, mdRelationship = null }) {
  const states = [...new Set((providerStates || []).map(normalizeUsState).filter(Boolean))].sort();
  const allLicenses = mdProfile?.state_licenses || [];
  const relevantByState = new Map(
    filterMdLicensesForProviderStates(allLicenses, states).map((row) => [
      normalizeUsState(row.us_state),
      row,
    ])
  );

  const relevant_state_licenses = states.map((st) => {
    const existing = relevantByState.get(st);
    if (existing) return existing;
    return { us_state: st, license_number: "", expiration_date: "" };
  });

  const hasAssignedMd = Boolean(asTrimmed(mdRelationship?.medical_director_id));
  const isNationwide = hasAssignedMd && mdProfile?.supervision_nationwide === true;

  const email_summary_lines = [];
  if (mdProfile?.npi) email_summary_lines.push(`MD NPI: ${mdProfile.npi}`);
  if (states.length) email_summary_lines.push(`Provider state(s): ${states.join(", ")}`);
  if (isNationwide) {
    email_summary_lines.push("MD supervision: Nationwide (all states)");
  } else {
    for (const lic of relevant_state_licenses) {
      if (isRealLicenseValue(lic.license_number) || isRealLicenseValue(lic.expiration_date)) {
        email_summary_lines.push(formatMdLicenseEmailLine(lic));
      } else {
        email_summary_lines.push(`MD license (${lic.us_state}): not on file`);
      }
    }
  }

  const hasCoverageInProviderState =
    isNationwide ||
    relevant_state_licenses.some((lic) => isRealLicenseValue(lic.license_number));

  return {
    medical_director_id: mdRelationship?.medical_director_id
      ? asTrimmed(mdRelationship.medical_director_id)
      : null,
    medical_director_name:
      asTrimmed(mdRelationship?.medical_director_name) || null,
    medical_director_email:
      asTrimmed(mdRelationship?.medical_director_email) || null,
    npi: mdProfile?.npi || null,
    supervision_nationwide: mdProfile?.supervision_nationwide === true,
    provider_states: states,
    relevant_state_licenses,
    all_state_licenses_count: allLicenses.length,
    has_coverage_in_provider_state: hasCoverageInProviderState,
    email_summary_lines,
  };
}

export async function resolveSupervisingMdCoverageForProvider({
  providerId,
  profileState,
  userState,
  licenses = [],
  practiceAddress = "",
  lookupIds = null,
}) {
  const { aliases } = lookupIds?.length
    ? { aliases: lookupIds }
    : await getProviderIdAliases(providerId);
  const ids = aliases?.length ? aliases : [String(providerId || "").trim()].filter(Boolean);

  const relRows = await safeQuery(
    `select medical_director_id, medical_director_name, medical_director_email, status
     from public.medical_director_relationship
     where provider_id::text = any($1::text[])
     order by case when lower(coalesce(status, '')) = 'active' then 0 else 1 end,
              created_at desc nulls last
     limit 1`,
    [ids]
  );
  const relationship = relRows[0] || null;
  const providerStates = collectProviderStates({
    profileState,
    userState,
    licenses,
    practiceAddress,
  });
  const hasActiveRelationship = Boolean(asTrimmed(relationship?.medical_director_id))
    && String(relationship?.status || "").toLowerCase() === "active";

  if (!hasActiveRelationship) {
    const unassigned_reason = await resolveUnassignedMdReason({
      lookupIds: ids,
      providerState: providerStates[0] || normalizeUsState(userState) || normalizeUsState(profileState) || null,
      hasActiveRelationship: false,
    });
    return {
      ...buildSupervisingMdCoverageContext({
        mdProfile: { npi: null, supervision_nationwide: false, state_licenses: [] },
        providerStates,
        mdRelationship: null,
      }),
      provider_states: providerStates,
      has_active_relationship: false,
      unassigned_reason,
    };
  }

  const mdProfile = await fetchMdProfileAndStateLicenses(relationship.medical_director_id);
  return {
    ...buildSupervisingMdCoverageContext({
      mdProfile,
      providerStates,
      mdRelationship: relationship,
    }),
    has_active_relationship: true,
    unassigned_reason: null,
  };
}
