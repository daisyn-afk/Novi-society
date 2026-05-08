import { Router } from "express";
import {
  listEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  incrementTemplateSentCount,
} from "./repository.js";

const resendApiKey = process.env.RESEND_API_KEY || "";
const resendFromEmail =
  process.env.RESEND_FROM_EMAIL || "NOVI Society <support@novisociety.com>";

async function sendResendEmail({ to, subject, html }) {
  if (!resendApiKey) {
    const err = new Error("RESEND_API_KEY is not configured.");
    err.statusCode = 500;
    throw err;
  }
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: resendFromEmail, to: [to], subject, html }),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    const err = new Error(payload?.message || "Email send failed.");
    err.statusCode = 500;
    throw err;
  }
  return payload;
}

function validateTemplateInput(payload) {
  if (!String(payload?.name || "").trim()) {
    const err = new Error("Template name is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!String(payload?.trigger || "").trim()) {
    const err = new Error("Trigger is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!String(payload?.subject || "").trim()) {
    const err = new Error("Subject is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!String(payload?.body_html || "").trim()) {
    const err = new Error("Body is required.");
    err.statusCode = 400;
    throw err;
  }
}

export const emailTemplatesRouter = Router();

emailTemplatesRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await listEmailTemplates());
  } catch (error) {
    next(error);
  }
});

emailTemplatesRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await getEmailTemplate(req.params.id);
    if (!row) return res.status(404).json({ error: "Template not found." });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
});

emailTemplatesRouter.post("/", async (req, res, next) => {
  try {
    validateTemplateInput(req.body || {});
    const created = await createEmailTemplate(req.body || {});
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

emailTemplatesRouter.put("/:id", async (req, res, next) => {
  try {
    validateTemplateInput(req.body || {});
    const updated = await updateEmailTemplate(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: "Template not found." });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

emailTemplatesRouter.patch("/:id", async (req, res, next) => {
  try {
    const existing = await getEmailTemplate(req.params.id);
    if (!existing) return res.status(404).json({ error: "Template not found." });
    const merged = { ...existing, ...req.body };
    const updated = await updateEmailTemplate(req.params.id, merged);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

emailTemplatesRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await deleteEmailTemplate(req.params.id);
    if (!ok) return res.status(404).json({ error: "Template not found." });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// Test-send: POST /admin/email-templates/:id/test-send  { to: "admin@example.com" }
emailTemplatesRouter.post("/:id/test-send", async (req, res, next) => {
  try {
    const to = String(req.body?.to || "").trim().toLowerCase();
    if (!to) {
      return res.status(400).json({ error: "Recipient email (to) is required." });
    }

    const template = await getEmailTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found." });

    // Wrap body_html in the standard NOVI email shell
    const appBaseUrl = process.env.APP_BASE_URL || "https://app.novisociety.com";
    const body = String(template.body_html || "")
      .replace(/\{\{first_name\}\}/g, "Test User")
      .replace(/\{\{full_name\}\}/g, "Test User")
      .replace(/\{\{email\}\}/g, to)
      .replace(/\{\{app_url\}\}/g, appBaseUrl)
      .replace(/\{\{course_name\}\}/g, "Sample Course")
      .replace(/\{\{service_name\}\}/g, "Sample Service")
      .replace(/\{\{provider_name\}\}/g, "Test Provider")
      .replace(/\{\{patient_name\}\}/g, "Test Patient");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#f5f3ef;margin:0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e2535 0%,#2D6B7F 60%,#7B8EC8 100%);padding:40px 32px;text-align:center;">
      <p style="font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin:0 0 8px;">novi society</p>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#fff;margin:0;font-style:italic;font-weight:400;">${template.name}</h1>
    </div>
    <div style="padding:32px;">${body}</div>
    <div style="background:#f5f3ef;padding:16px 32px;text-align:center;">
      <p style="color:rgba(30,37,53,0.4);font-size:11px;margin:0;">⚠ TEST EMAIL — not sent to real recipients</p>
      <p style="color:rgba(30,37,53,0.3);font-size:10px;margin:4px 0 0;">Trigger: ${template.trigger} · Template: ${template.name}</p>
    </div>
  </div>
</body>
</html>`;

    const subject = `[TEST] ${template.subject}`;
    await sendResendEmail({ to, subject, html });

    return res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (error) {
    return next(error);
  }
});
