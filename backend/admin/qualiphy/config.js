/**
 * Public URL Qualiphy should POST to when a patient completes an exam.
 * Prefer QUALIPHY_WEBHOOK_URL; otherwise derive from APP_BASE_URL (production).
 */
export function resolveQualiphyWebhookUrl() {
  const explicit = String(process.env.QUALIPHY_WEBHOOK_URL || "").trim();
  if (explicit) return explicit;

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
    return `${origin.replace(/\/$/, "")}/api/webhooks/qualiphy`;
  } catch {
    return "";
  }
}
