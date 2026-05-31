const appBaseUrl = String(process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
const noviEmailLogoUrl = process.env.NOVI_EMAIL_LOGO_URL || `${appBaseUrl}/novi-email-logo.png`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { escapeHtml as escapeEmailHtml };

export function getEmailAppBaseUrl() {
  return appBaseUrl;
}

/**
 * NOVI course-confirmation email shell (gradient header + white body card).
 */
export function buildCourseStyleEmailHtml({ greetingName, bodyHtml, includeSignoff = true }) {
  const safeName = escapeHtml(greetingName || "there");
  const logoMarkup = noviEmailLogoUrl
    ? `<img src="${escapeHtml(noviEmailLogoUrl)}" alt="NOVI Society" style="width:160px;height:auto" />`
    : `<div style="font-size:28px;font-weight:700;letter-spacing:0.04em;color:#ffffff">NOVI SOCIETY</div>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          ${logoMarkup}
        </td></tr>
        <tr><td style="background:#fff;padding:48px 40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Hi ${safeName},</p>
          ${bodyHtml}
          ${includeSignoff ? `
          <div style="border-top:1px solid #e5e7eb;padding-top:28px;margin-top:8px">
            <p style="margin:0 0 4px;font-size:15px;color:#374151">We look forward to seeing you soon.</p>
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;color:#1e2535;font-style:italic">Welcome to NOVI.</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;font-style:italic">A New Way to Be Seen.</p>
            <p style="margin:0;font-size:15px;color:#374151">Best,<br><strong>The NOVI Society Team</strong></p>
          </div>` : ""}
        </td></tr>
        <tr><td style="padding:24px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} NOVI Society LLC · 8109 Meadow Valley Dr, McKinney, TX 75071</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af"><a href="mailto:support@novisociety.com" style="color:#9ca3af">support@novisociety.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Returns the email subject for an account password-setup email.
 * Providers keep their role-specific subject; all other roles get a clean,
 * role-labelled variant so recipients are never confused by "provider" copy.
 *
 * @param {string} [role] - The user's role (e.g. "provider", "staff", "admin", "medical_director", "patient")
 * @returns {string}
 */
export function getPasswordSetupSubject(role) {
  const normalized = String(role || "").trim().toLowerCase();
  const ROLE_LABELS = {
    provider: "provider password",
    staff: "staff account password",
    admin: "admin account password",
    medical_director: "medical director account password",
  };
  const label = ROLE_LABELS[normalized] ?? "account password";
  return `Set your NOVI Society ${label}`;
}

/**
 * Legacy constant kept for flows that intentionally target providers
 * (migrated-users path, checkout path). New callers should use
 * getPasswordSetupSubject(role) instead.
 */
export const PASSWORD_RESET_EMAIL_SUBJECT = getPasswordSetupSubject("provider");

/**
 * Builds the password-setup email HTML.
 *
 * @param {object} params
 * @param {string} params.greetingName
 * @param {string} params.resetLink
 * @param {string} [params.role] - When omitted or unknown, falls back to generic account copy.
 */
export function buildPasswordResetEmailHtml({ greetingName, resetLink, role }) {
  const safeLink = escapeHtml(resetLink);
  const isProvider = String(role || "").trim().toLowerCase() === "provider";
  const introText = isProvider
    ? "Your NOVI Society provider account is ready. Use the secure link below to create your password and access your provider dashboard."
    : "Your NOVI Society account is ready. Use the secure link below to create your password and sign in.";
  const bodyHtml = `
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">${introText}</p>
          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:32px;border:1px solid rgba(0,0,0,0.07)">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2D6B7F">Password reset</p>
            <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6">This link can be used only once. After you set your password, sign in at the NOVI login page with your email and the password you chose.</p>
            <p style="margin:0">
              <a href="${safeLink}" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">
                Reset your password
              </a>
            </p>
          </div>`;
  return buildCourseStyleEmailHtml({ greetingName, bodyHtml, includeSignoff: false });
}

export async function sendResendHtmlEmail({ to, subject, html }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL || "NOVI Society <support@novisociety.com>";
  const fallbackFrom = String(process.env.RESEND_FALLBACK_FROM_EMAIL || "").trim();

  if (!to) return { ok: false, error: "missing_recipient" };
  if (!resendApiKey) return { ok: false, error: "missing_resend_key" };

  const sendWithFrom = async (fromAddress) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: fromAddress, to: [to], subject, html })
  });

  let res = await sendWithFrom(resendFromEmail);
  if (!res.ok && fallbackFrom && fallbackFrom !== resendFromEmail) {
    res = await sendWithFrom(fallbackFrom);
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    return { ok: false, error: bodyText || `resend_${res.status}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Block helpers — reusable structured HTML chunks used by templateRegistry.
// Each helper accepts plain JS values (already trusted/escaped where needed)
// and returns a self-contained HTML string compatible with the course-style
// shell. Empty/missing inputs return an empty string so block placeholders
// degrade gracefully when data is unavailable.
// ---------------------------------------------------------------------------

const CTA_PALETTES = {
  primary: { background: "#2D6B7F", color: "#ffffff" },
  accent: { background: "#C8E63C", color: "#1a2540" },
  warm: { background: "#FA6F30", color: "#ffffff" },
  dark: { background: "#1e2535", color: "#C8E63C" },
};

export function buildCtaButtonBlock({ label, url, palette = "primary" } = {}) {
  const safeLabel = String(label || "").trim();
  const safeUrl = String(url || "").trim();
  if (!safeLabel || !safeUrl) return "";
  const colors = CTA_PALETTES[palette] || CTA_PALETTES.primary;
  return `
          <div style="text-align:center;margin:0 0 32px;">
            <a href="${escapeHtml(safeUrl)}" style="display:inline-block;background:${colors.background};color:${colors.color};font-weight:700;font-size:15px;padding:14px 32px;border-radius:50px;text-decoration:none;">${escapeHtml(safeLabel)}</a>
          </div>`;
}

export function buildDetailListBlock({ title = "", rows = [] } = {}) {
  const cleanedRows = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const label = String(row.label ?? "").trim();
      const value = row.value == null ? "" : String(row.value).trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter(Boolean);
  if (!cleanedRows.length) return "";
  const titleHtml = title
    ? `<p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2D6B7F">${escapeHtml(title)}</p>`
    : "";
  const rowsHtml = cleanedRows
    .map(
      ({ label, value }) => `
              <tr>
                <td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px"><strong>${escapeHtml(label)}</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#111827">${escapeHtml(value)}</td>
              </tr>`
    )
    .join("");
  return `
          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid rgba(0,0,0,0.07)">
            ${titleHtml}
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              ${rowsHtml}
            </table>
          </div>`;
}

export function buildSummaryListBlock(lines = []) {
  const cleaned = (Array.isArray(lines) ? lines : [])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean);
  if (!cleaned.length) return "";
  const items = cleaned.map((line) => `<li style="margin:0 0 8px">${escapeHtml(line)}</li>`).join("");
  return `
          <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:14px;line-height:1.7">${items}</ul>`;
}

export function buildOrderTableBlock(orderItems = []) {
  const items = (Array.isArray(orderItems) ? orderItems : [])
    .map((row) => ({
      product: String(row?.product || row?.name || "").trim() || "Item",
      sku: String(row?.sku || "").trim(),
      quantity: row?.quantity == null ? "" : String(row.quantity).trim(),
      unit_price: row?.unit_price == null ? "" : String(row.unit_price).trim(),
    }))
    .filter((row) => row.product || row.sku || row.quantity || row.unit_price);
  if (!items.length) return "";
  const rows = items
    .map(
      (row) => `
              <tr>
                <td style="padding:10px 12px;font-size:13px;color:#1e2535;border-top:1px solid #e5e7eb">${escapeHtml(row.product)}${row.sku ? `<br/><span style="color:#6b7280;font-size:11px">SKU ${escapeHtml(row.sku)}</span>` : ""}</td>
                <td style="padding:10px 12px;font-size:13px;color:#1e2535;border-top:1px solid #e5e7eb;text-align:center">${escapeHtml(row.quantity || "—")}</td>
                <td style="padding:10px 12px;font-size:13px;color:#1e2535;border-top:1px solid #e5e7eb;text-align:right">${escapeHtml(row.unit_price || "—")}</td>
              </tr>`
    )
    .join("");
  return `
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;border:1px solid #e5e7eb;border-collapse:separate;border-spacing:0;border-radius:10px;overflow:hidden">
            <thead>
              <tr style="background:#f9fafb">
                <th align="left" style="padding:10px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280">Item</th>
                <th align="center" style="padding:10px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280">Qty</th>
                <th align="right" style="padding:10px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280">Unit price</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
}

export function buildHighlightBlock({ title, body, tone = "info" } = {}) {
  const safeBody = String(body || "").trim();
  if (!safeBody) return "";
  const tones = {
    info: { background: "rgba(45,107,127,0.06)", border: "rgba(45,107,127,0.15)", title: "#2D6B7F", text: "#1e2535" },
    success: { background: "rgba(200,230,60,0.12)", border: "rgba(200,230,60,0.3)", title: "#4a6b10", text: "#1e2535" },
    warning: { background: "rgba(250,111,48,0.08)", border: "rgba(250,111,48,0.25)", title: "#a13a05", text: "#1e2535" },
    danger: { background: "#fef2f2", border: "#fecaca", title: "#b91c1c", text: "#7f1d1d" },
    neutral: { background: "#f9f8f6", border: "rgba(0,0,0,0.07)", title: "#374151", text: "#1e2535" },
  };
  const palette = tones[tone] || tones.info;
  const titleHtml = title
    ? `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${palette.title}">${escapeHtml(title)}</p>`
    : "";
  return `
          <div style="background:${palette.background};border:1px solid ${palette.border};border-radius:12px;padding:16px;margin:0 0 24px;">
            ${titleHtml}
            <p style="margin:0;font-size:14px;color:${palette.text};line-height:1.6">${escapeHtml(safeBody)}</p>
          </div>`;
}

export function buildMessageQuoteBlock(message = "") {
  const trimmed = String(message || "").trim();
  if (!trimmed) return "";
  return `
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;border:1px solid #E5E7EB;border-collapse:separate;border-spacing:0;background-color:#F9FAFB;border-radius:10px">
            <tr>
              <td style="padding:12px 14px;">
                <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280">Message</p>
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap">${escapeHtml(trimmed)}</p>
              </td>
            </tr>
          </table>`;
}

