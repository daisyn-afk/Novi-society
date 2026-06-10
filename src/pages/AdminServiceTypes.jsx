import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminApiRequest } from "@/api/adminApiRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp, ShieldCheck, Upload, FileText,
  X, Sparkles, Video, Info, Layers, Package, CheckCircle2, AlertTriangle
} from "lucide-react";
import {
  serviceDisplayName,
  serviceRequiresGfe,
  isMembershipPlan,
} from "@/lib/serviceTypeMembershipModel";

function ServiceBadges({ svc }) {
  return (
    <>
      {serviceRequiresGfe(svc) ? <Badge className="bg-green-100 text-green-700 text-xs">GFE</Badge> : null}
      {svc.requires_additional_provider_cert ? (
        <Badge className="bg-amber-100 text-amber-700 text-xs">
          Cert: {svc.additional_cert_label || "Required"}
        </Badge>
      ) : null}
    </>
  );
}

function serviceMetaLine(svc) {
  const parts = [
    `${svc.scope_rules?.length || 0} scope rules`,
    `${svc.allowed_areas?.length || 0} areas`,
  ];
  if (svc.requires_license_types?.length > 0) {
    parts.push(svc.requires_license_types.join(", "));
  }
  return parts.join(" · ");
}

const CATEGORIES = ["injectables", "fillers", "laser", "skincare", "body_contouring", "prp", "other"];
const LICENSE_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician"];

const CATEGORY_PRESETS = {
  injectables: {
    requires_license_types: ["RN", "NP", "PA", "MD", "DO"],
    requires_supervision_months: 6,
    max_units_per_session: 50,
    allowed_areas: ["Forehead", "Glabella", "Crow's Feet", "Bunny Lines", "Lip Flip", "Masseter", "Neck Bands"],
    scope_rules: [
      { rule_name: "Max Units/Session", rule_value: "50", unit: "units", description: "" },
      { rule_name: "Dilution Standard", rule_value: "2.5ml per 100u", unit: "", description: "" },
      { rule_name: "Re-treatment Interval", rule_value: "3", unit: "months", description: "" },
    ],
    protocol_notes: "Follow standard neurotoxin dilution and injection protocols. Document treatment areas and units used.",
    md_agreement_text: "By signing below, I acknowledge that I have completed the required NOVI training for neurotoxin injections, agree to operate within the approved scope of practice, follow all protocol guidelines, and accept ongoing medical director supervision.",
  },
  fillers: {
    requires_license_types: ["RN", "NP", "PA", "MD", "DO"],
    requires_supervision_months: 12,
    max_units_per_session: 5,
    allowed_areas: ["Lips", "Nasolabial Folds", "Cheeks", "Marionette Lines", "Chin", "Jawline", "Under Eyes"],
    scope_rules: [
      { rule_name: "Max Syringes/Session", rule_value: "5", unit: "syringes", description: "" },
      { rule_name: "Aspiration Required", rule_value: "Yes", unit: "", description: "Aspirate before injecting in vascular areas" },
      { rule_name: "Re-treatment Interval", rule_value: "6", unit: "months", description: "" },
    ],
    protocol_notes: "Dermal filler injections require thorough vascular anatomy knowledge. Hyaluronidase must be on hand at all times.",
    md_agreement_text: "By signing below, I acknowledge that I have completed the required NOVI training for dermal fillers, understand vascular complication risks, agree to keep reversal agents on-site, and accept ongoing medical director supervision.",
  },
  laser: {
    requires_license_types: ["RN", "NP", "PA", "MD", "DO", "esthetician"],
    requires_supervision_months: 3,
    max_units_per_session: null,
    allowed_areas: ["Full Face", "Neck", "Decolletage", "Arms", "Legs", "Back"],
    scope_rules: [
      { rule_name: "Fitzpatrick Scale Max", rule_value: "IV", unit: "", description: "Consult MD for Fitzpatrick V-VI" },
      { rule_name: "Test Spot Required", rule_value: "Yes", unit: "", description: "For first treatment or new parameters" },
    ],
    protocol_notes: "Laser treatments require proper skin typing and test spots.",
    md_agreement_text: "By signing below, I acknowledge that I have completed the required NOVI training for laser treatments and accept ongoing medical director supervision.",
  },
  prp: {
    requires_license_types: ["RN", "NP", "PA", "MD", "DO"],
    requires_supervision_months: 6,
    max_units_per_session: null,
    allowed_areas: ["Scalp", "Full Face", "Under Eyes", "Microneedling Areas"],
    scope_rules: [
      { rule_name: "Blood Draw Volume", rule_value: "15-60", unit: "ml", description: "" },
      { rule_name: "Centrifuge Protocol", rule_value: "Standard PRP spin", unit: "", description: "" },
    ],
    protocol_notes: "PRP requires sterile technique and proper centrifuge protocol.",
    md_agreement_text: "By signing below, I acknowledge that I have completed the required NOVI training for PRP procedures and accept ongoing medical director supervision.",
  },
  skincare: {
    requires_license_types: ["RN", "NP", "PA", "MD", "DO", "esthetician"],
    requires_supervision_months: 0,
    max_units_per_session: null,
    allowed_areas: ["Full Face", "Neck", "Back", "Hands"],
    scope_rules: [],
    protocol_notes: "Document products used and patient skin type.",
    md_agreement_text: "By signing below, I acknowledge that I have completed the required NOVI training for skincare services.",
  },
};

