import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Mail,
  Edit2,
  Eye,
  RotateCcw,
  Send,
  Sparkles,
  Users,
  BookOpen,
  Award,
  Shield,
  Calendar,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { format } from "date-fns";

const CATEGORY_META = {
  onboarding: { label: "Accounts & Onboarding", icon: BookOpen, color: "#7B8EC8" },
  credentials: { label: "Licenses & Certifications", icon: Award, color: "#C8E63C" },
  admin_alert: { label: "Admin Alerts", icon: AlertTriangle, color: "#FA6F30" },
  supplier: { label: "Supplier / Manufacturer", icon: Building2, color: "#2D6B7F" },
  appointments: { label: "Patient Appointments", icon: Calendar, color: "#7B8EC8" },
  model: { label: "Model Training", icon: Sparkles, color: "#DA6A63" },
  uncategorized: { label: "Other", icon: Mail, color: "#9CA3AF" },
};

const RECIPIENT_LABELS = {
  provider: "Provider",
  patient: "Patient",
  medical_director: "Medical Director",
  admin: "Admin",
  manufacturer_rep: "Manufacturer Rep",
};

const CARD_STYLE = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.9)",
  boxShadow: "0 2px 16px rgba(30,37,53,0.07)",
};

function categoryMeta(key) {
  return CATEGORY_META[key] || CATEGORY_META.uncategorized;
}

function recipientLabel(value) {
  return RECIPIENT_LABELS[String(value || "").toLowerCase()] || value || "—";
}

// Block placeholders are kept in the stored body but hidden from the editor.
const BLOCK_TAGS = new Set([
  "cta_button",
  "summary_list",
  "details_block",
  "order_table",
  "message_block",
  "rejection_block",
]);

