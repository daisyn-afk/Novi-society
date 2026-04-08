import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, GripVertical, Eye, EyeOff } from "lucide-react";

const DEFAULT_SECTIONS = [
  {
    section_id: "novi",
    label: "Set Up Your NOVI Profile",
    intro: "Patients need to find you and book you. Fill out your profile, set your hours, add services, and start accepting bookings.",
    sort_order: 0,
    is_active: true,
    steps: [
      { step_id: "profile", label: "Photo, bio & hours", desc: "Your face, your story, when you're available. Patients decide in 10 seconds. Make it count.", navigate_to: "ProviderPractice", navigate_params: "?tab=profile", is_active: true },
      { step_id: "treatments", label: "Add your services & prices", desc: "What you do, what it costs. Toggle at least one service live — patients can't book without it.", navigate_to: "ProviderPractice", navigate_params: "?tab=treatments", is_active: true },
      { step_id: "book_link", label: "Copy & share your booking link", desc: "Your NOVI profile IS your booking page. Grab the link from the Profile tab and drop it in your Instagram bio right now.", navigate_to: "ProviderProfile", navigate_params: "", is_active: true },
    ],
  },
  {
    section_id: "business",
    label: "Build Your Business Foundation",
    intro: "Protect yourself legally and financially. This section takes a few hours but saves you thousands down the road.",
    sort_order: 1,
    is_active: true,
    steps: [
      { step_id: "llc", label: "Form an LLC", desc: "$50–200 depending on your state. Keeps your personal money separate from your business. ZenBusiness does it in 10 minutes.", navigate_to: "", navigate_params: "", is_active: true },
      { step_id: "ein", label: "Get your EIN — it's free", desc: "5-minute IRS form. You need it to open a bank account and pay taxes correctly.", navigate_to: "", navigate_params: "", is_active: true },
      { step_id: "banking", label: "Open a business bank account", desc: "Mercury and Relay are free and take 10 minutes. Mixing personal and business money is a tax nightmare.", navigate_to: "", navigate_params: "", is_active: true },
      { step_id: "accounting", label: "Track what's coming in and going out", desc: "Wave is free. QuickBooks is $15/month. You can't grow what you don't measure.", navigate_to: "", navigate_params: "", is_active: true },
      { step_id: "insurance", label: "Get malpractice insurance", desc: "$30–50/month. Non-negotiable. One claim without it could cost six figures. Hiscox and CM&F Group specialize in aesthetics.", navigate_to: "", navigate_params: "", is_active: true },
    ],
  },
  {
    section_id: "pricing",
    label: "Lock In Your Pricing",
    intro: "Price too low = burnout. Price too high = no bookings. Find the sweet spot where you're profitable and patients still say yes.",
    sort_order: 2,
    is_active: true,
    steps: [
      { step_id: "pricing_research", label: "Check what your competition charges", desc: "Search 'Botox near me [your city]' on Instagram. NOVI's ROI tab also pulls real market data for your area.", navigate_to: "", navigate_params: "", is_active: true },
      { step_id: "cost_calc", label: "Run your numbers in the ROI Calculator", desc: "Plug in your product cost, time, and overhead. We'll tell you exactly what to charge.", navigate_to: "", navigate_params: "", is_active: true },
      { step_id: "deposit_policy", label: "Set your deposit & cancellation policy", desc: "A 20–30% deposit at booking kills no-shows. 24–48 hour cancellation window.", navigate_to: "ProviderPractice", navigate_params: "?tab=profile", is_active: true },
      { step_id: "packages", label: "Create a bundle, package, or loyalty reward", desc: "'3 Botox sessions for $500' instead of $200 each. Add it in your Treatments tab.", navigate_to: "ProviderPractice", navigate_params: "?tab=treatments", is_active: true },
    ],
  },
  {
    section_id: "marketing",
    label: "Get Your Name Out There",
    intro: "Best injector in the world doesn't matter if nobody knows you exist. Start simple: Instagram, Google, referrals.",
    sort_order: 3,
    is_active: true,
    steps: [
      { step_id: "instagram", label: "Post on Instagram 3x a week", desc: "Switch to a Professional account (free). Before/afters, quick tips, your face. That's literally the whole strategy.", navigate_to: "", navigate_params: "", is_active: true },
      { step_id: "google_biz", label: "Claim your Google Business Profile", desc: "Free. 10 minutes. Shows up when someone in your city searches 'Botox near me.' Essential.", navigate_to: "", navigate_params: "", is_active: true },
      { step_id: "website", label: "Your NOVI profile = your website", desc: "Your NOVI link has your photo, services, pricing, and booking built in. Put it everywhere.", navigate_to: "ProviderProfile", navigate_params: "", is_active: true },
      { step_id: "referral", label: "Launch a referral program", desc: "'Refer a friend, you both save $25.' Text your NOVI link to past patients with that message.", navigate_to: "ProviderProfile", navigate_params: "", is_active: true },
      { step_id: "first_ad", label: "Run a $5/day Instagram ad", desc: "Target women 25–50 in your city. Use a before/after photo. Goal isn't profit — it's figuring out what message lands.", navigate_to: "", navigate_params: "", is_active: true },
    ],
  },
];