const EMPTY_FORM = {
  name: "", category: "injectables", description: "", is_active: true,
  is_membership: false, included_service_ids: [],
  requires_novi_course: true, requires_license_types: [], requires_supervision_months: 0,
  allowed_areas: [], max_units_per_session: null, protocol_notes: "", md_agreement_text: "",
  md_contract_url: "", protocol_document_urls: [], scope_rules: [],
  monthly_fee: null, requires_additional_provider_cert: false, additional_cert_label: "",
  requires_gfe: false, qualiphy_exam_ids: [],
};

function normalizeServiceForm(initial) {
  if (!initial) return { ...EMPTY_FORM, is_membership: false };
  return {
    ...EMPTY_FORM,
    ...initial,
    is_membership: false,
    allowed_areas: Array.isArray(initial.allowed_areas) ? initial.allowed_areas : [],
    scope_rules: Array.isArray(initial.scope_rules) ? initial.scope_rules : [],
    qualiphy_exam_ids: Array.isArray(initial.qualiphy_exam_ids) ? initial.qualiphy_exam_ids : [],
    protocol_document_urls: Array.isArray(initial.protocol_document_urls) ? initial.protocol_document_urls : [],
    requires_license_types: Array.isArray(initial.requires_license_types) ? initial.requires_license_types : [],
  };
}

async function uploadMdDocument(file) {
  const body = new FormData();
  body.append("file", file);
  const uploaded = await adminApiRequest("/admin/uploads/md-document", { method: "POST", body });
  return uploaded?.url || "";
}

