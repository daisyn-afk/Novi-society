/**
 * Redirect to Stripe Checkout in the same tab.
 * Use this instead of window.open() — iOS Safari blocks popups opened after await/async work.
 */
export function redirectToStripeCheckout(checkoutUrl) {
  const url = String(checkoutUrl || "").trim();
  if (!url) {
    throw new Error("Stripe checkout URL was not returned.");
  }
  window.location.assign(url);
}
