import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

export function emptyStateLicenseMap() {
  return Object.fromEntries(US_STATES.map((code) => [code, { license_number: "", expiration_date: "" }]));
}

export function stateLicensesFromProfile(profile) {
  const map = emptyStateLicenseMap();
  for (const row of profile?.state_licenses || []) {
    const code = String(row?.us_state || "").trim().toUpperCase();
    if (!map[code]) continue;
    map[code] = {
      license_number: row.license_number || "",
      expiration_date: row.expiration_date || "",
    };
  }
  return map;
}

export function stateLicensesToPayload(map) {
  return US_STATES.map((us_state) => ({
    us_state,
    license_number: String(map[us_state]?.license_number || "").trim(),
    expiration_date: String(map[us_state]?.expiration_date || "").trim() || null,
  })).filter((row) => row.license_number);
}

export function licensedStatesFromMap(map) {
  return US_STATES.filter((code) => String(map[code]?.license_number || "").trim());
}

export default function MDStateLicensesSection({
  stateLicenseMap,
  onChange,
  nationwide,
  onNationwideChange,
  error,
}) {
  const filledCount = licensedStatesFromMap(stateLicenseMap).length;

  function updateState(code, field, value) {
    onChange({
      ...stateLicenseMap,
      [code]: {
        ...stateLicenseMap[code],
        [field]: value,
      },
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500" style={{ lineHeight: 1.6 }}>
        Enter your state license number and expiration for each state where you hold a license.
        Leave a row blank if you are not licensed in that state.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[3.5rem_1fr_9.5rem] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
          <span>State</span>
          <span>State license</span>
          <span>Exp date</span>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {US_STATES.map((code) => {
            const row = stateLicenseMap[code] || { license_number: "", expiration_date: "" };
            const hasValue = Boolean(row.license_number?.trim() || row.expiration_date);
            return (
              <div
                key={code}
                className="grid grid-cols-[3.5rem_1fr_9.5rem] gap-2 px-3 py-1.5 items-center"
                style={{ background: hasValue ? "rgba(45,107,127,0.04)" : "transparent" }}
              >
                <span className="text-xs font-semibold text-slate-700">{code}</span>
                <Input
                  value={row.license_number}
                  onChange={(e) => updateState(code, "license_number", e.target.value)}
                  placeholder="—"
                  className="h-8 text-xs bg-white border-slate-200 text-slate-900"
                />
                <Input
                  type="date"
                  value={row.expiration_date || ""}
                  onChange={(e) => updateState(code, "expiration_date", e.target.value)}
                  className="h-8 text-xs bg-white border-slate-200 text-slate-900"
                />
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {filledCount} state{filledCount === 1 ? "" : "s"} with license details entered.
      </p>

      <div className="pt-2 border-t border-slate-100 space-y-2">
        <p className="text-xs font-semibold text-slate-700">Supervision coverage</p>
        <p className="text-xs text-slate-500" style={{ lineHeight: 1.6 }}>
          When state matching is enabled, NOVI uses this to limit which providers you can supervise.
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={nationwide}
            onCheckedChange={(checked) => onNationwideChange(Boolean(checked))}
          />
          <span className="text-sm text-slate-800 font-medium">Nationwide (all states)</span>
        </label>
        {!nationwide && (
          <p className="text-xs text-slate-500">
            Limited to {filledCount || "no"} state{filledCount === 1 ? "" : "s"} with a license number above.
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
