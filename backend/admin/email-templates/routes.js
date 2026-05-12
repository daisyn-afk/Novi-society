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
  plainTextToHtml,
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

function resolveRequestBaseUrl(req, fallbackBaseUrl = "https://app.novisociety.com") {
  const fallback = String(fallbackBaseUrl || "").trim() || "https://app.novisociety.com";
  const proto = String(req?.get?.("x-forwarded-proto") || req?.protocol || "https")
    .split(",")[0]
    .trim();
  const host = String(req?.get?.("x-forwarded-host") || req?.get?.("host") || "")
    .split(",")[0]
    .trim();
  const candidates = [
    req?.get?.("origin"),
    req?.get?.("referer"),
    host ? `${proto}://${host}` : "",
  ];
  for (const candidate of candidates) {
    const raw = String(candidate || "").trim();
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (!/^https?:$/i.test(parsed.protocol)) continue;
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      // continue to next candidate
    }
  }
  return fallback.replace(/\/+$/, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toStyledParagraphHtml(paragraphText) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(paragraphText).replace(/\n/g, "<br>")}</p>`;
}

function splitParagraphs(text) {
  return String(text || "")
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function replaceFirst(source, target, replacement) {
  const idx = source.indexOf(target);
  if (idx === -1) return source;
  return `${source.slice(0, idx)}${replacement}${source.slice(idx + target.length)}`;
}

function insertIntoMainBodyCell(fullHtml, appendHtml) {
  const source = String(fullHtml || "");
  const extra = String(appendHtml || "");
  if (!source || !extra) return source;

  const openCellRe = /<tr>\s*<td[^>]*style=['"][^'"]*background:\s*#fff[^'"]*['"][^>]*>/i;
  const openMatch = openCellRe.exec(source);
  if (!openMatch) return source;

  const contentStart = openMatch.index + openMatch[0].length;
  const afterContent = source.slice(contentStart);
  const beforeFooterRe = /<\/td><\/tr>\s*<tr><td[^>]*style=['"][^'"]*padding:\s*24px[^'"]*['"][^>]*>/i;
  const beforeFooterMatch = beforeFooterRe.exec(afterContent);
  const contentEnd = beforeFooterMatch
    ? contentStart + beforeFooterMatch.index
    : source.toLowerCase().lastIndexOf("</body>");
  if (contentEnd === -1) return source;

  return `${source.slice(0, contentEnd)}${extra}${source.slice(contentEnd)}`;
}

function normalizeFullHtmlTail(html) {
  const source = String(html || "");
  if (!source) return source;
  const closeHtmlIdx = source.toLowerCase().lastIndexOf("</html>");
  if (closeHtmlIdx === -1) return source;

  const docEnd = closeHtmlIdx + "</html>".length;
  const doc = source.slice(0, docEnd);
  const tail = source.slice(docEnd).trim();
  if (!tail) return doc;

  const merged = insertIntoMainBodyCell(doc, tail);
  if (merged !== doc) return merged;
  if (/<\/body>/i.test(doc)) return doc.replace(/<\/body>/i, `${tail}</body>`);
  return `${doc}${tail}`;
}

function appendToMainBodyCell(existingBodyHtml, extraHtml) {
  const fullHtml = normalizeFullHtmlTail(existingBodyHtml);
  const appendHtml = String(extraHtml || "");
  if (!appendHtml) return fullHtml;

  const inMainCell = insertIntoMainBodyCell(fullHtml, appendHtml);
  if (inMainCell !== fullHtml) return inMainCell;
  if (/<\/body>/i.test(fullHtml)) return fullHtml.replace(/<\/body>/i, `${appendHtml}</body>`);
  return `${fullHtml}${appendHtml}`;
}

function syncRichHtmlWithBodyText(existingBodyHtml, oldBodyText, newBodyText) {
  let updated = normalizeFullHtmlTail(existingBodyHtml);
  if (!updated) return updated;

  const oldParagraphs = splitParagraphs(oldBodyText);
  const newParagraphs = splitParagraphs(newBodyText);
  if (newParagraphs.length === 0) return updated;
  if (oldParagraphs.length === 0) return appendToMainBodyCell(updated, plainTextToHtml(newBodyText));

  const pairCount = Math.min(oldParagraphs.length, newParagraphs.length);
  for (let i = 0; i < pairCount; i += 1) {
    const from = oldParagraphs[i];
    const to = newParagraphs[i];
    if (!from || from === to) continue;

    const escapedFrom = escapeHtml(from).replace(/\n/g, "<br>");
    const escapedTo = escapeHtml(to).replace(/\n/g, "<br>");
    const next = replaceFirst(updated, escapedFrom, escapedTo);
    if (next !== updated) {
      updated = next;
      continue;
    }

    // Some seeded rows contain unescaped apostrophes/quotes; fallback to raw text replacement.
    updated = replaceFirst(updated, from, to);
  }

  return updated;
}

function withSyncedBodyHtml(payload, existing) {
  const next = { ...(payload || {}) };
  if (next.clear_body_html) return next;
  // If caller explicitly provides new rich HTML, trust it.
  if (String(next.new_body_html || "").trim()) {
    next.new_body_html = normalizeFullHtmlTail(next.new_body_html);
    return next;
  }
  const incomingBodyText = String(next.body_text || "").trim();
  // Prefer editor-provided snapshot (derived from rich HTML when body_text is empty).
  // This gives us a reliable baseline for text replacement while preserving structure.
  const existingBodyText = String(next.original_body_text || existing?.body_text || "").trim();
  const normalizedExistingHtml = normalizeFullHtmlTail(existing?.body_html || "");
  const hasExistingRichHtml = Boolean(String(normalizedExistingHtml || "").trim());
  const bodyChanged = incomingBodyText !== existingBodyText;
  const needsTailNormalization = hasExistingRichHtml
    && normalizedExistingHtml !== String(existing?.body_html || "");
  if (!incomingBodyText || (!bodyChanged && !needsTailNormalization)) return next;

  if (hasExistingRichHtml) {
    next.new_body_html = syncRichHtmlWithBodyText(
      normalizedExistingHtml,
      existingBodyText,
      incomingBodyText
    );
    return next;
  }

  // Plain-text-only templates still get wrapped in the branded NOVI layout.
  next.new_body_html = wrapEmailBody({
    templateName: String(next.name || existing?.name || ""),
    bodyHtml: plainTextToHtml(incomingBodyText),
  });
  return next;
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
    if (!existing) return res.status(404).json({ error: "Template not found." });
    const payload = withSyncedBodyHtml(req.body || {}, existing);
    const updated = await updateEmailTemplate(req.params.id, payload);
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
    const merged = withSyncedBodyHtml({ ...existing, ...req.body }, existing);
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

    const appBaseUrl = resolveRequestBaseUrl(req, process.env.APP_BASE_URL || "https://app.novisociety.com");
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
