/** US state/territory → IANA timezone for provider class-code windows and display. */
const US_STATE_TIME_ZONE = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
  PR: "America/Puerto_Rico",
  VI: "America/Virgin",
  GU: "Pacific/Guam",
};

const COUNTRY_TIME_ZONE = {
  US: "America/New_York",
  USA: "America/New_York",
  CA: "America/Toronto",
  CANADA: "America/Toronto",
  GB: "Europe/London",
  UK: "Europe/London",
  AU: "Australia/Sydney",
  AUSTRALIA: "Australia/Sydney",
  IN: "Asia/Kolkata",
  INDIA: "Asia/Kolkata",
};

function normalizeState(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw.length === 2) return raw;
  const match = raw.match(/\b([A-Z]{2})\b/);
  return match ? match[1] : raw.slice(0, 2);
}

export function timeZoneLabel(timeZone) {
  const tz = String(timeZone || "").trim();
  if (!tz) return "local time";
  if (tz === "America/New_York") return "US Eastern";
  if (tz === "America/Chicago") return "US Central";
  if (tz === "America/Denver") return "US Mountain";
  if (tz === "America/Los_Angeles") return "US Pacific";
  return tz.replace(/_/g, " ");
}

/** Resolve provider IANA timezone from profile state/country, then browser, then US Eastern. */
export function resolveProviderTimeZone(user, browserTimeZone) {
  const state = normalizeState(user?.state);
  if (state && US_STATE_TIME_ZONE[state]) return US_STATE_TIME_ZONE[state];

  const country = String(user?.country || "").trim().toUpperCase();
  if (country && COUNTRY_TIME_ZONE[country]) return COUNTRY_TIME_ZONE[country];

  const browser = String(browserTimeZone || "").trim();
  if (browser) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: browser });
      return browser;
    } catch {
      // ignore invalid browser zone
    }
  }

  if (typeof Intl !== "undefined") {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    } catch {
      // ignore
    }
  }

  return "America/New_York";
}
