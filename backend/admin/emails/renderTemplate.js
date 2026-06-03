/**
 * Email template renderer.
 *
 *   renderEmailTemplate(templateKey, vars) -> { ok, sent, subject, html, error }
 *
 * Loads the row from public.email_templates when present (and active),
 * otherwise falls back to the in-code templateRegistry default so
 * transactional flows never break if an admin deletes a row.
 *
 * Substitutes:
 *   - simple {{var}} placeholders from `vars`
 *   - block placeholders the registry knows about (cta_button, summary_list,
 *     details_block, order_table, message_block, rejection_block, reset_link)
 *
 * Wraps the resulting body in the canonical course-style shell and (optionally)
 * dispatches via Resend.
 */

import {
  buildCourseStyleEmailHtml,
  buildCtaButtonBlock,
  buildDetailListBlock,
  buildSummaryListBlock,
  buildOrderTableBlock,
  buildHighlightBlock,
  buildMessageQuoteBlock,
  escapeEmailHtml,
  getEmailAppBaseUrl,
  sendResendHtmlEmail,
} from "./courseStyleEmail.js";
import { getTemplateDefinition } from "./templateRegistry.js";
import { pool } from "../db.js";

let emailTemplatesTableReadyPromise = null;

async function isEmailTemplatesTablePresent() {
  if (!emailTemplatesTableReadyPromise) {
    emailTemplatesTableReadyPromise = pool
      .query(
        `select 1
         from information_schema.tables
         where table_schema = 'public' and table_name = 'email_templates'
         limit 1`
      )
      .then((r) => Boolean(r.rows?.length))
      .catch(() => false);
  }
  return emailTemplatesTableReadyPromise;
}

async function loadDbOverride(templateKey) {
  if (!templateKey) return null;
  const present = await isEmailTemplatesTablePresent();
  if (!present) return null;
  try {
    const { rows } = await pool.query(
      `select template_key, name, category, recipient_type, subject,
              body_html, cta_label, cta_url_path, is_active
         from public.email_templates
        where template_key = $1
        limit 1`,
      [templateKey]
    );
    return rows[0] || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[renderTemplate] loadDbOverride failed for ${templateKey}:`, err?.message || err);
    return null;
  }
}

async function incrementSendCounters(templateKey) {
  const present = await isEmailTemplatesTablePresent();
  if (!present) return;
  try {
    await pool.query(
      `update public.email_templates
         set total_sent = coalesce(total_sent, 0) + 1,
             last_sent_at = now()
       where template_key = $1`,
      [templateKey]
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[renderTemplate] increment counters failed for ${templateKey}:`, err?.message || err);
  }
}

function resolveAbsoluteUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^[a-z][a-z0-9+\-.]*:/i.test(value)) return value;
  if (value.startsWith("mailto:") || value.startsWith("tel:")) return value;
  const base = getEmailAppBaseUrl();
  if (value.startsWith("/")) return `${base}${value}`;
  return `${base}/${value}`;
}

function getNestedValue(obj, dottedKey) {
  if (!obj || !dottedKey) return undefined;
  const parts = String(dottedKey).split(".");
  let cursor = obj;
  for (const part of parts) {
    if (cursor == null) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function substituteSimpleVars(template, vars) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key) => {
    if (BLOCK_PLACEHOLDERS.has(key)) return match;
    const value = getNestedValue(vars, key);
    if (value == null) return "";
    return String(value);
  });
}

const BLOCK_PLACEHOLDERS = new Set([
  "cta_button",
  "summary_list",
  "details_block",
  "order_table",
  "message_block",
  "rejection_block",
  "reset_link_text",
]);

function buildBlocks({ definition, override, vars }) {
  const ctaLabel =
    vars.cta_label ??
    override?.cta_label ??
    definition?.cta_label ??
    "";
  const ctaPath =
    vars.cta_url ??
    vars.cta_url_path ??
    override?.cta_url_path ??
    definition?.cta_url_path ??
    "";
  // Allow callers to expand placeholders inside cta_url_path (e.g. {{reset_link}}).
  const resolvedCtaPath = substituteSimpleVars(ctaPath, vars);
  const cta_button = buildCtaButtonBlock({
    label: ctaLabel,
    url: resolveAbsoluteUrl(resolvedCtaPath),
    palette: vars.cta_palette || "primary",
  });

  const summary_list = buildSummaryListBlock(vars.summary_lines || []);
  const details_block = buildDetailListBlock({
    title: vars.details_title || "",
    rows: vars.details || [],
  });
  const order_table = buildOrderTableBlock(vars.order_items || []);
  const message_block = buildMessageQuoteBlock(vars.message || "");
  const rejection_block = vars.rejection_reason
    ? buildHighlightBlock({
        title: vars.rejection_title || "Reason",
        body: vars.rejection_reason,
        tone: vars.rejection_tone || "danger",
      })
    : "";

  return {
    cta_button,
    summary_list,
    details_block,
    order_table,
    message_block,
    rejection_block,
  };
}

function substituteBlocks(template, blocks) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (Object.hasOwn(blocks, key)) return blocks[key];
    return match;
  });
}

// ---------------------------------------------------------------------------
// Plain-text body rendering.
//
// Template bodies are authored as plain text so non-technical admins never see
// raw HTML. This converts that text into the styled HTML the email shell
// expects:
//   - blank lines separate paragraphs (each wrapped in a styled <p>)
//   - single newlines inside a paragraph become <br>
//   - **bold**, *italic*, and [label](url) markdown-lite are supported
//   - a line that is just a block placeholder (e.g. {{cta_button}}) is left
//     untouched so substituteBlocks can inject the structured component
//   - lines that already look like HTML (start with a tag) pass through as-is,
//     so legacy HTML bodies / overrides keep rendering unchanged
// ---------------------------------------------------------------------------

