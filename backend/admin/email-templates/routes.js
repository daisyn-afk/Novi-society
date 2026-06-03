/**
 * /admin/email-templates routes.
 *
 * GET    /                 - list every template (registry + overrides merged)
 * GET    /categories       - list category metadata for the UI
 * GET    /placeholders     - common placeholders supported across templates
 * GET    /:key             - single merged template
 * PUT    /:key             - upsert override (subject/body/cta/is_active)
 * PATCH  /:key/active      - quick toggle of is_active
 * DELETE /:key             - delete override (revert to registry default)
 * POST   /:key/preview     - render preview HTML with sample vars
 */

import { Router } from "express";
import {
  deleteEmailTemplateOverride,
  getEmailTemplate,
  listCategoryMetadata,
  listCommonPlaceholders,
  listEmailTemplates,
  setEmailTemplateActive,
  upsertEmailTemplate,
} from "./repository.js";
import { renderEmailTemplate } from "../emails/renderTemplate.js";
import { getTemplateDefinition } from "../emails/templateRegistry.js";
import { requireAdminOrStaffWithModule } from "../auth/helpers.js";

export const emailTemplatesRouter = Router();

emailTemplatesRouter.use(requireAdminOrStaffWithModule("AdminEmailTemplates"));

emailTemplatesRouter.get("/", async (_req, res, next) => {
  try {
    const items = await listEmailTemplates();
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

emailTemplatesRouter.get("/categories", (_req, res) => {
  return res.json(listCategoryMetadata());
});

emailTemplatesRouter.get("/placeholders", (_req, res) => {
  return res.json(listCommonPlaceholders());
});

emailTemplatesRouter.get("/:key", async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim();
    const item = await getEmailTemplate(key);
    if (!item) return res.status(404).json({ error: "Unknown template key." });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
});

emailTemplatesRouter.put("/:key", async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim();
    const updated = await upsertEmailTemplate(key, req.body || {});
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

emailTemplatesRouter.patch("/:key/active", async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim();
    const isActive = req.body?.is_active == null ? true : Boolean(req.body.is_active);
    const updated = await setEmailTemplateActive(key, isActive);
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

emailTemplatesRouter.delete("/:key", async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim();
    const reverted = await deleteEmailTemplateOverride(key);
    if (!reverted) return res.status(404).json({ error: "Unknown template key." });
    return res.json(reverted);
  } catch (err) {
    return next(err);
  }
});

emailTemplatesRouter.post("/:key/preview", async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim();
    const definition = getTemplateDefinition(key);
    if (!definition) {
      return res.status(404).json({ error: "Unknown template key." });
    }
    const body = req.body || {};
    const sampleVars = { ...(definition.sample_vars || {}), ...(body.vars || {}) };
    const hasDraft =
      body.subject != null ||
      body.body_html != null ||
      body.cta_label != null ||
      body.cta_url_path != null;
    const rendered = await renderEmailTemplate(
      key,
      sampleVars,
      hasDraft
        ? {
            draftOverride: {
              subject: body.subject,
              body_html: body.body_html,
              cta_label: body.cta_label,
              cta_url_path: body.cta_url_path,
            },
          }
        : undefined
    );
    return res.json(rendered);
  } catch (err) {
    return next(err);
  }
});
