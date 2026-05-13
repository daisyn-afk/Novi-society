/** Session keys for provider homepage → onboarding → basic profile flow */
export const PROVIDER_SIGNUP_GOAL_KEY = "novi_provider_signup_goal";
export const PROVIDER_SKIP_EXPLORE_KEY = "novi_provider_skip_explore";

export const GOAL_NEED_TRAINING = "need_training";
export const GOAL_NEED_MD_COVERAGE = "need_md_coverage";

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
