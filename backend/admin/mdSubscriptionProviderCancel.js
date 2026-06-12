import { processMdMembershipCancellation } from "./mdMembershipCancellationService.js";

/**
 * Provider-initiated cancel. Thin wrapper around the shared cancellation
 * cascade (Stripe billing stop, relationship teardown, appointment cancellation,
 * manufacturer revocation, notifications).
 *
 * @deprecated Prefer calling processMdMembershipCancellation directly so admin
 * and Stripe-webhook callers share the same code path.
 */
export async function requestProviderMdSubscriptionCancel({
  subscriptionId,
  providerId,
  reason = null,
  notes = null,
}) {
  return processMdMembershipCancellation({
    subscriptionId,
    providerId,
    reason,
    notes,
    cancelledBy: "provider",
    enforceOwnership: true,
  });
}
