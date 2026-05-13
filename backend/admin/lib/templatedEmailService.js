import {
  getActiveEmailTemplateByTrigger,
  incrementTemplateSentCount,
} from "../email-templates/repository.js";
import { sendResendEmail } from "./sendResendEmail.js";

const CACHE_TTL_MS = Math.max(0, Number(process.env.EMAIL_TEMPLATE_CACHE_TTL_MS || 60000));
const templateCache = new Map();
const GLOBAL_FALLBACK_ENABLED = String(process.env.EMAIL_TEMPLATE_ALLOW_FALLBACK || "").trim().toLowerCase() === "true";
const runtimeVercelUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_URL ||
  "";

function resolveAppBaseUrl() {
  const configured = String(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const fallback = configured || (runtimeVercelUrl ? `https://${runtimeVercelUrl}` : "http://localhost:5173");
  return fallback.replace(/\/+$/, "");
}

export function renderTemplateString(source, placeholders = {}) {
  return String(source || "").replace(/\{\{(\w+)\}\}/g, (full, key) => (
    Object.prototype.hasOwnProperty.call(placeholders, key) ? String(placeholders[key] ?? "") : full
  ));
}

// Converts admin-entered plain text to styled HTML paragraphs.
// Double line breaks become separate <p> elements; single line breaks become <br>.
// Placeholders like {{name}} are injected BEFORE this call, so they render as real values.
export function plainTextToHtml(text) {
  return String(text || "")
    .split(/\n\n+/)
    .map(para => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

export function renderTemplateRow(template, placeholders = {}) {
  const subject = renderTemplateString(template?.subject || "", placeholders);
  const fullHtml = String(template?.body_html || "").trim();
  if (fullHtml) {
    // body_html is a complete HTML document — substitute placeholders and return as-is.
    return { subject, bodyHtml: renderTemplateString(fullHtml, placeholders), isFullHtml: true };
  }
  const bodyText = String(template?.body_text || "").trim();
  return { subject, bodyHtml: plainTextToHtml(renderTemplateString(bodyText, placeholders)), isFullHtml: false };
}

const LOGO_URL = process.env.NOVI_EMAIL_LOGO_URL || "";

function buildEmailHtml({ bodyHtml, testMode = false, testMeta = {} }) {
  const testBanner = testMode ? `
        <tr><td style="padding:16px 40px;text-align:center;background:#fff8ed;border-top:1px solid #fde68a;">
          <p style="margin:0;font-size:12px;color:#92400e;font-weight:600;">⚠ TEST EMAIL — not sent to real recipients</p>
          <p style="margin:4px 0 0;font-size:11px;color:#b45309;">Trigger: ${String(testMeta.trigger || "")} · Template: ${String(testMeta.templateName || "")}</p>
        </td></tr>` : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0;">
          <img src="${LOGO_URL}" alt="NOVI Society" style="width:160px;height:auto;display:block;margin:0 auto;" />
        </td></tr>
        <tr><td style="background:#fff;padding:40px;border-radius:0 0 16px 16px;">
          ${String(bodyHtml || "")}
        </td></tr>${testBanner}
        <tr><td style="padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 NOVI Society LLC · 8109 Meadow Valley Dr, McKinney, TX 75071</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;"><a href="mailto:support@novisociety.com" style="color:#9ca3af;">support@novisociety.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function wrapEmailBody({ templateName, bodyHtml, testMode = false, testMeta = {} }) {
  return buildEmailHtml({ bodyHtml, testMode, testMeta: { ...testMeta, templateName: testMeta.templateName || templateName } });
}

async function loadTemplateByTrigger(trigger, { bypassCache = false } = {}) {
  const key = String(trigger || "").trim();
  if (!key) return null;
  const now = Date.now();
  if (!bypassCache) {
    const cached = templateCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;
  }
  const row = await getActiveEmailTemplateByTrigger(key);
  templateCache.set(key, { value: row, expiresAt: now + CACHE_TTL_MS });
  return row;
}

export function invalidateTemplateCache(trigger) {
  const key = String(trigger || "").trim();
  if (!key) return;
  templateCache.delete(key);
}

export function invalidateAllTemplateCache() {
  templateCache.clear();
}

export async function sendTemplatedEmail({
  trigger,
  to,
  placeholders = {},
  from,
  fallbackSend,
  allowFallback,
  logLabel = "email",
  testMode = false,
  testSubjectPrefix = "",
  bypassTemplateCache = false,
  preferBodyText = false,
}) {
  let resolvedTemplateId = null;
  const fallbackEnabled = allowFallback ?? GLOBAL_FALLBACK_ENABLED;
  try {
    const resolvedAppUrl = resolveAppBaseUrl();
    const mergedPlaceholders = {
      app_url: resolvedAppUrl,
      signup_link: `${resolvedAppUrl}/setup`,
      gfe_url: `${resolvedAppUrl}/gfe`,
      ...placeholders,
    };
    const template = await loadTemplateByTrigger(trigger, { bypassCache: bypassTemplateCache });
    if (!template) throw new Error(`No active email template found for trigger "${trigger}".`);
    resolvedTemplateId = template.id;
    // For flows where admin edits are body_text-first, we can force rendering
    // from body_text to avoid any stale body_html drift.
    const templateForRender = preferBodyText
      ? { ...template, body_html: null }
      : template;
    const rendered = renderTemplateRow(templateForRender, mergedPlaceholders);
    // Full HTML templates (body_html) are already complete — use as-is.
    // Plain-text templates (body_text only) get wrapped in the branded layout.
    const html = rendered.isFullHtml
      ? rendered.bodyHtml
      : wrapEmailBody({
          templateName: template?.name,
          bodyHtml: rendered.bodyHtml,
          testMode,
          testMeta: { trigger, templateName: template?.name },
        });
    const subject = `${String(testSubjectPrefix || "")}${rendered.subject}`;
    await sendResendEmail({ to, subject, html, from });
    // eslint-disable-next-line no-console
    console.log(`[${logLabel}] templated email sent`, {
      trigger,
      to,
      template_id: template.id,
      subject_preview: String(subject || "").slice(0, 120),
      body_preview: String(rendered.bodyHtml || "").replace(/\s+/g, " ").slice(0, 180),
      used_body_text_path: Boolean(preferBodyText),
    });
    if (!testMode) await incrementTemplateSentCount(template.id);
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[${logLabel}] templated email send failed`, {
      trigger,
      to,
      template_id: resolvedTemplateId,
      error: error?.message || String(error),
      fallback_available: typeof fallbackSend === "function",
      fallback_enabled: fallbackEnabled,
    });
    if (fallbackEnabled && typeof fallbackSend === "function") {
      try {
        const fallbackOk = await fallbackSend(error);
        // eslint-disable-next-line no-console
        console.warn(`[${logLabel}] templated email fallback used`, {
          trigger,
          to,
          fallback_ok: Boolean(fallbackOk),
        });
        return Boolean(fallbackOk);
      } catch (fallbackError) {
        // eslint-disable-next-line no-console
        console.error(`[${logLabel}] fallback email send failed`, {
          trigger,
          to,
          error: fallbackError?.message || String(fallbackError),
        });
      }
    }
    if (!fallbackEnabled && typeof fallbackSend === "function") {
      // eslint-disable-next-line no-console
      console.warn(`[${logLabel}] fallback path skipped (EMAIL_TEMPLATE_ALLOW_FALLBACK is not true)`, {
        trigger,
        to,
        template_id: resolvedTemplateId,
      });
    }
    return false;
  }
}
