const DEFAULT_FROM_EMAIL = "NOVI Society <support@novisociety.com>";

function resolveResendApiKey() {
  return String(process.env.RESEND_API_KEY || "").trim();
}

function resolveFromEmail(explicitFrom) {
  if (String(explicitFrom || "").trim()) return String(explicitFrom).trim();
  return String(process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim();
}

// Gmail (and some other clients) collapse repeated content across messages as
// "trimmed content" behind a "…" expander when consecutive messages from the
// same sender share long identical HTML blocks. Embedding an invisible
// per-send token guarantees every email is content-unique, so the recipient
// always sees the full body without the trim indicator.
function buildUniquenessToken(recipient) {
  const nonce = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `${stamp}-${nonce}-${String(recipient || "").toLowerCase().slice(0, 64)}`;
}

function injectUniquenessToken(html, recipient) {
  const source = String(html || "");
  if (!source) return source;
  const token = buildUniquenessToken(recipient);
  const hidden = `<div aria-hidden="true" style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;opacity:0;">${token}</div>`;
  const bodyOpenMatch = source.match(/<body\b[^>]*>/i);
  if (bodyOpenMatch) {
    const idx = bodyOpenMatch.index + bodyOpenMatch[0].length;
    return `${source.slice(0, idx)}${hidden}${source.slice(idx)}`;
  }
  return `${hidden}${source}`;
}

export async function sendResendEmail({ to, subject, html, from }) {
  const resendApiKey = resolveResendApiKey();
  if (!resendApiKey) {
    const err = new Error("RESEND_API_KEY is not configured.");
    err.statusCode = 500;
    throw err;
  }
  const recipient = String(to || "").trim();
  if (!recipient) {
    const err = new Error("Recipient email is required.");
    err.statusCode = 400;
    throw err;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resolveFromEmail(from),
      to: [recipient],
      subject: String(subject || ""),
      html: injectUniquenessToken(html, recipient)
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload?.message || "Email send failed.");
    err.statusCode = 500;
    err.responseStatus = response.status;
    throw err;
  }
  return payload;
}
