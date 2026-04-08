import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Mail, Plus, Zap, Edit2, Trash2, CheckCircle, Send,
  Users, BookOpen, Award, Shield, Calendar, Clock, Eye
} from "lucide-react";
import { format } from "date-fns";

const TRIGGERS = [
  { value: "enrollment_created", label: "Course Enrolled (payment pending)", icon: BookOpen, color: "#7B8EC8", desc: "Fires when a provider enrolls in a course" },
  { value: "enrollment_paid", label: "Course Payment Received", icon: BookOpen, color: "#C8E63C", desc: "Fires when enrollment payment is confirmed" },
  { value: "enrollment_completed", label: "Course Completed", icon: Award, color: "#C8E63C", desc: "Fires when a provider completes a course" },
  { value: "md_subscription_created", label: "MD Membership Applied", icon: Shield, color: "#FA6F30", desc: "Fires when a provider applies for MD coverage" },
  { value: "md_subscription_active", label: "MD Membership Activated", icon: Shield, color: "#C8E63C", desc: "Fires when MD coverage becomes active" },
  { value: "license_verified", label: "License Verified", icon: CheckCircle, color: "#C8E63C", desc: "Fires when admin approves a provider license" },
  { value: "license_rejected", label: "License Rejected", icon: CheckCircle, color: "#DA6A63", desc: "Fires when admin rejects a provider license" },
  { value: "certification_approved", label: "Certification Approved", icon: Award, color: "#C8E63C", desc: "Fires when a certification is approved" },
  { value: "appointment_confirmed", label: "Appointment Confirmed", icon: Calendar, color: "#7B8EC8", desc: "Fires when an appointment is confirmed" },
  { value: "appointment_completed", label: "Appointment Completed", icon: Calendar, color: "#2D6B7F", desc: "Fires when an appointment is marked completed" },
  { value: "pre_order_approved", label: "Pre-Order Approved", icon: CheckCircle, color: "#C8E63C", desc: "Fires when a pre-order application is approved" },
];

const RECIPIENT_TYPES = [
  { value: "provider", label: "Provider" },
  { value: "patient", label: "Patient" },
  { value: "medical_director", label: "Medical Director" },
];

const PLACEHOLDERS = [
  { tag: "{{first_name}}", desc: "Recipient's first name" },
  { tag: "{{full_name}}", desc: "Recipient's full name" },
  { tag: "{{email}}", desc: "Recipient's email" },
  { tag: "{{app_url}}", desc: "App URL link" },
  { tag: "{{course_name}}", desc: "Course title" },
  { tag: "{{service_name}}", desc: "Service or certification name" },
  { tag: "{{provider_name}}", desc: "Provider name" },
  { tag: "{{patient_name}}", desc: "Patient name" },
];

const DEFAULT_TEMPLATES = [
  {
    name: "Course Enrollment Confirmation",
    trigger: "enrollment_created",
    recipient_type: "provider",
    subject: "You're enrolled in {{course_name}} — Here's what to do next",
    body_html: `<p>Hi {{first_name}},</p>
<p>You're officially enrolled in <strong>{{course_name}}</strong> on the NOVI Society platform! 🎉</p>
<h3>Your Next Steps:</h3>
<ol>
  <li><strong>Complete payment</strong> — if you haven't already, finalize your enrollment to secure your spot.</li>
  <li><strong>Review pre-course materials</strong> — log in to access study guides and prep resources.</li>
  <li><strong>Show up ready</strong> — your instructor will give you a class code on the day of class to unlock your certification.</li>
</ol>
<p><a href="{{app_url}}/ProviderEnrollments" style="background:#7B8EC8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0;">View My Enrollments →</a></p>
<p>Questions? Just reply to this email or reach out through the NOVI platform.</p>
<p>Welcome to NOVI Society,<br/>The NOVI Team</p>`,
    is_active: true,
  },
  {
    name: "MD Membership Activation",
    trigger: "md_subscription_active",
    recipient_type: "provider",
    subject: "Your MD Board Coverage is Active for {{service_name}} ✓",
    body_html: `<p>Hi {{first_name}},</p>
<p>Great news — your <strong>Medical Director Board Coverage for {{service_name}}</strong> is now active!</p>
<p>A NOVI Board Medical Director has been assigned to your account. They will sign your protocols and provide clinical oversight as required by your state.</p>
<h3>You Can Now:</h3>
<ul>
  <li>Offer <strong>{{service_name}}</strong> to patients through the NOVI platform</li>
  <li>List your profile on the Patient Marketplace</li>
  <li>Accept appointment requests from patients</li>
  <li>Submit treatment records for MD review</li>
</ul>
<p><a href="{{app_url}}/ProviderCredentialsCoverage" style="background:#C8E63C;color:#1e2535;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0;">View My Coverage →</a></p>
<p>You're covered,<br/>The NOVI Team</p>`,
    is_active: true,
  },
  {
    name: "License Verified — Next Steps",
    trigger: "license_verified",
    recipient_type: "provider",
    subject: "Your license has been verified — unlock MD coverage now",
    body_html: `<p>Hi {{first_name}},</p>
<p>Your professional license has been <strong>verified</strong> by the NOVI admin team. ✓</p>
<p>You're now eligible to apply for MD Board Coverage, which lets you legally offer aesthetic services under NOVI's Board of Medical Directors.</p>
<h3>Your Next Steps:</h3>
<ol>
  <li><strong>Enroll in a NOVI course</strong> or submit an external certification</li>
  <li><strong>Apply for MD Coverage</strong> for each service you want to offer</li>
  <li><strong>Get matched</strong> with a Board MD — NOVI handles the assignment</li>
</ol>
<p><a href="{{app_url}}/ProviderCredentialsCoverage" style="background:#FA6F30;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0;">Apply for Coverage →</a></p>
<p>You're one step closer,<br/>The NOVI Team</p>`,
    is_active: true,
  },
];

