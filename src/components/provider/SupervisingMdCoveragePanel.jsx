import { ShieldCheck } from "lucide-react";

const UNASSIGNED_ERROR_COLOR = "#DC2626";
const UNASSIGNED_ERROR_BG = "rgba(220,38,38,0.06)";
const UNASSIGNED_ERROR_BORDER = "rgba(220,38,38,0.2)";

function displayValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return "—";
  return raw;
}

function hasRealLicense(license) {
  const num = String(license?.license_number ?? "").trim();
  return num && num !== "-" && !/^n\/?a$/i.test(num);
}

function hasAssignedMd(coverage) {
  if (coverage?.has_active_relationship === false) return false;
  return Boolean(String(coverage?.medical_director_id ?? "").trim());
}

export function resolveUnassignedMessage(coverage, { hasActiveMdCoverage = false } = {}) {
  if (!coverage || hasAssignedMd(coverage)) return null;
  if (coverage.unassigned_reason) return coverage.unassigned_reason;
  if (hasActiveMdCoverage) {
    return "Your MD coverage is active, but no supervising physician was assigned during activation. Contact NOVI support to retry assignment.";
  }
  return "No supervising MD is assigned. Activate MD Board coverage for a service to be assigned a NOVI Board medical director.";
}

export default function SupervisingMdCoveragePanel({
  coverage,
  compact = false,
  hasActiveMdCoverage = false,
}) {
  if (!coverage) return null;

  const assigned = hasAssignedMd(coverage);
  const unassignedMessage = resolveUnassignedMessage(coverage, { hasActiveMdCoverage });
  const mdName = assigned
    ? coverage.medical_director_name || "Assigned"
    : "Not assigned";
  const mdEmail = coverage.medical_director_email || "";
  const providerStates = coverage.provider_states || [];
  const licenses = coverage.relevant_state_licenses || [];
  const isNationwide = assigned && coverage.supervision_nationwide === true;

  if (compact) {
    return (
      <p
        className="text-[10px] mt-0.5 truncate"
        style={{ color: assigned ? "rgba(30,37,53,0.4)" : UNASSIGNED_ERROR_COLOR }}
      >
        {assigned ? mdName : "Not yet assigned"}
      </p>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(30,37,53,0.07)" }}
    >
      <div
        className="px-5 py-4 flex items-start gap-3"
        style={{ borderBottom: "1px solid rgba(30,37,53,0.08)" }}
      >
        <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#7B8EC8" }} />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>
            Supervising MD — your state coverage
          </p>
          <p className="text-sm font-semibold mt-1" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>
            {mdName}
          </p>
          {assigned && mdEmail && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{mdEmail}</p>
          )}
          {assigned && coverage.npi && (
            <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.55)" }}>
              NPI: <span className="font-semibold" style={{ color: "#1e2535" }}>{coverage.npi}</span>
            </p>
          )}
          {providerStates.length > 0 && (
            <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
              Your practice state{providerStates.length > 1 ? "s" : ""}: {providerStates.join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {!assigned ? (
          unassignedMessage ? (
            <p
              className="text-xs rounded-lg px-3 py-2.5 font-medium"
              style={{
                color: UNASSIGNED_ERROR_COLOR,
                background: UNASSIGNED_ERROR_BG,
                border: `1px solid ${UNASSIGNED_ERROR_BORDER}`,
                lineHeight: 1.55,
              }}
            >
              {unassignedMessage}
            </p>
          ) : null
        ) : licenses.length === 0 && providerStates.length === 0 ? (
          <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
            Add your practice state to your profile to see MD license coverage for your location.
          </p>
        ) : isNationwide ? (
          <p className="text-xs rounded-lg px-3 py-2.5" style={{ color: "#2D6B7F", background: "rgba(45,107,127,0.06)", border: "1px solid rgba(45,107,127,0.12)" }}>
            This supervising MD provides nationwide supervision and covers all states
            {providerStates.length > 0 ? `, including ${providerStates.join(", ")}` : ""}.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[4rem_1fr_7.5rem] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
              <span>State</span>
              <span>MD license</span>
              <span>Exp date</span>
            </div>
            {licenses.map((lic) => {
              const covered = hasRealLicense(lic);
              return (
                <div
                  key={lic.us_state}
                  className="grid grid-cols-[4rem_1fr_7.5rem] gap-2 px-3 py-2 text-xs border-b border-slate-100 last:border-b-0 items-center"
                  style={{ background: covered ? "rgba(45,107,127,0.04)" : "rgba(250,111,48,0.05)" }}
                >
                  <span className="font-semibold text-slate-800">{lic.us_state}</span>
                  <span className="text-slate-700">{displayValue(lic.license_number)}</span>
                  <span className="text-slate-700">{displayValue(lic.expiration_date)}</span>
                </div>
              );
            })}
          </div>
        )}
        {assigned && !isNationwide && coverage.has_coverage_in_provider_state === false && providerStates.length > 0 && (
          <p className="text-xs mt-3 font-medium" style={{ color: UNASSIGNED_ERROR_COLOR }}>
            Your supervising MD does not have a license on file for your practice state
            {providerStates.length > 1 ? "s" : ""} ({providerStates.join(", ")}).
          </p>
        )}
      </div>
    </div>
  );
}
