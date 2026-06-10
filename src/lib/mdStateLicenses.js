export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

function newRowId() {
  return globalThis.crypto?.randomUUID?.() || `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeUsStateCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

export function createEmptyStateLicenseRow() {
  return {
    id: newRowId(),
    us_state: "",
    license_number: "",
    expiration_date: "",
  };
}

export function rowsFromImportedEntries(entries) {
  return (entries || []).map((entry) => ({
    id: newRowId(),
    us_state: normalizeUsStateCode(entry?.us_state) || String(entry?.us_state || "").trim().toUpperCase(),
    license_number: entry?.license_number ?? "",
    expiration_date: entry?.expiration_date ?? "",
  }));
}

export function stateLicensesFromProfile(profile) {
  const rows = (profile?.state_licenses || []).map((row) => ({
    id: newRowId(),
    us_state: normalizeUsStateCode(row?.us_state) || String(row?.us_state || "").trim().toUpperCase(),
    license_number: row?.license_number ?? "",
    expiration_date: row?.expiration_date ?? "",
  }));
  return rows.length ? rows : [createEmptyStateLicenseRow()];
}

export function stateLicensesToPayload(rows) {
  return rows
    .map((row, index) => ({
      us_state: normalizeUsStateCode(row.us_state),
      license_number: String(row.license_number ?? "").trim(),
      expiration_date: String(row.expiration_date ?? "").trim() || null,
      sort_order: index,
    }))
    .filter((row) => row.us_state);
}

export function licensedStatesFromRows(rows) {
  return [...new Set(
    rows
      .filter((row) => {
        const license = String(row.license_number ?? "").trim();
        return normalizeUsStateCode(row.us_state) && license && license !== "-";
      })
      .map((row) => normalizeUsStateCode(row.us_state))
  )];
}

export function selectableStates(rows, rowId, currentState) {
  const current = normalizeUsStateCode(currentState);
  const used = new Set(
    rows
      .filter((row) => row.id !== rowId)
      .map((row) => normalizeUsStateCode(row.us_state))
      .filter(Boolean)
  );

  const pool = new Set(US_STATES);
  for (const row of rows) {
    const code = normalizeUsStateCode(row.us_state);
    if (code) pool.add(code);
  }

  return [...pool]
    .filter((code) => !used.has(code) || code === current)
    .sort((a, b) => {
      const aIdx = US_STATES.indexOf(a);
      const bIdx = US_STATES.indexOf(b);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return a.localeCompare(b);
    });
}

export function firstAvailableState(rows) {
  const used = new Set(rows.map((row) => normalizeUsStateCode(row.us_state)).filter(Boolean));
  return US_STATES.find((code) => !used.has(code)) || "";
}