export default function AdminLaunchPad() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [editDialog, setEditDialog] = useState(null); // { section, stepIdx? }
  const [editForm, setEditForm] = useState({});

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["launchpad-configs"],
    queryFn: () => base44.entities.LaunchPadConfig.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => data.id
      ? base44.entities.LaunchPadConfig.update(data.id, data)
      : base44.entities.LaunchPadConfig.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["launchpad-configs"] }); setEditDialog(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LaunchPadConfig.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["launchpad-configs"] }),
  });

  const seedDefaults = async () => {
    for (const s of DEFAULT_SECTIONS) {
      await base44.entities.LaunchPadConfig.create(s);
    }
    qc.invalidateQueries({ queryKey: ["launchpad-configs"] });
  };

  const toggleActive = (cfg) => {
    saveMutation.mutate({ ...cfg, is_active: !cfg.is_active });
  };

  const openEditSection = (cfg) => {
    setEditForm({ ...cfg, steps: cfg.steps ? JSON.parse(JSON.stringify(cfg.steps)) : [] });
    setEditDialog({ type: "section" });
  };

  const openNewSection = () => {
    setEditForm({ section_id: "", label: "", intro: "", sort_order: configs.length, is_active: true, steps: [] });
    setEditDialog({ type: "section" });
  };

  const addStep = () => {
    setEditForm(f => ({
      ...f,
      steps: [...(f.steps || []), { step_id: Date.now().toString(), label: "", desc: "", navigate_to: "", navigate_params: "", is_active: true }]
    }));
  };

  const updateStep = (idx, field, val) => {
    setEditForm(f => {
      const steps = [...f.steps];
      steps[idx] = { ...steps[idx], [field]: val };
      return { ...f, steps };
    });
  };

  const removeStep = (idx) => {
    setEditForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));
  };

  const sorted = [...configs].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#FA6F30" }}>Admin</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535" }}>Growth Studio Editor</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.6)" }}>Configure the sections and steps shown to providers on their Growth Studio.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {configs.length === 0 && (
            <Button onClick={seedDefaults} style={{ background: "#7B8EC8", color: "#fff" }} className="gap-2">
              <Plus className="w-4 h-4" /> Seed Defaults
            </Button>
          )}
          <Button onClick={openNewSection} style={{ background: "#FA6F30", color: "#fff" }} className="gap-2">
            <Plus className="w-4 h-4" /> New Section
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.5)" }} />)}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: "rgba(255,255,255,0.6)", border: "1px dashed rgba(30,37,53,0.15)" }}>
          <p className="font-semibold" style={{ color: "#1e2535" }}>No sections yet</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "rgba(30,37,53,0.5)" }}>Seed the default sections or create your own.</p>
          <Button onClick={seedDefaults} style={{ background: "#FA6F30", color: "#fff" }}>Seed Defaults</Button>
        </div>
      ) : sorted.map(cfg => (
        <div key={cfg.id} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(30,37,53,0.1)", opacity: cfg.is_active ? 1 : 0.55 }}>
          <div className="flex items-center gap-3 px-5 py-4">
            <GripVertical className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.25)" }} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: "#1e2535" }}>{cfg.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>{(cfg.steps || []).length} steps · order {cfg.sort_order ?? "—"}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => toggleActive(cfg)} title={cfg.is_active ? "Deactivate" : "Activate"} className="p-1.5 rounded-lg hover:bg-slate-100">
                {cfg.is_active ? <Eye className="w-4 h-4" style={{ color: "#7B8EC8" }} /> : <EyeOff className="w-4 h-4" style={{ color: "rgba(30,37,53,0.3)" }} />}
              </button>
              <button onClick={() => openEditSection(cfg)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <Edit2 className="w-4 h-4" style={{ color: "#FA6F30" }} />
              </button>
              <button onClick={() => deleteMutation.mutate(cfg.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                <Trash2 className="w-4 h-4" style={{ color: "#DA6A63" }} />
              </button>
              <button onClick={() => setExpanded(expanded === cfg.id ? null : cfg.id)} className="p-1.5 rounded-lg hover:bg-slate-100">
                {expanded === cfg.id ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} />}
              </button>
            </div>
          </div>
          {expanded === cfg.id && (
            <div style={{ borderTop: "1px solid rgba(30,37,53,0.07)" }}>
              {cfg.intro && <p className="px-5 py-3 text-xs" style={{ color: "rgba(30,37,53,0.6)", background: "rgba(30,37,53,0.02)" }}>{cfg.intro}</p>}
              {(cfg.steps || []).map((s, i) => (
                <div key={s.step_id || i} className="flex items-start gap-3 px-5 py-3" style={{ borderTop: "1px solid rgba(30,37,53,0.05)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{s.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{s.desc}</p>
                    {s.navigate_to && <p className="text-xs mt-1 font-mono" style={{ color: "#7B8EC8" }}>→ {s.navigate_to}{s.navigate_params}</p>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.is_active ? "rgba(200,230,60,0.15)" : "rgba(30,37,53,0.06)", color: s.is_active ? "#4a6b10" : "rgba(30,37,53,0.4)" }}>
                    {s.is_active ? "Active" : "Hidden"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Edit Section Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(v) => { if (!v) setEditDialog(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif" }}>
              {editForm.id ? "Edit Section" : "New Section"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Section ID *</label>
                <Input value={editForm.section_id || ""} onChange={e => setEditForm(f => ({ ...f, section_id: e.target.value }))} placeholder="e.g. novi, business" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Sort Order</label>
                <Input type="number" value={editForm.sort_order ?? ""} onChange={e => setEditForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 block mb-1">Label *</label>
                <Input value={editForm.label || ""} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 block mb-1">Section Intro Text</label>
                <Textarea value={editForm.intro || ""} onChange={e => setEditForm(f => ({ ...f, intro: e.target.value }))} rows={2} />
              </div>
            </div>

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.5)" }}>Steps</p>
                <Button size="sm" onClick={addStep} style={{ background: "#FA6F30", color: "#fff" }} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add Step
                </Button>
              </div>
              <div className="space-y-3">
                {(editForm.steps || []).map((step, idx) => (
                  <div key={idx} className="rounded-xl p-4 space-y-2" style={{ background: "rgba(30,37,53,0.03)", border: "1px solid rgba(30,37,53,0.08)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.5)" }}>Step {idx + 1}</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateStep(idx, "is_active", !step.is_active)} className="text-xs px-2 py-0.5 rounded-full" style={{ background: step.is_active ? "rgba(200,230,60,0.15)" : "rgba(30,37,53,0.06)", color: step.is_active ? "#4a6b10" : "rgba(30,37,53,0.4)" }}>
                          {step.is_active ? "Active" : "Hidden"}
                        </button>
                        <button onClick={() => removeStep(idx)}><Trash2 className="w-3.5 h-3.5" style={{ color: "#DA6A63" }} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 block mb-0.5">Label *</label>
                        <Input value={step.label || ""} onChange={e => updateStep(idx, "label", e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 block mb-0.5">Description</label>
                        <Textarea value={step.desc || ""} onChange={e => updateStep(idx, "desc", e.target.value)} rows={2} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-0.5">Navigate To (page name)</label>
                        <Input value={step.navigate_to || ""} onChange={e => updateStep(idx, "navigate_to", e.target.value)} placeholder="e.g. ProviderPractice" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-0.5">Query Params</label>
                        <Input value={step.navigate_params || ""} onChange={e => updateStep(idx, "navigate_params", e.target.value)} placeholder="e.g. ?tab=treatments" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate(editForm)}
                disabled={!editForm.section_id || !editForm.label || saveMutation.isPending}
                style={{ background: "#FA6F30", color: "#fff" }}
              >
                {saveMutation.isPending ? "Saving..." : "Save Section"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}