const BLOCK_PLACEHOLDER_LINE = /^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/;
const HTML_LINE = /^\s*<[a-zA-Z!/]/;
const PARAGRAPH_STYLE = "margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6";

function isBlockPlaceholderLine(line) {
  const match = line.trim().match(BLOCK_PLACEHOLDER_LINE);
  return Boolean(match && BLOCK_PLACEHOLDERS.has(match[1]));
}

function applyInlineFormatting(line) {
  let safe = escapeEmailHtml(line);
  // [label](url) — link
  safe = safe.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const trimmedUrl = String(url).trim();
    const href = /^(https?:|mailto:|tel:)/i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
    return `<a href="${href}" style="color:#2D6B7F;">${label}</a>`;
  });
  // **bold**
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // *italic* (avoid matching the ** already consumed above)
  safe = safe.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  return safe;
}

function renderRichTextBody(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let paragraph = [];

  const flush = () => {
    if (!paragraph.length) return;
    const inner = paragraph.map(applyInlineFormatting).join("<br>");
    out.push(`<p style="${PARAGRAPH_STYLE}">${inner}</p>`);
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) {
      flush();
      continue;
    }
    if (isBlockPlaceholderLine(line) || HTML_LINE.test(line)) {
      flush();
      out.push(line.trim());
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return out.join("\n");
}

function pickGreetingName(vars) {
  if (vars?.greeting_name) return String(vars.greeting_name);
  if (vars?.first_name) return String(vars.first_name);
  if (vars?.full_name) return String(vars.full_name).split(/\s+/)[0];
  return "there";
}

export function resolveTemplate(templateKey) {
  const key = String(templateKey || "").trim();
  const definition = getTemplateDefinition(key);
  return definition;
}

/**
 * Render a template into { subject, html } without sending.
 * Useful for the AdminEmailTemplates preview endpoint.
 *
 * Pass `options.draftOverride = { subject?, body_html?, cta_label?, cta_url_path? }`
 * to preview unsaved edits without persisting an override row.
 */
export async function renderEmailTemplate(templateKey, vars = {}, options = {}) {
  const key = String(templateKey || "").trim();
  const definition = getTemplateDefinition(key);
  if (!definition) {
    return {
      ok: false,
      error: `Unknown email template: ${key}`,
    };
  }

  const draftOverride = options.draftOverride || null;
  const dbOverride = draftOverride ? null : await loadDbOverride(key);
  const isActive = draftOverride
    ? true
    : dbOverride
      ? dbOverride.is_active !== false
      : true;
  const effective = draftOverride
    ? {
        subject: draftOverride.subject ?? definition.subject,
        body_html: draftOverride.body_html ?? definition.body_html,
      }
    : isActive && dbOverride
      ? {
          subject: dbOverride.subject || definition.subject,
          body_html: dbOverride.body_html || definition.body_html,
        }
      : {
          subject: definition.subject,
          body_html: definition.body_html,
        };

  const mergedVars = {
    app_url: getEmailAppBaseUrl(),
    email: vars.to || vars.email || "",
    ...vars,
  };

  const blocks = buildBlocks({
    definition,
    override: draftOverride || dbOverride,
    vars: mergedVars,
  });

  const subject = substituteSimpleVars(effective.subject, mergedVars).trim();
  const bodyWithVars = substituteSimpleVars(effective.body_html, mergedVars);
  // Convert the plain-text (markdown-lite) body into styled HTML. Block
  // placeholder lines and any legacy HTML lines pass through untouched.
  const richBody = renderRichTextBody(bodyWithVars);
  const bodyWithBlocks = substituteBlocks(richBody, blocks);
  // Re-run var substitution on blocks (rare but possible if blocks contain refs).
  const finalBody = substituteSimpleVars(bodyWithBlocks, mergedVars);

  const html = buildCourseStyleEmailHtml({
    greetingName: pickGreetingName(mergedVars),
    bodyHtml: finalBody,
    includeSignoff: definition.include_signoff !== false,
  });

  return {
    ok: true,
    template_key: key,
    is_active: isActive,
    used_override: Boolean(dbOverride && isActive),
    subject,
    html,
  };
}

/**
 * Render and send an email through Resend.
 * `to` may be passed directly or via vars.to.
 * Returns { ok, sent, skipped, reason?, subject?, error? }.
 */
export async function sendEmailFromTemplate(templateKey, vars = {}) {
  const recipient = String(vars.to || vars.email || "").trim();
  if (!recipient) {
    return { ok: false, sent: false, skipped: true, reason: "missing_recipient" };
  }

  const rendered = await renderEmailTemplate(templateKey, vars);
  if (!rendered.ok) {
    return { ok: false, sent: false, error: rendered.error };
  }

  const dispatch = await sendResendHtmlEmail({
    to: recipient,
    subject: rendered.subject,
    html: rendered.html,
  });

  if (!dispatch.ok) {
    return {
      ok: false,
      sent: false,
      error: dispatch.error || "resend_failed",
      subject: rendered.subject,
    };
  }

  await incrementSendCounters(templateKey);
  return {
    ok: true,
    sent: true,
    subject: rendered.subject,
    used_override: rendered.used_override,
  };
}

export { escapeEmailHtml as escapeForEmail };
