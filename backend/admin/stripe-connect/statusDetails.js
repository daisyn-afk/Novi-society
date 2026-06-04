/** @typedef {'not_started'|'incomplete'|'action_required'|'pending_review'|'ready'} StripeOnboardingState */

const REQUIREMENT_LABELS = {
  "external_account": "Bank account for payouts",
  "individual.address.city": "Home address (city)",
  "individual.address.line1": "Home address",
  "individual.address.postal_code": "Home address (postal code)",
  "individual.address.state": "Home address (state)",
  "individual.dob.day": "Date of birth",
  "individual.dob.month": "Date of birth",
  "individual.dob.year": "Date of birth",
  "individual.email": "Email address",
  "individual.first_name": "Legal first name",
  "individual.last_name": "Legal last name",
  "individual.phone": "Phone number",
  "individual.ssn_last_4": "Last 4 digits of SSN (US)",
  "individual.id_number": "Tax ID / SSN",
  "individual.verification.document": "Identity verification document",
  "individual.verification.additional_document": "Additional identity document",
  "business_profile.mcc": "Business category",
  "business_profile.url": "Business website",
  "business_profile.name": "Business name",
  "company.tax_id": "Company tax ID",
  "representative.first_name": "Representative first name",
  "representative.last_name": "Representative last name",
  "tos_acceptance.date": "Terms of service acceptance",
  "tos_acceptance.ip": "Terms of service acceptance",
};

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const v = String(raw || "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function humanizeRequirementKey(key) {
  const k = String(key || "").trim();
  if (!k) return "Additional information";
  if (REQUIREMENT_LABELS[k]) return REQUIREMENT_LABELS[k];

  const parts = k.split(".");
  const last = parts[parts.length - 1] || k;
  const words = last.replace(/_/g, " ");
  const titled = words.charAt(0).toUpperCase() + words.slice(1);
  if (k.startsWith("individual.")) return `Personal info: ${titled}`;
  if (k.startsWith("business_profile.")) return `Business profile: ${titled}`;
  return titled;
}

export function collectRequirementsDue(account) {
  const req = account?.requirements || {};
  return uniqueStrings([
    ...(Array.isArray(req.currently_due) ? req.currently_due : []),
    ...(Array.isArray(req.past_due) ? req.past_due : []),
  ]);
}

/**
 * @param {object} params
 * @param {string|null} params.accountId
 * @param {boolean} params.chargesEnabled
 * @param {boolean} params.detailsSubmitted
 * @param {string[]} params.requirementsDue
 * @param {string|null} params.disabledReason
 */
export function deriveOnboardingState({
  accountId,
  chargesEnabled,
  detailsSubmitted,
  requirementsDue,
  disabledReason,
}) {
  const acct = String(accountId || "").trim();
  if (!acct) return "not_started";
  if (chargesEnabled) return "ready";

  const due = Array.isArray(requirementsDue) ? requirementsDue : [];
  if (due.length > 0 || disabledReason) return "action_required";
  if (detailsSubmitted) return "pending_review";
  return "incomplete";
}

export function buildOnboardingMessaging(onboardingState, { hasDeposit = false, requirementsDueLabels = [] } = {}) {
  const dueList = Array.isArray(requirementsDueLabels) ? requirementsDueLabels.filter(Boolean) : [];

  switch (onboardingState) {
    case "ready":
      return {
        title: "Stripe connected",
        message:
          "Patient deposits and treatment payments are paid out to your connected Stripe account.",
        action_label: null,
      };
    case "not_started":
      return {
        title: "Connect Stripe to accept online payments",
        message: hasDeposit
          ? "Patients cannot pay booking deposits until you complete Stripe setup."
          : "Complete Stripe setup before patients can pay treatment balances online.",
        action_label: "Connect Stripe",
      };
    case "incomplete":
      return {
        title: "Finish Stripe setup",
        message: hasDeposit
          ? "Your Stripe account is started but not finished. Continue setup so patients can pay deposits."
          : "Your Stripe account is started but not finished. Continue setup to accept online payments.",
        action_label: "Continue Stripe setup",
      };
    case "action_required":
      return {
        title: "Action required on Stripe",
        message:
          dueList.length > 0
            ? "Stripe needs the following before you can accept payments:"
            : "Stripe needs more information before you can accept payments. Continue setup in Stripe.",
        action_label: "Continue Stripe setup",
      };
    case "pending_review":
      return {
        title: "Stripe setup submitted",
        message:
          "You've submitted your details. Stripe is reviewing your account — this can take a short time. If nothing changes, use Continue setup to check for missing items.",
        action_label: "Continue Stripe setup",
      };
    default:
      return {
        title: "Connect Stripe to accept online payments",
        message: "Complete Stripe setup to accept patient payments online.",
        action_label: "Connect Stripe",
      };
  }
}

export function buildStatusDetailsFromStripeAccount(account, row, { configured = true } = {}) {
  const accountId = String(account?.id || row?.stripe_connect_account_id || "").trim();
  const chargesEnabled = Boolean(account?.charges_enabled ?? row?.stripe_connect_charges_enabled);
  const payoutsEnabled = Boolean(account?.payouts_enabled ?? row?.stripe_connect_payouts_enabled);
  const detailsSubmitted = Boolean(account?.details_submitted ?? row?.stripe_connect_details_submitted);
  const requirementsDue = account ? collectRequirementsDue(account) : [];
  const disabledReason = String(account?.requirements?.disabled_reason || "").trim() || null;
  const onboardingState = deriveOnboardingState({
    accountId,
    chargesEnabled,
    detailsSubmitted,
    requirementsDue,
    disabledReason,
  });
  const requirementsDueLabels = uniqueStrings(requirementsDue.map(humanizeRequirementKey));

  return {
    onboarding_state: onboardingState,
    requirements_due: requirementsDue,
    requirements_due_labels: requirementsDueLabels,
    disabled_reason: disabledReason,
  };
}
