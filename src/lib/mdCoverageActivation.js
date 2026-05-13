export const MD_COVERAGE_SETUP_WIZARD_PENDING_KEY = "novi_md_coverage_pending_setup_wizard";

export function markMdCoverageSetupWizardPending() {
  try {
    sessionStorage.setItem(MD_COVERAGE_SETUP_WIZARD_PENDING_KEY, "1");
  } catch {
    // ignore storage failures
  }
}

export function clearMdCoverageSetupWizardPending() {
  try {
    sessionStorage.removeItem(MD_COVERAGE_SETUP_WIZARD_PENDING_KEY);
  } catch {
    // ignore storage failures
  }
}

export function hasMdCoverageSetupWizardPending() {
  try {
    return sessionStorage.getItem(MD_COVERAGE_SETUP_WIZARD_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}
