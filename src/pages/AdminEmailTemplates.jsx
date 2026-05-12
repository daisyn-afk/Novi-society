import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emailTemplatesApi } from "@/api/emailTemplatesApi";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Mail, Plus, Edit2, Trash2, CheckCircle, Send,
  BookOpen, Award, Shield, Calendar, Eye, FlaskConical,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

const TRIGGERS = [
  { value: "enrollment_paid", label: "Course Payment Confirmed", icon: BookOpen, color: "#C8E63C", desc: "Fires when enrollment payment is completed via Stripe", active: true },
  { value: "new_user_invite", label: "New Account Setup Invite", icon: Mail, color: "#2D6B7F", desc: "Fires when a new user account is created after payment", active: true },
  { value: "md_service_preorder", label: "MD Service Pre-Order Welcome", icon: Shield, color: "#FA6F30", desc: "Fires when a provider secures a spot for MD services", active: true },
  { value: "license_verified", label: "License Verified", icon: CheckCircle, color: "#C8E63C", desc: "Fires when admin approves a provider license", active: true },
  { value: "license_rejected", label: "License Rejected", icon: CheckCircle, color: "#DA6A63", desc: "Fires when admin rejects a provider license", active: true },
  { value: "model_booking_confirmed", label: "Model Booking Confirmed", icon: Calendar, color: "#7B8EC8", desc: "Fires when a model training booking is paid or free-checkout", active: true },
  { value: "model_waitlist_promoted", label: "Waitlist Slot Opened", icon: Calendar, color: "#C8E63C", desc: "Fires when a waitlisted model is promoted to confirmed", active: true },
  { value: "model_gfe_assigned", label: "Model GFE Link Sent", icon: FlaskConical, color: "#2D6B7F", desc: "Fires when a Good Faith Exam link is sent to a model", active: true },
  { value: "model_session_reminder", label: "Model Session Reminder (Day Before)", icon: Calendar, color: "#FA6F30", desc: "Fires the day before a model training session", active: true },
  { value: "model_post_training", label: "Model Post-Training Follow-Up", icon: Award, color: "#C8E63C", desc: "Fires after a model training session is completed", active: true },
  { value: "model_gfe_reminder", label: "Model GFE Reminder", icon: FlaskConical, color: "#DA6A63", desc: "Fires when a model has not completed their GFE exam", active: true },
];

const RECIPIENT_TYPES = [
  { value: "provider", label: "Provider" },
  { value: "patient", label: "Patient" },
  { value: "medical_director", label: "Medical Director" },
];

const PLACEHOLDERS = [
  { tag: "{{first_name}}", desc: "Recipient's first name" },
  { tag: "{{full_name}}", desc: "Recipient's full name" },
  { tag: "{{email}}", desc: "Recipient's email address" },
  { tag: "{{app_url}}", desc: "App base URL" },
  { tag: "{{course_name}}", desc: "Course title" },
  { tag: "{{course_date}}", desc: "Course date (formatted)" },
  { tag: "{{course_time}}", desc: "Course start–end time" },
  { tag: "{{course_location}}", desc: "Course location" },
  { tag: "{{time_slot}}", desc: "Model session time slot" },
  { tag: "{{treatment_type}}", desc: "Treatment type label (Botox / Filler / etc.)" },
  { tag: "{{gfe_url}}", desc: "Good Faith Exam link URL" },
  { tag: "{{signup_link}}", desc: "Account setup / invite link" },
  { tag: "{{service_name}}", desc: "MD service or subscription name" },
  { tag: "{{rejection_reason}}", desc: "Reason text for license rejection" },
  { tag: "{{provider_name}}", desc: "Provider full name" },
  { tag: "{{patient_name}}", desc: "Patient full name" },
];

const DEFAULT_PLACEHOLDER_VALUES = {
  first_name: "Sarah",
  full_name: "Sarah Johnson",
  email: "sarah@example.com",
  app_url: "https://app.novisociety.com",
  course_name: "Botox & Dermal Filler Fundamentals",
  course_date: "Saturday, June 14, 2026",
  course_time: "9:00 AM – 5:00 PM",
  course_location: "McKinney, TX",
  time_slot: "10:00 AM",
  treatment_type: "Botox",
  gfe_url: "https://app.novisociety.com/gfe",
  signup_link: "https://app.novisociety.com/setup",
  service_name: "MD Board Coverage",
  rejection_reason: "The uploaded license image was unclear. Please resubmit.",
  provider_name: "Sarah Johnson",
  patient_name: "Alex Martinez",
  logo_url: "https://hjelcmcfqogoflxkhhpj.supabase.co/storage/v1/object/public/course-covers/admin-courses/1776410859667-3dba1a15-020c-4132-8b6b-4b0b15e72fb8.png",
};

