import { adminApiRequest } from "./adminApiRequest.js";

export const appointmentsApi = {
  /** Scoped to logged-in user (patient or provider). */
  listMine: ({ status, limit = 200 } = {}) => {
    const params = new URLSearchParams();
    if (status) params.set("status", String(status));
    params.set("limit", String(limit));
    const qs = params.toString();
    return adminApiRequest(`/admin/appointments${qs ? `?${qs}` : ""}`, { method: "GET" });
  },

  create: (payload) =>
    adminApiRequest("/admin/appointments", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),

  update: (id, payload) =>
    adminApiRequest(`/admin/appointments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    }),

  /** Provider: confirm request and ask patient to pay deposit. */
  requestDeposit: (id) =>
    adminApiRequest(`/admin/appointments/${encodeURIComponent(id)}/request-deposit`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  /** Patient: confirm deposit after returning from Stripe Checkout. */
  syncDepositPayment: (id, stripeSessionId) =>
    adminApiRequest(`/admin/appointments/${encodeURIComponent(id)}/sync-deposit-payment`, {
      method: "POST",
      body: JSON.stringify({ stripe_session_id: stripeSessionId || undefined }),
    }),

  /** Patient: start Stripe Checkout for appointment deposit. */
  createDepositCheckout: (id) => {
    const clientTimestamp = new Date().toISOString();
    return adminApiRequest(`/admin/appointments/${encodeURIComponent(id)}/deposit-checkout`, {
      method: "POST",
      body: JSON.stringify({ client_timestamp: clientTimestamp }),
      headers: { "x-novi-client-timestamp": clientTimestamp },
      timeoutMs: Number(import.meta.env.VITE_APPOINTMENT_CHECKOUT_TIMEOUT_MS || 45000),
    });
  },
};
