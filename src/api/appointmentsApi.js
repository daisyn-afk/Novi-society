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

  /** Provider: confirm request; booking deposit comes from Practice Profile only. */
  requestDeposit: (id) =>
    adminApiRequest(`/admin/appointments/${encodeURIComponent(id)}/request-deposit`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  /** Provider: preview invoice from treatment menu + logged units/areas. */
  previewTreatmentInvoice: (id, payload) =>
    adminApiRequest(`/admin/appointments/${encodeURIComponent(id)}/treatment-invoice-preview`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),

  /** Provider: send treatment balance invoice to patient. */
  requestTreatmentPayment: (id, payload) =>
    adminApiRequest(`/admin/appointments/${encodeURIComponent(id)}/request-treatment-payment`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),

  /** Patient: start Stripe Checkout for treatment balance. */
  createTreatmentCheckout: (id) => {
    const clientTimestamp = new Date().toISOString();
    return adminApiRequest(`/admin/appointments/${encodeURIComponent(id)}/treatment-checkout`, {
      method: "POST",
      body: JSON.stringify({ client_timestamp: clientTimestamp }),
      headers: { "x-novi-client-timestamp": clientTimestamp },
      timeoutMs: Number(import.meta.env.VITE_APPOINTMENT_CHECKOUT_TIMEOUT_MS || 45000),
    });
  },

  /** Patient: sync treatment payment after Stripe redirect. */
  syncTreatmentPayment: (id, stripeSessionId) =>
    adminApiRequest(`/admin/appointments/${encodeURIComponent(id)}/sync-treatment-payment`, {
      method: "POST",
      body: JSON.stringify({ stripe_session_id: stripeSessionId || undefined }),
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