function ServiceEditDialog({ open, onClose, initial, isSaving, onSave, memberships = [] }) {
  const { toast } = useToast();
  const [form, setForm] = useState(() => normalizeServiceForm(initial));
  const [selectedMembershipIds, setSelectedMembershipIds] = useState([]);
  const [activeTab, setActiveTab] = useState("basics");
  const [newArea, setNewArea] = useState("");
  const [newRule, setNewRule] = useState({ rule_name: "", rule_value: "", unit: "", description: "" });
  const [newProtocolName, setNewProtocolName] = useState("");
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadingProtocol, setUploadingProtocol] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(normalizeServiceForm(initial));
    setActiveTab("basics");
    setNewArea("");
    setNewRule({ rule_name: "", rule_value: "", unit: "", description: "" });
    if (initial?.id) {
      setSelectedMembershipIds(
        memberships.filter((m) => (m.included_service_ids || []).includes(initial.id)).map((m) => m.id)
      );
    } else {
      setSelectedMembershipIds([]);
    }
  }, [open, initial]);

  const handleOpen = (isOpen) => {
    if (!isOpen) onClose();
  };

  const applyPreset = () => {
    const preset = CATEGORY_PRESETS[form.category];
    if (preset) setForm((f) => ({ ...f, ...preset }));
  };

  const toggleLicense = (lt) => {
    const cur = form.requires_license_types || [];
    setForm((f) => ({
      ...f,
      requires_license_types: cur.includes(lt) ? cur.filter((x) => x !== lt) : [...cur, lt],
    }));
  };

  const addArea = () => {
    if (!newArea.trim()) return;
    setForm((f) => ({ ...f, allowed_areas: [...(f.allowed_areas || []), newArea.trim()] }));
    setNewArea("");
  };

  const addRule = () => {
    if (!newRule.rule_name.trim()) return;
    setForm((f) => ({ ...f, scope_rules: [...(f.scope_rules || []), { ...newRule }] }));
    setNewRule({ rule_name: "", rule_value: "", unit: "", description: "" });
  };

  const uploadMDContract = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingContract(true);
    try {
      const contractUrl = await uploadMdDocument(file);
      setForm((f) => ({ ...f, md_contract_url: contractUrl }));
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message || "Try again.", variant: "destructive" });
    } finally {
      setUploadingContract(false);
      e.target.value = "";
    }
  };

  const uploadProtocol = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = newProtocolName.trim() || file.name;
    setUploadingProtocol(true);
    try {
      const fileUrl = await uploadMdDocument(file);
      setForm((f) => ({
        ...f,
        protocol_document_urls: [...(f.protocol_document_urls || []), { name, url: fileUrl }],
      }));
      setNewProtocolName("");
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message || "Try again.", variant: "destructive" });
    } finally {
      setUploadingProtocol(false);
      e.target.value = "";
    }
  };

  const catLabel = form.category ? form.category.replace(/_/g, " ") : "";

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>
            {initial?.id ? "Edit Service" : "New Service"}
          </DialogTitle>
          <p className="text-xs text-slate-500">Configure protocols, scope rules, documents, and provider requirements.</p>
        </DialogHeader>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {["basics", "scope", "documents", "agreement", "gfe"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${activeTab === tab ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
            >
              {tab === "basics" ? "Basics" : tab === "scope" ? "Scope" : tab === "documents" ? "Docs" : tab === "agreement" ? "Agreement" : "GFE"}
            </button>
          ))}
        </div>

        <div className="space-y-5 pt-1">
          {activeTab === "basics" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Service Name *</label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Myers Cocktail IV" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Category *</label>
                  <Select value={form.category} onValueChange={(v) => { const p = CATEGORY_PRESETS[v]; setForm((f) => ({ ...f, category: v, ...(p || {}) })); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {CATEGORY_PRESETS[form.category] && (
                <button type="button" onClick={applyPreset} className="w-full flex items-center gap-2 text-xs font-semibold px-3 py-2.5 rounded-lg border border-dashed transition-all hover:bg-amber-50" style={{ borderColor: "#C9A96E", color: "#C9A96E" }}>
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-fill scope, areas and agreement for {catLabel}
                </button>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description shown to providers" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Max Units / Session</label>
                  <Input type="number" value={form.max_units_per_session || ""} onChange={(e) => setForm((f) => ({ ...f, max_units_per_session: parseFloat(e.target.value) || null }))} placeholder="e.g. 50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Supervision Required</label>
                  <div className="relative">
                    <Input type="number" value={form.requires_supervision_months || 0} onChange={(e) => setForm((f) => ({ ...f, requires_supervision_months: parseInt(e.target.value, 10) || 0 }))} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">months</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Who can perform this service?</label>
                <div className="flex flex-wrap gap-2">
                  {LICENSE_TYPES.map((lt) => (
                    <button key={lt} type="button" onClick={() => toggleLicense(lt)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${form.requires_license_types?.includes(lt) ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                      {lt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  Provider Attestation Requirements
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.requires_novi_course || false} onChange={(e) => setForm((f) => ({ ...f, requires_novi_course: e.target.checked }))} className="rounded mt-0.5" />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">NOVI Course certification required</span>
                    <p className="text-xs text-slate-400">Provider must complete a NOVI course to unlock this service</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.allow_external_cert || false} onChange={(e) => setForm((f) => ({ ...f, allow_external_cert: e.target.checked }))} className="rounded mt-0.5" />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">Accept external / prior certification</span>
                    <p className="text-xs text-slate-400">Provider submits a cert from another program — admin reviews and approves</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.requires_additional_provider_cert || false} onChange={(e) => setForm((f) => ({ ...f, requires_additional_provider_cert: e.target.checked }))} className="rounded mt-0.5" />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">Requires additional certificate upload</span>
                    <p className="text-xs text-slate-400">Provider must upload a specific cert verified by admin before this service unlocks</p>
                  </div>
                </label>
                {form.requires_additional_provider_cert && (
                  <div className="ml-7">
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Certificate Label</label>
                    <Input value={form.additional_cert_label || ""} onChange={(e) => setForm((f) => ({ ...f, additional_cert_label: e.target.value }))} placeholder="e.g. IV Therapy Certification" />
                  </div>
                )}
              </div>

              <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 space-y-2">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-green-500" />
                  Attach to Membership Plan(s)
                </p>
                {memberships.length === 0 ? (
                  <p className="text-xs text-amber-600">No membership plans exist yet. Create a membership plan first, then you can attach this service to it.</p>
                ) : (
                  <div className="space-y-1.5">
                    {memberships.map((m) => (
                      <label key={m.id} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedMembershipIds.includes(m.id)}
                          onChange={(e) => setSelectedMembershipIds((prev) => (e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id)))}
                          className="rounded"
                        />
                        <div>
                          <span className="text-sm font-semibold text-slate-800">{m.name}</span>
                          {m.monthly_fee ? <span className="text-xs text-slate-400 ml-1.5">${m.monthly_fee}/mo</span> : null}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                <span className="text-sm text-slate-700">Active (visible to providers)</span>
              </label>
            </>
          )}

          {activeTab === "scope" && (
            <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  Scope rules and allowed treatment areas are configured <strong>per service</strong> (migrated from former tier definitions where applicable).
                  They are enforced on treatment records for this service.
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Allowed Treatment Areas</label>
                <div className="flex gap-2 mb-2">
                  <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Add an area and press Enter" onKeyDown={(e) => e.key === "Enter" && addArea()} />
                  <Button type="button" variant="outline" onClick={addArea}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                  {(form.allowed_areas || []).length === 0 && <p className="text-xs text-slate-400">No areas added yet</p>}
                  {(form.allowed_areas || []).map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {a}
                      <button type="button" onClick={() => setForm((f) => ({ ...f, allowed_areas: f.allowed_areas.filter((x) => x !== a) }))} className="text-slate-400 hover:text-red-500 ml-0.5">x</button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Scope Rules</label>
                <div className="grid grid-cols-4 gap-2 mb-1">
                  <Input value={newRule.rule_name} onChange={(e) => setNewRule((r) => ({ ...r, rule_name: e.target.value }))} placeholder="Rule name" />
                  <Input value={newRule.rule_value} onChange={(e) => setNewRule((r) => ({ ...r, rule_value: e.target.value }))} placeholder="Value" />
                  <Input value={newRule.unit} onChange={(e) => setNewRule((r) => ({ ...r, unit: e.target.value }))} placeholder="Unit" />
                  <Button type="button" variant="outline" onClick={addRule}>Add</Button>
                </div>
                <Input value={newRule.description} onChange={(e) => setNewRule((r) => ({ ...r, description: e.target.value }))} placeholder="Description (optional)" className="mb-2" onKeyDown={(e) => e.key === "Enter" && addRule()} />
                <div className="space-y-1.5">
                  {(form.scope_rules || []).length === 0 && <p className="text-xs text-slate-400">No rules added yet</p>}
                  {(form.scope_rules || []).map((r, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs">
                      <span><strong className="text-slate-700">{r.rule_name}:</strong> <span className="text-slate-600">{r.rule_value} {r.unit}</span></span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, scope_rules: f.scope_rules.filter((_, idx) => idx !== i) }))} className="text-slate-300 hover:text-red-500 ml-2 text-base leading-none">x</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Protocol Notes (internal)</label>
                <textarea className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-slate-400" value={form.protocol_notes} onChange={(e) => setForm((f) => ({ ...f, protocol_notes: e.target.value }))} placeholder="Internal notes on protocols, contraindications, etc." />
              </div>
            </>
          )}

          {activeTab === "documents" && (
            <>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                <div>The MD Contract is shown during onboarding. Protocol documents unlock once coverage is active.</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">MD Contract</label>
                {form.md_contract_url ? (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <a href={form.md_contract_url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline flex-1">View uploaded contract</a>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, md_contract_url: "" }))} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-slate-200 rounded-lg p-4 hover:bg-slate-50 hover:border-slate-300 transition-all">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-500">{uploadingContract ? "Uploading..." : "Click to upload MD Contract (PDF)"}</span>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={uploadMDContract} disabled={uploadingContract} />
                  </label>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Protocol Documents</label>
                <div className="space-y-2 mb-3">
                  {(form.protocol_document_urls || []).length === 0 && <p className="text-xs text-slate-400">No protocol documents uploaded yet</p>}
                  {(form.protocol_document_urls || []).map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2.5">
                      <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm text-purple-700 hover:underline flex-1">{doc.name}</a>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, protocol_document_urls: f.protocol_document_urls.filter((_, idx) => idx !== i) }))} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newProtocolName} onChange={(e) => setNewProtocolName(e.target.value)} placeholder="Document name" className="flex-1" />
                  <label className="flex items-center gap-1.5 cursor-pointer border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingProtocol ? "Uploading..." : "Upload File"}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg" onChange={uploadProtocol} disabled={uploadingProtocol} />
                  </label>
                </div>
              </div>
            </>
          )}

          {activeTab === "agreement" && (
            <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>Optional short summary shown to providers in the Documents tab after signing the MD agreement.</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Short Agreement Summary</label>
                <textarea className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 min-h-[120px] resize-y focus:outline-none focus:ring-1 focus:ring-slate-400" value={form.md_agreement_text} onChange={(e) => setForm((f) => ({ ...f, md_agreement_text: e.target.value }))} placeholder="Short summary shown to providers after signing. Leave blank to omit." />
              </div>
            </>
          )}

          {activeTab === "gfe" && (
            <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
                <Video className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  Good Faith Exam (GFE) via Qualiphy is configured <strong>per service</strong> — not on membership plans.
                  Providers must send a GFE invite before treating when this service requires it.
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.requires_gfe || false} onChange={(e) => setForm((f) => ({ ...f, requires_gfe: e.target.checked }))} className="rounded" />
                <span className="text-sm font-semibold text-slate-700">This service requires a Qualiphy GFE before treatment</span>
              </label>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Qualiphy Exam IDs (comma-separated)</label>
                <Input
                  value={(form.qualiphy_exam_ids || []).join(", ")}
                  onChange={(e) => {
                    const ids = e.target.value.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
                    setForm((f) => ({ ...f, qualiphy_exam_ids: ids }));
                  }}
                  placeholder="e.g. 123, 456, 789"
                />
                {(form.qualiphy_exam_ids || []).length === 0 && (
                  <p className="text-xs mt-1.5 text-amber-600">No exam IDs set — GFE sending will fail without these.</p>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave({ ...form, is_membership: false }, selectedMembershipIds)} disabled={!form.name || isSaving} style={{ background: "#C8E63C", color: "#1a2540" }}>
              {isSaving ? "Saving..." : initial?.id ? "Save Changes" : "Create Service"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MembershipEditDialog({ open, onClose, initial, allServices, catalog = [], isSaving, onSave, onCreateService }) {
  const [form, setForm] = useState(initial || { ...EMPTY_FORM, is_membership: true });

  useEffect(() => {
    if (open) setForm(initial || { ...EMPTY_FORM, is_membership: true });
  }, [open, initial]);

  const handleOpen = (isOpen) => {
    if (!isOpen) onClose();
  };

  const includedSvcs = allServices.filter((s) => (form.included_service_ids || []).includes(s.id));
  const available = allServices.filter((s) => s.is_membership !== true && !(form.included_service_ids || []).includes(s.id));

  const toggleService = (id) => {
    const cur = form.included_service_ids || [];
    setForm((f) => ({
      ...f,
      included_service_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>
            {initial?.id ? "Edit Membership Plan" : "New Membership Plan"}
          </DialogTitle>
          <p className="text-xs text-slate-500">Configure the membership name, price, and which services are included.</p>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Membership Name *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. IV Therapy Membership" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of this membership" />
          </div>

          <div className="rounded-lg px-3 py-2.5 text-xs" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
            <p className="font-semibold" style={{ color: "#4a6b10" }}>Pricing is managed at the platform level</p>
            <p className="mt-0.5" style={{ color: "#5a7a20" }}>First membership: <strong>$279/mo</strong> · Each additional membership: <strong>$129/mo</strong></p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600">Services included in this membership</label>
              <button type="button" onClick={onCreateService} className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Create new service
              </button>
            </div>

            {includedSvcs.length > 0 && (
              <div className="space-y-2 mb-3">
                {includedSvcs.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{serviceDisplayName(svc, catalog)}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-xs text-slate-500 capitalize">{svc.category?.replace(/_/g, " ")}</span>
                          <ServiceBadges svc={svc} />
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => toggleService(svc.id)} className="text-slate-300 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {available.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Add an existing service to this membership:</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {available.map((svc) => (
                    <button key={svc.id} type="button" onClick={() => toggleService(svc.id)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{serviceDisplayName(svc, catalog)}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-xs text-slate-400 capitalize">{svc.category?.replace(/_/g, " ")}</span>
                          <ServiceBadges svc={svc} />
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {available.length === 0 && includedSvcs.length === 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                No services exist yet. Create services first, then add them here.
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700">Active (visible to providers)</span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave({ ...form, is_membership: true, requires_gfe: false, qualiphy_exam_ids: [], allowed_areas: [], scope_rules: [], max_units_per_session: null })} disabled={!form.name || isSaving} style={{ background: "#C8E63C", color: "#1a2540" }}>
              {isSaving ? "Saving..." : initial?.id ? "Save Changes" : "Create Membership"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminServiceTypes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [membershipDlg, setMembershipDlg] = useState({ open: false, editing: null });
  const [serviceDlg, setServiceDlg] = useState({ open: false, editing: null });
  const [expandedId, setExpandedId] = useState(null);
  const [isSavingService, setIsSavingService] = useState(false);

  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.list(),
    staleTime: 0,
    refetchOnMount: true,
  });

  const memberships = allRecords.filter((r) => isMembershipPlan(r, allRecords));
  const services = allRecords.filter((r) => !isMembershipPlan(r, allRecords));

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (data.id) return base44.entities.ServiceType.update(data.id, data);
      return base44.entities.ServiceType.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-types"] });
      setMembershipDlg({ open: false, editing: null });
      setServiceDlg({ open: false, editing: null });
    },
    onError: (err) => {
      toast({ title: "Save failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const handleServiceSave = async (serviceData, selectedMembershipIds) => {
    setIsSavingService(true);
    try {
      let saved;
      if (serviceData.id) {
        saved = await base44.entities.ServiceType.update(serviceData.id, { ...serviceData, is_membership: false });
      } else {
        saved = await base44.entities.ServiceType.create({ ...serviceData, is_membership: false });
      }
      const savedId = saved.id || serviceData.id;

      const updatePromises = allRecords
        .filter((r) => isMembershipPlan(r, allRecords))
        .map((m) => {
          const wasIncluded = (m.included_service_ids || []).includes(savedId);
          const shouldInclude = selectedMembershipIds.includes(m.id);
          if (wasIncluded === shouldInclude) return null;
          const newIds = shouldInclude
            ? [...(m.included_service_ids || []), savedId]
            : (m.included_service_ids || []).filter((x) => x !== savedId);
          return base44.entities.ServiceType.update(m.id, { included_service_ids: newIds });
        })
        .filter(Boolean);

      await Promise.all(updatePromises);
      queryClient.invalidateQueries({ queryKey: ["service-types"] });
      setServiceDlg({ open: false, editing: null });
      toast({ title: serviceData.id ? "Service updated" : "Service created" });
    } catch (err) {
      toast({ title: "Save failed", description: err?.message || "Try again.", variant: "destructive" });
    } finally {
      setIsSavingService(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ServiceType.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-types"] }),
    onError: (err) => {
      toast({ title: "Delete failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const membershipServices = (m) => {
    const ids = new Set(m.included_service_ids || []);
    return allRecords.filter((s) => ids.has(s.id));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", fontStyle: "italic" }}>
            Membership Configuration
          </h2>
          <p className="text-slate-500 text-sm mt-1">Create membership plans and manage the services included in each one</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setServiceDlg({ open: true, editing: null })}>
            <Package className="w-4 h-4 mr-1" /> New Service
          </Button>
          <Button onClick={() => setMembershipDlg({ open: true, editing: null })} style={{ background: "#C8E63C", color: "#1a2540" }}>
            <Layers className="w-4 h-4 mr-1" /> New Membership
          </Button>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.3)" }}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4" style={{ color: "#5a7a20" }} />
          <strong className="text-sm" style={{ color: "#4a6b10" }}>Membership Pricing</strong>
        </div>
        <div className="flex gap-4 mb-2 flex-wrap">
          <div className="rounded-xl px-4 py-2.5" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(200,230,60,0.4)" }}>
            <p className="font-bold text-sm" style={{ color: "#1e2535" }}>$279/mo</p>
            <p className="text-xs mt-0.5" style={{ color: "#5a7a20" }}>Base membership (1st)</p>
          </div>
          <div className="flex items-center text-slate-400 font-bold text-lg">+</div>
          <div className="rounded-xl px-4 py-2.5" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(200,230,60,0.3)" }}>
            <p className="font-bold text-sm" style={{ color: "#1e2535" }}>$129/mo</p>
            <p className="text-xs mt-0.5" style={{ color: "#5a7a20" }}>Per add-on membership</p>
          </div>
        </div>
        <p className="text-xs" style={{ color: "#5a7a20" }}>Providers pay $279 for their first membership category, then $129 for each additional one they add. Capped at 5 total.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <>
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>
              Membership Plans ({memberships.length})
            </p>
            {memberships.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center">
                <Layers className="w-8 h-8 mx-auto text-slate-200 mb-2" />
                <p className="text-slate-400 text-sm">No membership plans yet.</p>
                <button type="button" onClick={() => setMembershipDlg({ open: true, editing: null })} className="text-xs font-semibold text-blue-500 mt-1 hover:underline">
                  Create your first membership
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {memberships.map((m) => {
                  const includedSvcs = membershipServices(m);
                  const isExpanded = expandedId === m.id;
                  return (
                    <div key={m.id} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.09)" }}>
                      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}>
                            <Layers className="w-5 h-5" style={{ color: "#5a7a20" }} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-slate-900">{m.name}</p>
                              <Badge className={m.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>{m.is_active ? "Active" : "Inactive"}</Badge>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {includedSvcs.length} service{includedSvcs.length !== 1 ? "s" : ""} included
                              {includedSvcs.length > 0 && ` — ${includedSvcs.map((s) => serviceDisplayName(s, allRecords)).join(", ")}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setMembershipDlg({ open: true, editing: m }); }}>
                            <Pencil className="w-4 h-4 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(m.id); }}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ borderTop: "1px solid rgba(30,37,53,0.07)" }}>
                          <div className="px-4 py-3 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.38)" }}>Services in this membership</p>
                            <button type="button" onClick={() => setServiceDlg({ open: true, editing: null })} className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1">
                              <Plus className="w-3 h-3" /> New service
                            </button>
                          </div>
                          {includedSvcs.length === 0 ? (
                            <p className="px-4 pb-4 text-xs text-slate-400">
                              No services in this membership yet. Edit the membership to add services.
                            </p>
                          ) : (
                            <div className="px-4 pb-4 space-y-2">
                              {includedSvcs.map((svc) => (
                                <div key={svc.id} className="flex items-center justify-between rounded-xl px-3 py-3" style={{ background: "rgba(30,37,53,0.03)", border: "1px solid rgba(30,37,53,0.07)" }}>
                                  <div className="flex items-center gap-3">
                                    <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-semibold text-slate-800">{serviceDisplayName(svc, allRecords)}</p>
                                        <Badge variant="outline" className="text-xs capitalize">{svc.category?.replace(/_/g, " ")}</Badge>
                                        <ServiceBadges svc={svc} />
                                      </div>
                                      <p className="text-xs text-slate-400 mt-0.5">
                                        {svc.scope_rules?.length || 0} scope rules · {svc.allowed_areas?.length || 0} areas
                                      </p>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => setServiceDlg({ open: true, editing: svc })}>
                                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>
              All Services ({services.length})
            </p>
            {services.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 py-8 text-center">
                <Package className="w-7 h-7 mx-auto text-slate-200 mb-2" />
                <p className="text-slate-400 text-sm">No services yet.</p>
                <button type="button" onClick={() => setServiceDlg({ open: true, editing: null })} className="text-xs font-semibold text-blue-500 mt-1 hover:underline">Create your first service</button>
              </div>
            ) : (
              <div className="space-y-2">
                {services.map((svc) => (
                    <div key={svc.id} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.08)" }}>
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800">{serviceDisplayName(svc, allRecords)}</p>
                            <Badge className={svc.is_active ? "bg-green-100 text-green-700 text-xs" : "bg-slate-100 text-slate-400 text-xs"}>{svc.is_active ? "Active" : "Inactive"}</Badge>
                            <Badge variant="outline" className="text-xs capitalize">{svc.category?.replace(/_/g, " ")}</Badge>
                            <ServiceBadges svc={svc} />
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{serviceMetaLine(svc)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setServiceDlg({ open: true, editing: svc })}>
                          <Pencil className="w-4 h-4 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(svc.id)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <MembershipEditDialog
        open={membershipDlg.open}
        onClose={() => setMembershipDlg({ open: false, editing: null })}
        initial={membershipDlg.editing}
        catalog={allRecords}
        allServices={allRecords.filter((r) => !isMembershipPlan(r, allRecords))}
        isSaving={saveMutation.isPending}
        onSave={(data) => saveMutation.mutate(data)}
        onCreateService={() => { setMembershipDlg((d) => ({ ...d, open: false })); setServiceDlg({ open: true, editing: null }); }}
      />

      <ServiceEditDialog
        open={serviceDlg.open}
        onClose={() => setServiceDlg({ open: false, editing: null })}
        initial={serviceDlg.editing}
        isSaving={isSavingService || saveMutation.isPending}
        onSave={handleServiceSave}
        memberships={memberships}
      />
    </div>
  );
}
