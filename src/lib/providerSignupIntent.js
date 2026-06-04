/** Session keys until signup/login saves email + choice to provider_join_choices. */
export const PROVIDER_SIGNUP_GOAL_KEY = "novi_provider_signup_goal";
export const PROVIDER_SKIP_EXPLORE_KEY = "novi_provider_skip_explore";

export const GOAL_NEED_TRAINING = "need_training";
export const GOAL_NEED_MD_COVERAGE = "need_md_coverage";
export const CHOICE_EXPLORE_SKIP = "explore_skip";

export function readProviderSignupGoal() {
  try {
    const v = sessionStorage.getItem(PROVIDER_SIGNUP_GOAL_KEY);
    if (v === GOAL_NEED_TRAINING || v === GOAL_NEED_MD_COVERAGE) return v;
    return null;
  } catch {
    return null;
  }
}

export function writeProviderSignupGoal(goal) {
  try {
    if (goal === GOAL_NEED_TRAINING || goal === GOAL_NEED_MD_COVERAGE) {
      sessionStorage.setItem(PROVIDER_SIGNUP_GOAL_KEY, goal);
    }
  } catch {
    /* ignore */
  }
}

export function clearProviderSignupGoal() {
  try {
    sessionStorage.removeItem(PROVIDER_SIGNUP_GOAL_KEY);
  } catch {
    /* ignore */
  }
}

export function readSkipExploreFlag() {
  try {
    return sessionStorage.getItem(PROVIDER_SKIP_EXPLORE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSkipExploreFlag() {
  try {
    sessionStorage.setItem(PROVIDER_SKIP_EXPLORE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearSkipExploreFlag() {
  try {
    sessionStorage.removeItem(PROVIDER_SKIP_EXPLORE_KEY);
  } catch {
    /* ignore */
  }
}

/** Map session state to API choice value. */
export function sessionChoicePayload() {
  if (readSkipExploreFlag()) {
    return { choice: CHOICE_EXPLORE_SKIP, explore_skip: true };
  }
  const goal = readProviderSignupGoal();
  if (goal) return { goal, choice: goal };
  return null;
}

/**
 * After login/signup: save email + choice from session into provider_join_choices.
 */
export async function syncProviderJoinChoiceFromSession(email) {
  const payload = sessionChoicePayload();
  if (!payload) return null;
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) return null;

  const { saveProviderJoinChoiceApi } = await import("@/api/providerSignupIntentApi");
  try {
    const saved = await saveProviderJoinChoiceApi({
      email: normalizedEmail,
      ...payload,
    });
    clearProviderSignupGoal();
    clearSkipExploreFlag();
    return saved;
  } catch {
    return null;
  }
}

/** Remember choice in session; persist now if we already have an email. */
export async function persistProviderSignupIntentChoice({ goal, explore_skip, email }) {
  if (explore_skip) {
    writeSkipExploreFlag();
    clearProviderSignupGoal();
  } else if (goal === GOAL_NEED_TRAINING || goal === GOAL_NEED_MD_COVERAGE) {
    writeProviderSignupGoal(goal);
    clearSkipExploreFlag();
  }

  const resolvedEmail = String(email || "").trim();
  if (!resolvedEmail) return null;

  const { saveProviderJoinChoiceApi } = await import("@/api/providerSignupIntentApi");
  return saveProviderJoinChoiceApi({
    email: resolvedEmail,
    ...(explore_skip ? { choice: CHOICE_EXPLORE_SKIP, explore_skip: true } : { goal, choice: goal }),
  });
}

/** @deprecated use syncProviderJoinChoiceFromSession */
export const syncProviderSignupIntentFromSession = syncProviderJoinChoiceFromSession;