const CARD_STYLE = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.9)",
  boxShadow: "0 2px 16px rgba(30,37,53,0.07)",
};

export default function AdminEmailTemplates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [form, setForm] = useState({
    name: "", trigger: "", recipient_type: "provider", subject: "", body_html: "", is_active: true, send_delay_minutes: 0
  });
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => base44.entities.EmailTemplate.list("-created_date"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return base44.entities.EmailTemplate.update(editing.id, form);
      }
      return base44.entities.EmailTemplate.create(form);
    },
    onSuccess: () => {
      qc.invalidateQueries(["email-templates"]);
      setDialogOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailTemplate.delete(id),
    onSuccess: () => qc.invalidateQueries(["email-templates"]),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.EmailTemplate.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries(["email-templates"]),
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      for (const t of DEFAULT_TEMPLATES) {
        await base44.entities.EmailTemplate.create(t);
      }
    },
    onSuccess: () => qc.invalidateQueries(["email-templates"]),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", trigger: "", recipient_type: "provider", subject: "", body_html: "", is_active: true, send_delay_minutes: 0 });
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, trigger: t.trigger, recipient_type: t.recipient_type, subject: t.subject, body_html: t.body_html, is_active: t.is_active, send_delay_minutes: t.send_delay_minutes || 0 });
    setDialogOpen(true);
  };

  const insertPlaceholder = (tag) => {
    setForm(f => ({ ...f, body_html: f.body_html + tag }));
  };

  const triggerMeta = (trigger) => TRIGGERS.find(t => t.value === trigger);

  // Group templates by trigger
  const byTrigger = {};
  templates.forEach(t => {
    byTrigger[t.trigger] = byTrigger[t.trigger] || [];
    byTrigger[t.trigger].push(t);
  });

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
        <div className="flex gap-2 flex-shrink-0">
          {templates.length === 0 && (
            <Button variant="outline" onClick={() => seedDefaultsMutation.mutate()} disabled={seedDefaultsMutation.isPending} className="gap-2 text-sm">
              <Zap className="w-4 h-4" /> {seedDefaultsMutation.isPending ? "Loading..." : "Load Starter Templates"}
            </Button>
          )}
          <Button onClick={openNew} className="gap-2 font-bold" style={{ background: "#FA6F30", color: "#fff", borderRadius: 12 }}>
            <Plus className="w-4 h-4" /> New Template
          </Button>
        </div>
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

      {/* Trigger overview */}
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
                  <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{trigger.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{trigger.desc}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
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
                        <button onClick={() => openEdit(t)} className="text-xs px-2 py-1 rounded-lg hover:opacity-80 transition-opacity" style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8" }}>
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => { setForm(f => ({ ...f, trigger: trigger.value })); openNew(); }}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all hover:opacity-80"
                    style={{ background: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.25)" }}>
                    <Plus className="w-3 h-3 inline mr-1" />Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: t.id, is_active: v })}
                    />
                    <button onClick={() => { setPreviewTemplate(t); setPreviewOpen(true); }} className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ color: "#7B8EC8" }} title="Preview">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ color: "#FA6F30" }}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm("Delete this template?")) deleteMutation.mutate(t.id); }} className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ color: "#DA6A63" }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>
              {editing ? "Edit Email Template" : "New Email Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
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
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Welcome to {{course_name}}!" />
              </div>
            </div>

            {/* Placeholder helper */}
            <div className="rounded-xl p-3" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#7B8EC8" }}>Available Placeholders — click to insert</p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map(p => (
                  <button key={p.tag} onClick={() => insertPlaceholder(p.tag)} title={p.desc}
                    className="text-xs px-2.5 py-1 rounded-full font-mono transition-all hover:opacity-80"
                    style={{ background: "rgba(123,142,200,0.15)", color: "#4a5fa8", border: "1px solid rgba(123,142,200,0.3)" }}>
                    {p.tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Email Body (HTML or plain text) *</Label>
              <textarea
                value={form.body_html}
                onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))}
                rows={14}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none resize-y"
                style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535", lineHeight: 1.6 }}
                placeholder="<p>Hi {{first_name}},</p>&#10;<p>Your email content here...</p>&#10;<p><a href='{{app_url}}'>Back to NOVI →</a></p>"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Active (emails will send automatically when trigger fires)</Label>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!form.name || !form.trigger || !form.subject || !form.body_html || saveMutation.isPending}
                style={{ background: "#FA6F30", color: "#fff" }}
              >
                {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
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
                <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ background: "rgba(30,37,53,0.05)", color: "rgba(30,37,53,0.5)", borderBottom: "1px solid rgba(30,37,53,0.08)" }}>EMAIL BODY</div>
                <div className="p-5" style={{ color: "#1e2535", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: previewTemplate.body_html }} />
              </div>
              <Button variant="outline" onClick={() => setPreviewOpen(false)} className="w-full">Close Preview</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}