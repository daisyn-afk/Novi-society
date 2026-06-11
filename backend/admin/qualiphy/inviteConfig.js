const PRODUCTION_EXAM_INVITE_URL = "https://api.qualiphy.me/api/exam_invite";
const SANDBOX_EXAM_INVITE_URL = "https://staging-api.qualiphy.me/api/exam_invite";

export function getQualiphyEnvironment() {
  const raw = String(process.env.QUALIPHY_ENV || "production").trim().toLowerCase();
  if (raw === "test" || raw === "sandbox" || raw === "production") return raw;
  return "production";
}

export function isQualiphyTestMode() {
  return getQualiphyEnvironment() === "test";
}

export function getQualiphyExamInviteApiUrl() {
  const explicit = String(process.env.QUALIPHY_API_URL || "").trim();
  if (explicit) return explicit;
  if (getQualiphyEnvironment() === "sandbox") return SANDBOX_EXAM_INVITE_URL;
  return PRODUCTION_EXAM_INVITE_URL;
}

export function getQualiphyApiKey() {
  const env = getQualiphyEnvironment();
  if (env === "sandbox") {
    return String(process.env.QUALIPHY_SANDBOX_API_KEY || process.env.QUALIPHY_API_KEY || "").trim();
  }
  return String(process.env.QUALIPHY_API_KEY || "").trim();
}

export function resolveQualiphyInviteStates({ stateAbbr } = {}) {
  if (isQualiphyTestMode()) {
    const testState = String(process.env.QUALIPHY_TEST_STATE || "TE").trim().toUpperCase();
    return { state: testState, tele_state: testState };
  }

  const abbr = String(stateAbbr || process.env.QUALIPHY_DEFAULT_STATE || "TX")
    .trim()
    .toUpperCase();
  return { state: abbr, tele_state: abbr };
}

/** Qualiphy test mode: fictional patient fields (no live provider workflow). */
export function applyQualiphyTestPatientOverrides(fields = {}) {
  if (!isQualiphyTestMode()) return { ...fields };

  return {
    ...fields,
    first_name: String(process.env.QUALIPHY_TEST_FIRST_NAME || "Test").trim() || "Test",
    last_name: String(process.env.QUALIPHY_TEST_LAST_NAME || "Approve").trim() || "Approve",
    email: String(process.env.QUALIPHY_TEST_EMAIL || "gfe-test@example.com").trim() || "gfe-test@example.com",
    phone_number: String(process.env.QUALIPHY_TEST_PHONE || "+15555550100").trim() || "+15555550100",
    dob: String(process.env.QUALIPHY_TEST_DOB || fields.dob || "1990-06-30").trim() || "1990-06-30",
  };
}

export function getQualiphyRuntimeSummary() {
  const { state, tele_state } = resolveQualiphyInviteStates({ stateAbbr: "TX" });
  return {
    qualiphy_env: getQualiphyEnvironment(),
    qualiphy_test_mode: isQualiphyTestMode(),
    qualiphy_api_url: getQualiphyExamInviteApiUrl(),
    qualiphy_invite_states: isQualiphyTestMode() ? { state, tele_state } : null,
  };
}
