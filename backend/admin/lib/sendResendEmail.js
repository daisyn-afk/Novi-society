const DEFAULT_FROM_EMAIL = "NOVI Society <support@novisociety.com>";

function resolveResendApiKey() {
  return String(process.env.RESEND_API_KEY || "").trim();
}

function resolveFromEmail(explicitFrom) {
  if (String(explicitFrom || "").trim()) return String(explicitFrom).trim();
  return String(process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim();
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
      html: String(html || "")
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