function parseBodySegments(body) {
  const lines = String(body || "").replace(/\r\n/g, "\n").split("\n");
  const segments = [];
  let buffer = [];
  const flush = () => {
    const text = buffer.join("\n").replace(/^\n+|\n+$/g, "");
    if (text.trim()) segments.push({ type: "text", value: text });
    buffer = [];
  };
  for (const line of lines) {
    const match = line.trim().match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
    if (match && BLOCK_TAGS.has(match[1])) {
      flush();
      segments.push({ type: "block", tag: line.trim() });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return segments;
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1$2");
}

function scalarSampleEntries(sampleVars) {
  return Object.entries(sampleVars || {})
    .filter(([, v]) => v != null && typeof v !== "object")
    .map(([k, v]) => [k, String(v)])
    .sort((a, b) => b[1].length - a[1].length);
}

// Fill {{placeholders}} with sample preview values so the editor reads like
// the live email ("Order Request — Sam Provider" instead of {{contact_subject}}).
function fillSampleValues(text, sampleVars) {
  let out = stripMarkdown(text);
  for (const [key, value] of scalarSampleEntries(sampleVars)) {
    if (value) out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

// Turn edited preview text back into {{placeholders}} for storage.
function restorePlaceholders(text, sampleVars) {
  let out = String(text || "");
  for (const [key, value] of scalarSampleEntries(sampleVars)) {
    if (value) out = out.split(value).join(`{{${key}}}`);
  }
  return out;
}

const EDITOR_GREETING_LINE = "Hi {{first_name}},";

function stripEditorGreeting(text) {
  return String(text || "")
    .replace(/^Hi\s+\{\{\s*first_name\s*\}\},?\s*\n+/i, "")
    .replace(/^Hi\s+.+,\s*\n+/i, "");
}

// Stored body -> plain text shown in the editor (matches preview wording).
// Greeting is shown separately as read-only Hi {{first_name}}, — not in the textarea.
function bodyToEditorText(body, sampleVars) {
  const segments = parseBodySegments(body);
  return segments
    .filter((s) => s.type === "text")
    .map((s) => fillSampleValues(s.value, sampleVars))
    .join("\n\n");
}

// Editor plain text -> stored body. Re-inserts hidden block placeholders
// (table, bullet list, button) in their original positions.
function editorTextToStoredBody(editorText, sampleVars, referenceBody) {
  const stripped = stripEditorGreeting(editorText);
  const paragraphs = stripped.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const refSegments = parseBodySegments(referenceBody || "");
  let pIdx = 0;
  const parts = [];
  for (const seg of refSegments) {
    if (seg.type === "block") {
      parts.push(seg.tag);
    } else if (pIdx < paragraphs.length) {
      parts.push(restorePlaceholders(paragraphs[pIdx++], sampleVars));
    } else {
      parts.push(seg.value);
    }
  }
  while (pIdx < paragraphs.length) {
    parts.push(restorePlaceholders(paragraphs[pIdx++], sampleVars));
  }
  return parts.join("\n\n");
}

function subjectToEditorText(subject, sampleVars) {
  return fillSampleValues(subject, sampleVars);
}

const EMPTY_DRAFT = {
  subject: "",
  body_html: "",
  cta_label: "",
  cta_url_path: "",
  is_active: true,
};

export default function AdminEmailTemplates() {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [bodyText, setBodyText] = useState("");
  const [subjectText, setSubjectText] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => base44.entities.EmailTemplate.list(),
  });

  const grouped = useMemo(() => {
    const buckets = {};
    for (const tpl of templates) {
      const key = tpl.category || "uncategorized";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(tpl);
    }
    return buckets;
  }, [templates]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("No template selected.");
      return base44.entities.EmailTemplate.update(editing.template_key, draft);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setEditing(null);
      setDraft(EMPTY_DRAFT);
      setBodyText("");
      setSubjectText("");
    },
  });

  const revertMutation = useMutation({
    mutationFn: async (templateKey) =>
      base44.entities.EmailTemplate.delete(templateKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setEditing(null);
      setDraft(EMPTY_DRAFT);
      setBodyText("");
      setSubjectText("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ templateKey, isActive }) =>
      base44.entities.EmailTemplate.setActive(templateKey, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
  });

  function openEditor(tpl) {
    const sample = tpl.sample_vars || {};
    setEditing(tpl);
    setDraft({
      subject: tpl.subject || "",
      body_html: tpl.body_html || "",
      cta_label: tpl.cta_label || "",
      cta_url_path: tpl.cta_url_path || "",
      is_active: tpl.is_active !== false,
    });
    setSubjectText(subjectToEditorText(tpl.subject || "", sample));
    setBodyText(bodyToEditorText(tpl.body_html || "", sample));
    setPreviewHtml("");
    setPreviewSubject("");
    setPreviewError("");
  }

  function closeEditor() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setBodyText("");
    setSubjectText("");
    setPreviewHtml("");
    setPreviewSubject("");
    setPreviewError("");
  }

  function syncDraftFromEditor(subjectValue, bodyValue) {
    if (!editing) return;
    const sample = editing.sample_vars || {};
    const referenceBody = editing.default_body_html || editing.body_html || "";
    setDraft((d) => ({
      ...d,
      subject: restorePlaceholders(subjectValue, sample),
      body_html: editorTextToStoredBody(bodyValue, sample, referenceBody),
    }));
  }

  function handleSubjectTextChange(value) {
    setSubjectText(value);
    syncDraftFromEditor(value, bodyText);
  }

  function handleBodyTextChange(value) {
    setBodyText(value);
    syncDraftFromEditor(subjectText, value);
  }

  async function refreshPreview() {
    if (!editing) return;
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const result = await base44.entities.EmailTemplate.preview(editing.template_key, {
        subject: draft.subject,
        body_html: draft.body_html,
        cta_label: draft.cta_label,
        cta_url_path: draft.cta_url_path,
      });
      if (!result?.ok) {
        setPreviewError(result?.error || "Preview failed.");
        setPreviewHtml("");
        setPreviewSubject("");
      } else {
        setPreviewHtml(result.html || "");
        setPreviewSubject(result.subject || "");
      }
    } catch (err) {
      setPreviewError(err?.message || "Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    if (!editing) return;
    refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.template_key]);

  const activeCount = templates.filter((t) => t.is_active !== false).length;
  const overrideCount = templates.filter((t) => t.has_override).length;
  const totalSent = templates.reduce((sum, t) => sum + (t.total_sent || 0), 0);
  const categoryKeys = Object.keys(grouped).sort((a, b) => {
    const order = ["onboarding", "credentials", "admin_alert", "supplier", "appointments", "model", "uncategorized"];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#7B8EC8" }}>
            Automated Emails
          </p>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 28,
              color: "#1e2535",
              lineHeight: 1.2,
            }}
          >
            Email Automation
          </h1>
          <p className="mt-1 text-sm" style={{ color: "rgba(30,37,53,0.6)", maxWidth: 560 }}>
            Every email NOVI sends — to providers, patients, MDs, admins and suppliers — uses the same
            branded design. You only edit the wording: just change the text like a normal document. The
            logo, colours, layout and structured pieces (button, detail box, bullet list) are added
            automatically.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Templates", value: templates.length, color: "#7B8EC8" },
          { label: "Active", value: activeCount, color: "#C8E63C" },
          { label: "Customised", value: overrideCount, color: "#FA6F30" },
          { label: "Sent (lifetime)", value: totalSent, color: "#DA6A63" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl px-4 py-4" style={CARD_STYLE}>
            <p
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 28,
                color: "#1e2535",
                lineHeight: 1,
              }}
            >
              {value}
            </p>
            <p className="text-xs font-semibold mt-1" style={{ color }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading &&
        categoryKeys.map((catKey) => {
          const meta = categoryMeta(catKey);
          const Icon = meta.icon;
          const rows = grouped[catKey] || [];
          return (
            <div key={catKey} className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
              <div
                className="px-6 py-4 border-b flex items-center gap-3"
                style={{ borderColor: "rgba(30,37,53,0.08)" }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${meta.color}18` }}
                >
                  <Icon className="w-4 h-4" style={{ color: meta.color }} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>
                    {meta.label}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                    {rows.length} template{rows.length === 1 ? "" : "s"} in this group
                  </p>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: "rgba(30,37,53,0.06)" }}>
                {rows.map((tpl) => (
                  <div key={tpl.template_key} className="px-6 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm" style={{ color: "#1e2535" }}>
                          {tpl.name}
                        </p>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: "rgba(123,142,200,0.12)",
                            color: "#7B8EC8",
                          }}
                        >
                          {recipientLabel(tpl.recipient_type)}
                        </span>
                        {tpl.has_override && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              background: "rgba(250,111,48,0.12)",
                              color: "#FA6F30",
                            }}
                          >
                            Customised
                          </span>
                        )}
                        {tpl.is_active === false && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              background: "rgba(218,106,99,0.12)",
                              color: "#DA6A63",
                            }}
                          >
                            Inactive
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs mt-1 truncate"
                        style={{ color: "rgba(30,37,53,0.55)" }}
                      >
                        Subject: {tpl.subject}
                      </p>
                      <p
                        className="text-[11px] font-mono mt-0.5"
                        style={{ color: "rgba(30,37,53,0.4)" }}
                      >
                        {tpl.template_key}
                        {tpl.last_sent_at &&
                          ` · Last sent ${format(new Date(tpl.last_sent_at), "MMM d, yyyy")}`}
                        {tpl.total_sent > 0 && ` · ${tpl.total_sent} sent`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Switch
                        checked={tpl.is_active !== false}
                        onCheckedChange={(v) =>
                          toggleMutation.mutate({
                            templateKey: tpl.template_key,
                            isActive: v,
                          })
                        }
                      />
                      <button
                        onClick={() => openEditor(tpl)}
                        className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
                        style={{ color: "#FA6F30" }}
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) closeEditor();
        }}
      >
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle
              style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}
            >
              {editing?.name || "Edit Email Template"}
            </DialogTitle>
            {editing && (
              <p className="text-xs font-mono" style={{ color: "rgba(30,37,53,0.5)" }}>
                {editing.template_key} · {recipientLabel(editing.recipient_type)} ·{" "}
                {categoryMeta(editing.category).label}
              </p>
            )}
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              <div className="space-y-4">
                <div>
                  <Label>Email Subject</Label>
                  <Input
                    value={subjectText}
                    onChange={(e) => handleSubjectTextChange(e.target.value)}
                  />
                  <p
                    className="text-[11px] mt-1"
                    style={{ color: "rgba(30,37,53,0.45)" }}
                  >
                    Default:{" "}
                    {subjectToEditorText(editing.default_subject, editing.sample_vars)}
                  </p>
                </div>

                <div>
                  <Label>Message text</Label>
                  <div
                    className="rounded-t-xl px-3 py-2 text-sm select-none"
                    style={{
                      background: "rgba(123,142,200,0.1)",
                      border: "1px solid rgba(30,37,53,0.12)",
                      borderBottom: "none",
                      color: "rgba(30,37,53,0.65)",
                      lineHeight: 1.6,
                    }}
                  >
                    {EDITOR_GREETING_LINE}
                    <span
                      className="ml-2 text-[11px] italic"
                      style={{ color: "rgba(30,37,53,0.45)" }}
                    >
                      — added automatically for each recipient
                    </span>
                  </div>
                  <textarea
                    value={bodyText}
                    onChange={(e) => handleBodyTextChange(e.target.value)}
                    rows={16}
                    className="w-full rounded-b-xl px-3 py-2.5 text-sm outline-none resize-y"
                    style={{
                      background: "rgba(0,0,0,0.04)",
                      border: "1px solid rgba(30,37,53,0.12)",
                      borderTop: "1px dashed rgba(30,37,53,0.15)",
                      color: "#1e2535",
                      lineHeight: 1.6,
                    }}
                  />
                  <p
                    className="text-[11px] mt-1.5 leading-relaxed"
                    style={{ color: "rgba(30,37,53,0.55)" }}
                  >
                    The greeting uses each recipient&apos;s first name automatically — do not type
                    a name here. Edit the message below it. Order details, tables, buttons and
                    bullet lists are still added for you when the email is sent.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={draft.is_active}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
                  />
                  <Label>
                    Active — use this customised text. Turn off to fall back to the built-in default.
                  </Label>
                </div>

                <div className="flex gap-2 flex-wrap pt-2">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    style={{ background: "#FA6F30", color: "#fff" }}
                  >
                    {saveMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => refreshPreview()}
                    disabled={previewLoading}
                  >
                    {previewLoading ? "Rendering..." : "Refresh Preview"}
                  </Button>
                  {editing.has_override && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (confirm("Discard customisation and revert to built-in default?")) {
                          revertMutation.mutate(editing.template_key);
                        }
                      }}
                      disabled={revertMutation.isPending}
                      className="gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Revert to default
                    </Button>
                  )}
                  <Button variant="ghost" onClick={closeEditor}>
                    Close
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(30,37,53,0.05)",
                    border: "1px solid rgba(30,37,53,0.1)",
                  }}
                >
                  <p
                    className="text-xs font-bold"
                    style={{ color: "rgba(30,37,53,0.5)" }}
                  >
                    SUBJECT PREVIEW
                  </p>
                  <p
                    className="text-sm font-semibold mt-0.5"
                    style={{ color: "#1e2535" }}
                  >
                    {previewSubject || (previewLoading ? "Rendering…" : "—")}
                  </p>
                </div>
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(30,37,53,0.1)" }}
                >
                  <div
                    className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest flex items-center justify-between"
                    style={{
                      background: "rgba(30,37,53,0.05)",
                      color: "rgba(30,37,53,0.5)",
                      borderBottom: "1px solid rgba(30,37,53,0.08)",
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5" /> Live shell preview
                    </span>
                    {editing.has_override ? (
                      <span style={{ color: "#FA6F30" }}>Custom</span>
                    ) : (
                      <span style={{ color: "#9CA3AF" }}>Default</span>
                    )}
                  </div>
                  {previewError ? (
                    <div className="p-5 text-xs" style={{ color: "#DA6A63" }}>
                      {previewError}
                    </div>
                  ) : (
                    <iframe
                      title="Email preview"
                      srcDoc={previewHtml}
                      sandbox=""
                      style={{
                        width: "100%",
                        height: 640,
                        border: "none",
                        background: "#f5f3ef",
                      }}
                    />
                  )}
                </div>
                <p
                  className="text-[11px]"
                  style={{ color: "rgba(30,37,53,0.45)" }}
                >
                  Preview uses sample placeholder data from the registry. Real
                  sends substitute live values when each event fires.
                </p>
                <div className="rounded-xl px-4 py-3" style={{ background: "rgba(200,230,60,0.1)" }}>
                  <p
                    className="text-xs font-bold uppercase tracking-widest mb-1"
                    style={{ color: "#4a6b10" }}
                  >
                    <Send className="w-3 h-3 inline mr-1" /> Sender metadata
                  </p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.7)" }}>
                    {recipientLabel(editing.recipient_type)} ·{" "}
                    {editing.is_active ? "Active" : "Inactive"} ·{" "}
                    {editing.total_sent || 0} sent
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {!isLoading && templates.length === 0 && (
        <div
          className="rounded-2xl p-10 text-center"
          style={CARD_STYLE}
        >
          <Users className="w-8 h-8 mx-auto mb-3" style={{ color: "#7B8EC8" }} />
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>
            No templates found
          </p>
          <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
            Make sure the email_templates migration has run and the backend route
            <code>/admin/email-templates</code> is reachable.
          </p>
        </div>
      )}
    </div>
  );
}
