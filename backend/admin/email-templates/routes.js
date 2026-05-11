import { Router } from "express";
import {
  listEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "./repository.js";
import {
  invalidateTemplateCache,
  renderTemplateRow,
  wrapEmailBody,
} from "../lib/templatedEmailService.js";
import { sendResendEmail } from "../lib/sendResendEmail.js";

function validateTemplateInput(payload, { isUpdate = false } = {}) {
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
  if (!isUpdate && !String(payload?.body_text || "").trim()) {
    const err = new Error("Email body (body_text) is required.");
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
    invalidateTemplateCache(created?.trigger);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

emailTemplatesRouter.put("/:id", async (req, res, next) => {
  try {
    validateTemplateInput(req.body || {}, { isUpdate: true });
    const existing = await getEmailTemplate(req.params.id);
    const updated = await updateEmailTemplate(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: "Template not found." });
    if (existing?.trigger && existing.trigger !== updated.trigger) {
      invalidateTemplateCache(existing.trigger);
    }
    invalidateTemplateCache(updated.trigger);
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
    if (existing?.trigger && existing.trigger !== updated?.trigger) {
      invalidateTemplateCache(existing.trigger);
    }
    invalidateTemplateCache(updated?.trigger);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

emailTemplatesRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await getEmailTemplate(req.params.id);
    const ok = await deleteEmailTemplate(req.params.id);
    if (!ok) return res.status(404).json({ error: "Template not found." });
    if (existing?.trigger) invalidateTemplateCache(existing.trigger);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// Test-send: POST /admin/email-templates/:id/test-send  { to: "admin@example.com", placeholders?: {...} }
emailTemplatesRouter.post("/:id/test-send", async (req, res, next) => {
  try {
    const to = String(req.body?.to || "").trim().toLowerCase();
    if (!to) {
      return res.status(400).json({ error: "Recipient email (to) is required." });
    }

    const template = await getEmailTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found." });

    const appBaseUrl = process.env.APP_BASE_URL || "https://app.novisociety.com";
    const logoUrl = process.env.NOVI_EMAIL_LOGO_URL || "";

    // Client-provided placeholder values (from the test dialog form)
    const clientPlaceholders =
      req.body?.placeholders && typeof req.body.placeholders === "object"
        ? req.body.placeholders
        : {};

    // Server-side defaults — used when the client does not supply a value
    const serverDefaults = {
      first_name: "Test",
      full_name: "Test User",
      app_url: appBaseUrl,
      course_name: "Sample Aesthetics Course",
      course_date: "Saturday, June 14, 2026",
      course_time: "9:00 AM - 5:00 PM",
      course_location: "McKinney, TX",
      time_slot: "10:00 AM",
      treatment_type: "Botox",
      gfe_url: `${appBaseUrl}/gfe-test`,
      signup_link: `${appBaseUrl}/setup`,
      service_name: "Sample MD Service",
      rejection_reason: "The uploaded license image was unclear. Please resubmit a clearer copy.",
      provider_name: "Test Provider",
      patient_name: "Test Patient",
    };

    // Merge: client overrides defaults, but email and logo_url are always server-controlled
    const resolved = {
      ...serverDefaults,
      ...clientPlaceholders,
      email: to,
      logo_url: logoUrl,
    };

    const rendered = renderTemplateRow(template, resolved);
    // Full HTML templates are already complete — use as-is. Plain-text gets wrapped.
    const html = rendered.isFullHtml
      ? rendered.bodyHtml
      : wrapEmailBody({
          templateName: template.name,
          bodyHtml: rendered.bodyHtml,
          testMode: true,
          testMeta: { trigger: template.trigger, templateName: template.name },
        });
    await sendResendEmail({ to, subject: `[TEST] ${rendered.subject}`, html });

    return res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (error) {
    return next(error);
  }
});
