/** Production app origin (no trailing slash). Empty on localhost or when unset. */
export function resolveAppOrigin() {
  let base = String(process.env.APP_BASE_URL || "").trim();
  if (!base && process.env.VERCEL_URL) {
    base = `https://${String(process.env.VERCEL_URL).trim()}`;
  }
  if (!base) return "";

  try {
    const origin = base.startsWith("http") ? base : `https://${base}`;
    const host = new URL(origin).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "";
    }
    return origin.replace(/\/$/, "");
  } catch {
    return "";
  }
}

/**
 * Qualiphy redirect URLs after the patient finishes the exam (exam_invite API).
 * @see https://api-docs.qualiphy.me/docs/api/exam-invite
 */
export function buildAppointmentGfeRedirectUrls(appointmentId) {
  const origin = resolveAppOrigin();
  const id = String(appointmentId || "").trim();
  if (!origin || !id) return {};

  const page = `${origin}/PatientAppointments`;
  const withQuery = (gfe) => {
    const params = new URLSearchParams({ gfe, appointment_id: id });
    return `${page}?${params.toString()}`;
  };

  return {
    redirect_approve: withQuery("approved"),
    redirect_reject: withQuery("deferred"),
    redirect_na: withQuery("na"),
    redirect_missed: withQuery("missed"),
  };
}

/**
 * Public URL Qualiphy should POST to when a patient completes an exam.
 * Prefer QUALIPHY_WEBHOOK_URL; otherwise derive from APP_BASE_URL (production).
 */
export function resolveQualiphyWebhookUrl() {
  const explicit = String(process.env.QUALIPHY_WEBHOOK_URL || "").trim();
  if (explicit) return explicit;

  const origin = resolveAppOrigin();
  if (!origin) return "";
  return `${origin}/api/webhooks/qualiphy`;
}