// TODO[REMOVE_OUTDATED_SEED_TEMPLATES]: these 3 stubs were the original starter templates seeded via the UI.
// They are outdated (wrong triggers, simplified HTML, not matching real sent emails).
// Real templates are now seeded via supabase/migrations/20260509010000_seed_real_email_templates.sql.
// Remove this entire commented block when confirmed no longer needed.
/*
const DEFAULT_TEMPLATES = [ ... ];
*/

const CARD_STYLE = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.9)",
  boxShadow: "0 2px 16px rgba(30,37,53,0.07)",
};

const EMPTY_FORM = {
  name: "", trigger: "", recipient_type: "provider",
  subject: "", body_text: "",
  is_active: true, send_delay_minutes: 0,
};

const tagToKey = (tag) => tag.replace("{{", "").replace("}}", "");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyPlaceholders(content, values) {
  return String(content || "").replace(/\{\{(\w+)\}\}/g, (full, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key] ?? "") : full
  );
}

// Converts plain text with line breaks to styled HTML paragraphs — mirrors backend.
function plainTextToHtml(text) {
  return String(text || "")
    .split(/\n\n+/)
    .map(para => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(trimmed).replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<\/th>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/^ /gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Extracts only the inner HTML of the main white content cell.
// This is the editable region — header (logo) and footer (©, support) are excluded.
function extractMainBodyContentHtml(html) {
  const source = String(html || "");
  if (!source) return "";
  const openCellRe = /<tr>\s*<td[^>]*style=['"][^'"]*background:\s*#fff[^'"]*['"][^>]*>/i;
  const openMatch = openCellRe.exec(source);
  if (!openMatch) return source;
  const contentStart = openMatch.index + openMatch[0].length;
  const afterContent = source.slice(contentStart);
  const beforeFooterRe = /<\/td>\s*<\/tr>\s*<tr>\s*<td[^>]*style=['"][^'"]*padding:\s*24px[^'"]*['"][^>]*>/i;
  const beforeFooterMatch = beforeFooterRe.exec(afterContent);
  if (beforeFooterMatch) {
    return afterContent.slice(0, beforeFooterMatch.index);
  }
  const closeCellIdx = afterContent.search(/<\/td>\s*<\/tr>/i);
  return closeCellIdx === -1 ? afterContent : afterContent.slice(0, closeCellIdx);
}

// Derive editable plain text for the textarea from the rich body_html.
// Guarantees the textarea content's paragraphs map 1:1 to paragraphs in body_html,
// so paragraph-pair replacement keeps the preview in sync with the user's edits.
function htmlToEditableText(html) {
  return htmlToPlainText(extractMainBodyContentHtml(html));
}

function forceNoviLogoCenter(html) {
  return String(html || "").replace(
    /(<img\b[^>]*alt=["']NOVI Society["'][^>]*style=["'])([^"']*)(["'][^>]*>)/gi,
    (_match, start, styles, end) => {
      let next = String(styles || "");
      if (!/display\s*:\s*block/i.test(next)) next += `${next.trim().endsWith(";") ? "" : ";"}display:block;`;
      if (!/margin\s*:\s*0\s*auto/i.test(next)) next += "margin:0 auto;";
      return `${start}${next}${end}`;
    }
  );
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

const NOVI_LOGO_URL = "https://hjelcmcfqogoflxkhhpj.supabase.co/storage/v1/object/public/course-covers/admin-courses/1776410859667-3dba1a15-020c-4132-8b6b-4b0b15e72fb8.png";

// ── Smart layout generator ──────────────────────────────────────────────────
// Converts admin-edited plain text into styled NOVI HTML, preserving the
// branded layout for well-known sections while keeping body_text the
// single source of truth. Sections detected:
//   • "Course Details" header + key/value lines → branded gray box w/ table
//   • Lines starting with "• " inside a paragraph → bulleted list
//   • "What to Expect Next" header → bold section header
//   • Trailing closing block (We look forward… / Best, / Team name) → signature card
function escapeInline(text) {
  return escapeHtml(String(text || "")).replace(/\n/g, "<br>");
}

function isCourseDetailsKeyValue(line) {
  return /^(Course|Date|Time|Location)\s+\S/i.test(line.trim());
}

function parseCourseDetailsKeyValue(line) {
  const m = line.trim().match(/^(Course|Date|Time|Location)\s+(.+)$/i);
  if (!m) return null;
  const [, key, value] = m;
  const label = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
  return { label, value };
}

function renderCourseDetailsBox(rows) {
  const tableRows = rows
    .map((row) => `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:100px"><strong>${escapeInline(row.label)}</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">${escapeInline(row.value)}</td></tr>`)
    .join("\n              ");
  return `<div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:32px;border:1px solid rgba(0,0,0,0.07)">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2D6B7F">Course Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              ${tableRows}
            </table>
          </div>`;
}

function renderBulletList(items) {
  const lis = items
    .map((item) => `<li style="display:list-item;list-style-type:disc">${escapeInline(item)}</li>`)
    .join("\n            ");
  return `<ul style="margin:0 0 32px;padding-left:20px;color:#374151;font-size:15px;line-height:1.9;list-style-type:disc">
            ${lis}
          </ul>`;
}

function renderSectionHeader(text) {
  return `<p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">${escapeInline(text)}</p>`;
}

function renderParagraph(text) {
  return `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">${escapeInline(text)}</p>`;
}

function renderSignatureBlock(lines) {
  const parts = [];
  const isClosing = (line) => /^We look forward to seeing you soon/i.test(line.trim());
  const isItalicTagline = (line) => /^A New Way to Be Seen/i.test(line.trim());
  const isWelcomeNovi = (line) => /^Welcome to NOVI\.?$/i.test(line.trim());

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (isClosing(line)) {
      parts.push(`<p style="margin:0 0 4px;font-size:15px;color:#374151">${escapeInline(line)}</p>`);
    } else if (isWelcomeNovi(line)) {
      parts.push(`<p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;color:#1e2535;font-style:italic">${escapeInline(line)}</p>`);
    } else if (isItalicTagline(line)) {
      parts.push(`<p style="margin:0 0 20px;font-size:14px;color:#6b7280;font-style:italic">${escapeInline(line)}</p>`);
    } else if (/^Best,?$/i.test(line) && i + 1 < lines.length) {
      // Combine "Best," + team line into one signoff paragraph
      const teamLine = lines[i + 1].trim();
      parts.push(`<p style="margin:0;font-size:15px;color:#374151">${escapeInline(line)}<br><strong>${escapeInline(teamLine)}</strong></p>`);
      i += 1;
    } else {
      parts.push(`<p style="margin:0 0 4px;font-size:15px;color:#374151">${escapeInline(line)}</p>`);
    }
  }

  return `<div style="border-top:1px solid #e5e7eb;padding-top:28px;margin-top:8px">
            ${parts.join("\n            ")}
          </div>`;
}

function findSignatureStartIndex(paragraphs) {
  return paragraphs.findIndex((p) => /^We look forward to seeing you soon/i.test(String(p).trim().split("\n")[0]));
}

function bodyTextToRichBody(text) {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return "";

  const sigStart = findSignatureStartIndex(paragraphs);
  const mainParas = sigStart === -1 ? paragraphs : paragraphs.slice(0, sigStart);
  const sigParas = sigStart === -1 ? [] : paragraphs.slice(sigStart);

  const parts = [];
  let i = 0;
  while (i < mainParas.length) {
    const para = mainParas[i];
    const trimmed = para.trim();

    // Course Details box: header followed by 2+ key/value paragraphs
    if (/^Course Details$/i.test(trimmed)) {
      const rows = [];
      let j = i + 1;
      while (j < mainParas.length && isCourseDetailsKeyValue(mainParas[j])) {
        const kv = parseCourseDetailsKeyValue(mainParas[j]);
        if (kv) rows.push(kv);
        j += 1;
      }
      if (rows.length >= 2) {
        parts.push(renderCourseDetailsBox(rows));
        i = j;
        continue;
      }
    }

    // Bullet block (single paragraph with multiple "• " lines)
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2 && lines.every((l) => l.startsWith("•"))) {
      const items = lines.map((l) => l.replace(/^•\s*/, "").trim());
      parts.push(renderBulletList(items));
      i += 1;
      continue;
    }
    // Single-line bullet: treat as 1-item list when surrounded by similar siblings is unusual; fall through to paragraph
    if (lines.length === 1 && lines[0].startsWith("•")) {
      // Collect consecutive single-line bullet paragraphs into one list
      const items = [lines[0].replace(/^•\s*/, "").trim()];
      let j = i + 1;
      while (j < mainParas.length) {
        const nextLines = mainParas[j].split("\n").map((l) => l.trim()).filter(Boolean);
        if (nextLines.length === 1 && nextLines[0].startsWith("•")) {
          items.push(nextLines[0].replace(/^•\s*/, "").trim());
          j += 1;
        } else break;
      }
      if (items.length >= 2) {
        parts.push(renderBulletList(items));
        i = j;
        continue;
      }
    }

    // Section header
    if (/^What to Expect Next$/i.test(trimmed)) {
      parts.push(renderSectionHeader(trimmed));
      i += 1;
      continue;
    }

    parts.push(renderParagraph(trimmed));
    i += 1;
  }

  if (sigParas.length > 0) {
    const sigLines = sigParas.flatMap((p) => p.split("\n").map((l) => l.trim()).filter(Boolean));
    parts.push(renderSignatureBlock(sigLines));
  }

  return parts.join("\n          ");
}

function renderBrandedEmailHtml(bodyText, { logoUrl = NOVI_LOGO_URL } = {}) {
  const innerHtml = bodyTextToRichBody(bodyText);
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          <img src="${logoUrl}" alt="NOVI Society" style="width:160px;height:auto;display:block;margin:0 auto" />
        </td></tr>
        <tr><td style="background:#fff;padding:48px 40px;border-radius:0 0 16px 16px">
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:24px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© 2026 NOVI Society LLC · 8109 Meadow Valley Dr, McKinney, TX 75071</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af"><a href="mailto:support@novisociety.com" style="color:#9ca3af">support@novisociety.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Frontend preview wrapper — mirrors backend wrapEmailBody exactly.
function wrapInLayout(bodyHtml, { testMode = false, testMeta = /** @type {{trigger?:string,templateName?:string}} */ ({}) } = {}) {
  const testBanner = testMode ? `
        <tr><td style="padding:16px 40px;text-align:center;background:#fff8ed;border-top:1px solid #fde68a;">
          <p style="margin:0;font-size:12px;color:#92400e;font-weight:600;">⚠ TEST EMAIL — not sent to real recipients</p>
          <p style="margin:4px 0 0;font-size:11px;color:#b45309;">Trigger: ${testMeta.trigger || ""} · Template: ${testMeta.templateName || ""}</p>
        </td></tr>` : "";

  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 0;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0;">
          <img src="${NOVI_LOGO_URL}" alt="NOVI Society" style="width:160px;height:auto;display:block;margin:0 auto;" />
        </td></tr>
        <tr><td style="background:#fff;padding:40px;border-radius:0 0 16px 16px;">
          ${bodyHtml}
        </td></tr>${testBanner}
        <tr><td style="padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 NOVI Society LLC · 8109 Meadow Valley Dr, McKinney, TX 75071</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;"><a href="mailto:support@novisociety.com" style="color:#9ca3af;">support@novisociety.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

export default function AdminEmailTemplates() {
  const { toast, dismiss } = useToast();
  const qc = useQueryClient();

  // ── Edit dialog state ─────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editOriginalBodyText, setEditOriginalBodyText] = useState("");
  const [editPreviewPlaceholders, setEditPreviewPlaceholders] = useState({ ...DEFAULT_PLACEHOLDER_VALUES });
  const [editPlaceholdersOpen, setEditPlaceholdersOpen] = useState(false);

  // ── Preview dialog state ──────────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // ── Test-send dialog state ────────────────────────────────────────────────
  const [testOpen, setTestOpen] = useState(false);
  const [testTemplate, setTestTemplate] = useState(null);
  const [testEmail, setTestEmail] = useState("");
  const [testPlaceholders, setTestPlaceholders] = useState({ ...DEFAULT_PLACEHOLDER_VALUES });
  const [testPlaceholdersOpen, setTestPlaceholdersOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ["email-templates"],
    queryFn: emailTemplatesApi.list,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!editing) return emailTemplatesApi.create(form);
      // Deterministically regenerate the rich HTML from the edited body_text so
      // saved body_html always matches the textarea content exactly. Backend
      // trusts new_body_html when provided and stores it as-is.
      const hasRichTemplate = Boolean(String(editing.body_html || "").trim());
      const regeneratedHtml = hasRichTemplate
        ? renderBrandedEmailHtml(form.body_text)
        : "";
      return emailTemplatesApi.update(editing.id, {
        ...form,
        clear_body_html: false,
        original_body_text: editOriginalBodyText,
        ...(regeneratedHtml ? { new_body_html: regeneratedHtml } : {}),
      });
    },
    onSuccess: (saved) => {
      // Update the cache immediately so any dialog that opens right after save
      // already sees the new body_html — no waiting for a background refetch.
      if (saved) {
        qc.setQueryData(["email-templates"], (old) =>
          Array.isArray(old)
            ? old.map(t => t.id === saved.id ? saved : t)
            : old
        );
      }
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setDialogOpen(false);
      setEditing(null);
      setEditOriginalBodyText("");
      const { id } = toast({ title: editing ? "Template updated" : "Template created" });
      setTimeout(() => dismiss(id), 5000);
    },
    onError: (err) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: emailTemplatesApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (err) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => emailTemplatesApi.patch(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
    onError: (err) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const testSendMutation = useMutation({
    mutationFn: ({ id, to, placeholders }) => emailTemplatesApi.testSend(id, to, placeholders),
    onSuccess: (_, { to }) => {
      toast({ title: "Test email sent", description: `Sent to ${to}` });
      setTestOpen(false);
      setTestEmail("");
    },
    onError: (err) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openNew = (prefillTrigger = "") => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, trigger: prefillTrigger });
    setEditOriginalBodyText("");
    setEditPreviewPlaceholders({ ...DEFAULT_PLACEHOLDER_VALUES });
    setEditPlaceholdersOpen(false);
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    // body_text is the source of truth. body_html is deterministically
    // regenerated from body_text on save so they cannot drift. If body_text
    // is missing, derive a clean version from the rich HTML so the admin
    // never sees an empty editor.
    const storedBodyText = String(t.body_text || "").trim();
    const derivedBodyText = storedBodyText || htmlToEditableText(t.body_html || "");
    setEditing(t);
    setForm({
      name: t.name,
      trigger: t.trigger,
      recipient_type: t.recipient_type,
      subject: t.subject,
      body_text: derivedBodyText,
      is_active: t.is_active,
      send_delay_minutes: t.send_delay_minutes || 0,
    });
    setEditOriginalBodyText(derivedBodyText);
    setEditPreviewPlaceholders({ ...DEFAULT_PLACEHOLDER_VALUES });
    setEditPlaceholdersOpen(false);
    setDialogOpen(true);
  };

  const openTest = (t) => {
    setTestTemplate(t);
    setTestEmail("");
    setTestPlaceholders({ ...DEFAULT_PLACEHOLDER_VALUES });
    setTestPlaceholdersOpen(true);
    setTestOpen(true);
  };

  const insertPlaceholder = (tag) => {
    setForm(f => ({ ...f, body_text: f.body_text + tag }));
  };

  const triggerMeta = (trigger) => TRIGGERS.find(t => t.value === trigger);

  // ── Computed ──────────────────────────────────────────────────────────────
  const previewBodyHtml = plainTextToHtml(applyPlaceholders(form.body_text, editPreviewPlaceholders));
  const previewSubject = applyPlaceholders(form.subject, editPreviewPlaceholders);
  const formIsValid = form.name && form.trigger && form.subject && form.body_text.trim();
  // Live preview is deterministically rebuilt from the textarea content so the
  // admin sees exactly what will be saved. The smart generator preserves the
  // branded NOVI styling (Course Details box, bullet lists, signature block).
  const hasRichTemplate = Boolean(String(editing?.body_html || "").trim());
  const editRenderedBody = hasRichTemplate
    ? forceNoviLogoCenter(applyPlaceholders(renderBrandedEmailHtml(form.body_text), editPreviewPlaceholders))
    : wrapInLayout(previewBodyHtml);

  const byTrigger = {};
  templates.forEach(t => {
    byTrigger[t.trigger] = byTrigger[t.trigger] || [];
    byTrigger[t.trigger].push(t);
  });

  const testUsedPlaceholders = (() => {
    if (!testTemplate) return [];
    const text = `${testTemplate.subject || ""} ${testTemplate.body_text || ""} ${testTemplate.body_html || ""}`;
    const keys = new Set();
    const re = /\{\{(\w+)\}\}/g;
    let m;
    while ((m = re.exec(text)) !== null) keys.add(m[1]);
    return PLACEHOLDERS.filter(p => keys.has(tagToKey(p.tag)));
  })();

  const testRenderedSubject = applyPlaceholders(testTemplate?.subject, testPlaceholders);
  const testRenderedBody = (() => {
    if (!testTemplate) return "";
    // Use rich body_html if available (full HTML already includes NOVI layout)
    if (testTemplate.body_html) {
      return forceNoviLogoCenter(applyPlaceholders(normalizeFullHtmlTail(testTemplate.body_html), testPlaceholders));
    }
    return wrapInLayout(plainTextToHtml(applyPlaceholders(testTemplate.body_text || "", testPlaceholders)), { testMode: true, testMeta: { trigger: testTemplate.trigger, templateName: testTemplate.name } });
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#7B8EC8" }}>Automated Emails</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.2 }}>Email Automation</h1>
          <p className="mt-1 text-sm" style={{ color: "rgba(30,37,53,0.6)", maxWidth: 480 }}>
            Create emails that fire automatically when providers, patients, or MDs reach key milestones — course enrollment, license verification, MD activation, and more.
          </p>
        </div>
        <Button onClick={() => openNew()} className="gap-2 font-bold flex-shrink-0" style={{ background: "#FA6F30", color: "#fff", borderRadius: 12 }}>
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Templates", value: templates.length, color: "#7B8EC8" },
          { label: "Active", value: templates.filter(t => t.is_active).length, color: "#C8E63C" },
          { label: "Inactive", value: templates.filter(t => !t.is_active).length, color: "#FA6F30" },
          { label: "Total Sent", value: templates.reduce((s, t) => s + (t.total_sent || 0), 0), color: "#DA6A63" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl px-4 py-4" style={CARD_STYLE}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1 }}>{value}</p>
            <p className="text-xs font-semibold mt-1" style={{ color }}>{label}</p>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-2xl px-5 py-4 text-sm" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.3)", color: "#DA6A63" }}>
          Failed to load templates. Make sure the admin API is running and the migration is applied.
        </div>
      )}

      {/* Trigger list */}
      {!isLoading && (
        <div className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
          <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.5)" }}>All Trigger Events</p>
            <p className="text-sm mt-0.5" style={{ color: "rgba(30,37,53,0.6)" }}>Each trigger fires automatically when the event occurs</p>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(30,37,53,0.06)" }}>
            {TRIGGERS.map(trigger => {
              const tpls = byTrigger[trigger.value] || [];
              const Icon = trigger.icon;
              return (
                <div key={trigger.value} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${trigger.color}18` }}>
                    <Icon className="w-4 h-4" style={{ color: trigger.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{trigger.label}</p>
                      {trigger.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10" }}>Wired</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{trigger.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {tpls.length === 0 ? (
                      <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.4)" }}>No template</span>
                    ) : (
                      tpls.map(t => (
                        <div key={t.id} className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{
                            background: t.is_active ? "rgba(200,230,60,0.15)" : "rgba(30,37,53,0.06)",
                            color: t.is_active ? "#4a6b10" : "rgba(30,37,53,0.4)"
                          }}>
                            {t.is_active ? "Active" : "Off"} · {t.recipient_type}
                          </span>
                          <button onClick={() => openEdit(t)} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all hover:opacity-80 flex items-center gap-1" style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.25)" }}>
                            <Edit2 className="w-3 h-3" />Edit
                          </button>
                        </div>
                      ))
                    )}
                    {tpls.length > 0 && (
                      <button
                        onClick={() => openTest(tpls.find(t => t.is_active) || tpls[0])}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all hover:opacity-80 flex items-center gap-1"
                        style={{ background: "rgba(45,107,127,0.1)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.25)" }}>
                        <Send className="w-3 h-3" />Test
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All templates list */}
      {templates.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>All Templates</p>
          {templates.map(t => {
            const meta = triggerMeta(t.trigger);
            const Icon = meta?.icon || Mail;
            return (
              <div key={t.id} className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta?.color || "#7B8EC8"}18` }}>
                    <Icon className="w-5 h-5" style={{ color: meta?.color || "#7B8EC8" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm" style={{ color: "#1e2535" }}>{t.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize" style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8" }}>{t.recipient_type}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                      Trigger: <strong>{meta?.label || t.trigger}</strong>
                      {t.last_sent_at && ` · Last sent ${format(new Date(t.last_sent_at), "MMM d, yyyy")}`}
                      {t.total_sent > 0 && ` · ${t.total_sent} sent`}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(30,37,53,0.4)" }}>Subject: {t.subject}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: t.id, is_active: v })}
                    />
                    <button onClick={() => { setPreviewTemplate(t); setPreviewOpen(true); }} className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ color: "#7B8EC8" }} title="Preview">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => openTest(t)} className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ color: "#2D6B7F" }} title="Send test email">
                      <FlaskConical className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ color: "#FA6F30" }} title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (window.confirm("Delete this template?")) deleteMutation.mutate(t.id); }}
                      className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
                      style={{ color: "#DA6A63" }}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>
              {editing ? "Edit Email Template" : "New Email Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">

            {/* Core fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Template Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Course Enrollment Welcome" />
              </div>
              <div>
                <Label>Trigger Event *</Label>
                <Select value={form.trigger} onValueChange={v => setForm(f => ({ ...f, trigger: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select trigger..." /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.trigger && <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>{triggerMeta(form.trigger)?.desc}</p>}
              </div>
              <div>
                <Label>Send To *</Label>
                <Select value={form.recipient_type} onValueChange={v => setForm(f => ({ ...f, recipient_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECIPIENT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Email Subject *</Label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. You're enrolled in {{course_name}}!" />
              </div>
            </div>

            {/* Placeholders — collapsible; click to insert, edit value for live preview */}
            <div className="rounded-xl p-3" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
              <div
                className="flex items-center justify-between gap-2"
                onClick={() => setEditPlaceholdersOpen(o => !o)}
                style={{ cursor: "pointer" }}
              >
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>
                  Placeholders — click to insert · edit value for preview
                </p>
                <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold flex-shrink-0" style={{ color: "#7B8EC8" }}>
                  {editPlaceholdersOpen ? "Collapse" : "Expand"}
                  {editPlaceholdersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
              {editPlaceholdersOpen && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-2.5">
                  {PLACEHOLDERS.map(p => {
                    const key = tagToKey(p.tag);
                    return (
                      <div key={p.tag} className="space-y-0.5">
                        <button
                          onClick={() => insertPlaceholder(p.tag)}
                          title={`Click to insert ${p.tag} · ${p.desc}`}
                          className="text-xs px-2.5 py-0.5 rounded-full font-mono transition-all hover:opacity-70 active:scale-95"
                          style={{ background: "rgba(123,142,200,0.15)", color: "#4a5fa8", border: "1px solid rgba(123,142,200,0.3)" }}
                        >
                          {p.tag}
                        </button>
                        <Input
                          value={editPreviewPlaceholders[key] ?? ""}
                          onChange={e => setEditPreviewPlaceholders(prev => ({ ...prev, [key]: e.target.value }))}
                          className="h-7 text-xs"
                          placeholder={p.desc}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Body textarea */}
            <div>
              <Label>Email Body *</Label>
              <p className="text-xs mb-2" style={{ color: "rgba(30,37,53,0.45)" }}>
                {editing?.body_html
                  ? "Edit the plain-text content and save. The branded design stays consistent, and preview/test reflect your latest saved version."
                  : "Write your message in plain text. Use double line breaks for new paragraphs. The system handles all formatting, branding, and layout automatically."}
              </p>
              <textarea
                value={form.body_text}
                onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))}
                rows={10}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-y"
                style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535", lineHeight: 1.7, fontFamily: "inherit" }}
                placeholder={"Hi {{first_name}},\n\nYour enrollment in {{course_name}} is confirmed!\n\nWe'll see you on {{course_date}} at {{course_location}}.\n\nWelcome to NOVI Society,\nThe NOVI Team"}
              />
            </div>

            {/* Live preview */}
            {form.body_text.trim() && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Preview</p>
                <div className="rounded-xl px-4 py-3" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }}>
                  <p className="text-xs font-bold mb-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>SUBJECT</p>
                  <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{previewSubject || "—"}</p>
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(30,37,53,0.1)" }}>
                  <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: "rgba(30,37,53,0.04)", color: "rgba(30,37,53,0.4)", borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
                    Email Preview
                  </div>
                  <div className="max-h-72 overflow-y-auto" dangerouslySetInnerHTML={{
                    __html: editRenderedBody
                  }} />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Active — fires automatically when trigger occurs</Label>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null); }}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!formIsValid || saveMutation.isPending}
                style={{ background: "#FA6F30", color: "#fff" }}
              >
                {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ────────────────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-3 pt-2">
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(30,37,53,0.05)", border: "1px solid rgba(30,37,53,0.1)" }}>
                <p className="text-xs font-bold" style={{ color: "rgba(30,37,53,0.5)" }}>SUBJECT</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: "#1e2535" }}>{previewTemplate.subject}</p>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(30,37,53,0.1)" }}>
                <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: "rgba(30,37,53,0.05)", color: "rgba(30,37,53,0.5)", borderBottom: "1px solid rgba(30,37,53,0.08)" }}>Email Preview</div>
                <div dangerouslySetInnerHTML={{
                  __html: previewTemplate.body_html
                    ? forceNoviLogoCenter(normalizeFullHtmlTail(previewTemplate.body_html))
                    : wrapInLayout(plainTextToHtml(previewTemplate.body_text || ""))
                }} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPreviewOpen(false)} className="flex-1">Close</Button>
                <Button onClick={() => { setPreviewOpen(false); openTest(previewTemplate); }} className="flex-1 gap-2" style={{ background: "#2D6B7F", color: "#fff" }}>
                  <FlaskConical className="w-4 h-4" /> Send Test
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Test-Send Dialog ──────────────────────────────────────────────── */}
      <Dialog open={testOpen} onOpenChange={(v) => { if (!v) { setTestOpen(false); setTestEmail(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>Send Test Email</DialogTitle>
          </DialogHeader>
          {testTemplate && (
            <div className="space-y-4 pt-2">

              {/* Placeholder values */}
              <div className="rounded-xl p-3" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
                <div
                  className="flex items-center justify-between gap-2 mb-2.5"
                  onClick={() => setTestPlaceholdersOpen(p => !p)}
                  style={{ cursor: "pointer" }}
                >
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>Placeholder Values</p>
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "#7B8EC8" }}>
                    {testPlaceholdersOpen ? "Collapse" : "Expand"}
                    {testPlaceholdersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {testPlaceholdersOpen && (
                  testUsedPlaceholders.length === 0 ? (
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>No placeholders in this template.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      {testUsedPlaceholders.map(p => {
                        const key = tagToKey(p.tag);
                        return (
                          <div key={p.tag}>
                            <label className="text-xs font-semibold font-mono" style={{ color: "rgba(30,37,53,0.6)" }}>{p.tag}</label>
                            <Input value={testPlaceholders[key] ?? ""} onChange={e => setTestPlaceholders(prev => ({ ...prev, [key]: e.target.value }))} className="mt-0.5 h-8 text-xs" placeholder={p.desc} />
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              {/* Subject preview */}
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(30,37,53,0.05)", border: "1px solid rgba(30,37,53,0.1)" }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.5)" }}>Subject</p>
                <p className="text-sm font-semibold mt-0.5 break-words" style={{ color: "#1e2535" }}>{testRenderedSubject || "—"}</p>
              </div>

              {/* Email preview */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(30,37,53,0.1)" }}>
                <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: "rgba(30,37,53,0.05)", color: "rgba(30,37,53,0.5)", borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
                  Email Preview
                </div>
                <div className="max-h-64 overflow-y-auto" dangerouslySetInnerHTML={{ __html: testRenderedBody }} />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "rgba(30,37,53,0.1)" }} />
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Send</p>
                <div className="flex-1 h-px" style={{ background: "rgba(30,37,53,0.1)" }} />
              </div>

              <div>
                <Label>Send to *</Label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && testEmail)
                      testSendMutation.mutate({ id: testTemplate.id, to: testEmail, placeholders: testPlaceholders });
                  }}
                />
                <p className="text-xs mt-1.5" style={{ color: "rgba(30,37,53,0.45)" }}>Subject is prefixed with [TEST] when sent.</p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => { setTestOpen(false); setTestEmail(""); }}>Cancel</Button>
                <Button
                  onClick={() => testSendMutation.mutate({ id: testTemplate.id, to: testEmail, placeholders: testPlaceholders })}
                  disabled={!testEmail || testSendMutation.isPending}
                  className="gap-2"
                  style={{ background: "#2D6B7F", color: "#fff" }}
                >
                  <Send className="w-4 h-4" />
                  {testSendMutation.isPending ? "Sending..." : "Send Test Email"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
