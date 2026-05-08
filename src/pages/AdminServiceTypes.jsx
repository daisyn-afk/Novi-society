import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminApiRequest } from "@/api/adminApiRequest";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, ShieldCheck, Upload, FileText, X, Sparkles, Video, Award, Users, CreditCard, Stethoscope, ChevronRight, Info } from "lucide-react";

const CATEGORIES = ["injectables", "fillers", "laser", "skincare", "body_contouring", "prp", "other"];
const LICENSE_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician"];

// Auto-fill presets by category
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
    md_agreement_text: "By signing below, I acknowledge that I have completed the required NOVI training for neurotoxin injections, agree to operate within the approved scope of practice, follow all protocol guidelines, and accept ongoing medical director supervision as required by my state's regulations.",
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
    allowed_areas: ["Full Face", "Neck", "Décolletage", "Arms", "Legs", "Back"],
    scope_rules: [
      { rule_name: "Fitzpatrick Scale Max", rule_value: "IV", unit: "", description: "Consult MD for Fitzpatrick V-VI" },
      { rule_name: "Test Spot Required", rule_value: "Yes", unit: "", description: "For first treatment or new parameters" },
    ],
    protocol_notes: "Laser treatments require proper skin typing and test spots. Document Fitzpatrick scale, settings used, and patient response.",
    md_agreement_text: "By signing below, I acknowledge that I have completed the required NOVI training for laser treatments, agree to perform proper skin typing and test spots, and accept ongoing medical director supervision.",
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
    protocol_notes: "PRP requires sterile technique and proper centrifuge protocol. Document blood draw volume and platelet concentration when available.",
    md_agreement_text: "By signing below, I acknowledge that I have completed the required NOVI training for PRP procedures, agree to follow sterile technique protocols, and accept ongoing medical director supervision.",
  },
  skincare: {
    requires_license_types: ["RN", "NP", "PA", "MD", "DO", "esthetician"],
    requires_supervision_months: 0,
    max_units_per_session: null,
    allowed_areas: ["Full Face", "Neck", "Back", "Hands"],
    scope_rules: [],
    protocol_notes: "Document products used and patient skin type. Follow contraindication guidelines for active skin conditions.",
    md_agreement_text: "By signing below, I acknowledge that I have completed the required NOVI training for skincare services and agree to follow all protocol guidelines.",
  },
};

const EMPTY_SERVICE = {
  name: "", category: "injectables", description: "", is_active: true,
  requires_novi_course: true, requires_license_types: [], requires_supervision_months: 0,
  allowed_areas: [], max_units_per_session: null, protocol_notes: "", md_agreement_text: "",
  md_contract_url: "", platform_agreement_text: "", protocol_document_urls: [], scope_rules: [], coverage_tiers: [],
  requires_gfe: false, qualiphy_exam_ids: [], growth_studio_text: "", supplier_accounts_text: "",
};

const EMPTY_TIER = {
  tier_number: 1, tier_name: "", description: "", linked_course_ids: [],
  allowed_areas: [], max_units_per_session: null, scope_rules: [], protocol_document_urls: [],
};

export default function AdminServiceTypes() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [expandedId, setExpandedId] = useState(null);
  const [newArea, setNewArea] = useState("");
  const [newRule, setNewRule] = useState({ rule_name: "", rule_value: "", unit: "", description: "" });
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadingProtocol, setUploadingProtocol] = useState(false);
  const [newProtocolName, setNewProtocolName] = useState("");
  const [activeTab, setActiveTab] = useState("basics");
  const [editingTier, setEditingTier] = useState(null); // null = list, number = editing tier index
  const [tierForm, setTierForm] = useState(EMPTY_TIER);
  const [tierNewArea, setTierNewArea] = useState("");
  const [tierNewRule, setTierNewRule] = useState({ rule_name: "", rule_value: "", unit: "" });
  const [uploadError, setUploadError] = useState("");

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) return base44.entities.ServiceType.update(editing.id, data);
      return base44.entities.ServiceType.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["service-types"] }); setOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ServiceType.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-types"] }),
  });

  const openNew = () => { setEditing(null); setForm(EMPTY_SERVICE); setActiveTab("basics"); setEditingTier(null); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s, protocol_document_urls: s.protocol_document_urls || [], md_contract_url: s.md_contract_url || "", coverage_tiers: s.coverage_tiers || [] }); setActiveTab("basics"); setEditingTier(null); setOpen(true); };

  const applyPreset = () => {
    const preset = CATEGORY_PRESETS[form.category];
    if (!preset) return;
    setForm(f => ({ ...f, ...preset }));
  };

  const handleCategoryChange = (v) => {
    const preset = CATEGORY_PRESETS[v];
    setForm(f => ({ ...f, category: v, ...(preset || {}) }));
  };

  const toggleLicense = (lt) => {
    const cur = form.requires_license_types || [];
    setForm(f => ({ ...f, requires_license_types: cur.includes(lt) ? cur.filter(x => x !== lt) : [...cur, lt] }));
  };

  const addArea = () => {
    if (!newArea.trim()) return;
    setForm(f => ({ ...f, allowed_areas: [...(f.allowed_areas || []), newArea.trim()] }));
    setNewArea("");
  };
  const removeArea = (area) => setForm(f => ({ ...f, allowed_areas: f.allowed_areas.filter(a => a !== area) }));

  const addRule = () => {
    if (!newRule.rule_name.trim()) return;
    setForm(f => ({ ...f, scope_rules: [...(f.scope_rules || []), { ...newRule }] }));
    setNewRule({ rule_name: "", rule_value: "", unit: "", description: "" });
  };
  const removeRule = (i) => setForm(f => ({ ...f, scope_rules: f.scope_rules.filter((_, idx) => idx !== i) }));

  const uploadMDContract = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingContract(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const uploaded = await adminApiRequest("/admin/uploads/md-document", {
        method: "POST",
        body
      });
      setForm(f => ({ ...f, md_contract_url: uploaded?.url || "" }));
    } catch (error) {
      setUploadError(error?.message || "Failed to upload MD contract.");
    } finally {
      setUploadingContract(false);
      e.target.value = "";
    }
  };

  const uploadProtocol = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = newProtocolName.trim() || file.name;
    setUploadingProtocol(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const uploaded = await adminApiRequest("/admin/uploads/md-document", {
        method: "POST",
        body
      });
      setForm(f => ({
        ...f,
        protocol_document_urls: [...(f.protocol_document_urls || []), { name, url: uploaded?.url || "" }]
      }));
      setNewProtocolName("");
    } catch (error) {
      setUploadError(error?.message || "Failed to upload protocol document.");
    } finally {
      setUploadingProtocol(false);
      e.target.value = "";
    }
  };

  const removeProtocol = (i) => setForm(f => ({ ...f, protocol_document_urls: f.protocol_document_urls.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Service Types & Scopes</h2>
          <p className="text-slate-500 text-sm mt-1">Manage MD-covered services, protocols, and scope rules</p>
        </div>
        <Button onClick={openNew} style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>
          <Plus className="w-4 h-4 mr-1" /> New Service Type
        </Button>
      </div>

      {/* Pricing note */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 text-sm text-amber-800">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <strong>Membership Pricing Breakdown</strong>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          {[
            { label: "1 Service (Injectables Only)", price: "$279/mo" },
            { label: "2 Services", price: "$408/mo" },
            { label: "3 Services", price: "$537/mo" },
            { label: "4 Services", price: "$666/mo" },
            { label: "5 Services (Max Cap)", price: "$795/mo" },
          ].map(({ label, price }) => (
            <div key={label} className="bg-white/70 rounded-lg px-3 py-2 text-center border border-amber-200">
              <p className="font-bold text-amber-900 text-base">{price}</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-amber-700">Membership is <strong>capped at five services</strong>. Once a provider reaches five services, they are fully covered for all services within their scope — no additional fees beyond this level.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400">No service types yet. Add your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {services.map(s => (
            <Card key={s.id} className="overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <Badge className={s.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                        {s.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">{s.category?.replace("_", " ")}</Badge>
                      {s.md_contract_url && <Badge className="bg-blue-100 text-blue-700 text-xs">MD Contract ✓</Badge>}
                      {s.requires_gfe && <Badge className="bg-green-100 text-green-700 text-xs">GFE Required</Badge>}
                      {s.protocol_document_urls?.length > 0 && <Badge className="bg-purple-100 text-purple-700 text-xs">{s.protocol_document_urls.length} Protocol{s.protocol_document_urls.length > 1 ? "s" : ""}</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.scope_rules?.length || 0} scope rules · {s.allowed_areas?.length || 0} areas · {s.requires_license_types?.join(", ") || "Any license"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEdit(s); }}>
                    <Pencil className="w-4 h-4 text-slate-500" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); deleteMutation.mutate(s.id); }}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                  {expandedId === s.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>
              {expandedId === s.id && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 grid sm:grid-cols-2 gap-4 bg-slate-50">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Scope Rules</p>
                    {s.scope_rules?.length > 0 ? (
                      <div className="space-y-1">
                        {s.scope_rules.map((r, i) => (
                          <div key={i} className="text-xs bg-white border border-slate-100 rounded-lg px-3 py-2">
                            <span className="font-semibold text-slate-700">{r.rule_name}:</span>{" "}
                            <span className="text-slate-600">{r.rule_value} {r.unit}</span>
                            {r.description && <p className="text-slate-400 mt-0.5">{r.description}</p>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-slate-400">No rules defined</p>}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Allowed Areas</p>
                      <div className="flex flex-wrap gap-1">
                        {s.allowed_areas?.length > 0 ? s.allowed_areas.map(a => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>) : <p className="text-xs text-slate-400">None defined</p>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Required Licenses</p>
                      <div className="flex flex-wrap gap-1">
                        {s.requires_license_types?.length > 0 ? s.requires_license_types.map(l => <Badge key={l} className="bg-blue-100 text-blue-700 text-xs">{l}</Badge>) : <p className="text-xs text-slate-400">Any</p>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Documents</p>
                      <div className="space-y-1">
                        {s.md_contract_url && (
                          <a href={s.md_contract_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                            <FileText className="w-3 h-3" /> MD Contract
                          </a>
                        )}
                        {s.protocol_document_urls?.map((doc, i) => (
                          <a key={i} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-purple-600 hover:underline">
                            <FileText className="w-3 h-3" /> {doc.name}
                          </a>
                        ))}
                        {!s.md_contract_url && !s.protocol_document_urls?.length && <p className="text-xs text-slate-400">No documents uploaded</p>}
                      </div>
                    </div>
                  </div>
                  {s.protocol_notes && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Protocol Notes</p>
                      <p className="text-xs text-slate-600">{s.protocol_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl" style={{ fontFamily: "'DM Serif Display', serif" }}>
              {editing ? `Edit: ${editing.name}` : "New Service Type"}
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">This service type is the source of truth for memberships, certifications, treatments, and patient-provider flows.</p>
          </DialogHeader>

          {/* System connection banner */}
          <div className="flex items-center gap-0 text-xs mb-1">
            {[
              { icon: Award, label: "Certification", color: "#d97706" },
              { icon: CreditCard, label: "Membership", color: "#7B8EC8" },
              { icon: Stethoscope, label: "Treatment Record", color: "#2D6B7F" },
              { icon: Users, label: "Patient Booking", color: "#16a34a" },
            ].map(({ icon: Icon, label, color }, i) => (
              <div key={label} className="flex items-center">
                <div className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: `${color}10` }}>
                  <Icon className="w-3 h-3" style={{ color }} />
                  <span className="font-semibold" style={{ color }}>{label}</span>
                </div>
                {i < 3 && <ChevronRight className="w-3 h-3 text-slate-300 mx-0.5" />}
              </div>
            ))}
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-2 flex-wrap">
            {["basics", "scope", "tiers", "documents", "agreement", "gfe"].map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setEditingTier(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${activeTab === tab ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
                {tab === "basics" ? "Basics" : tab === "scope" ? "Scope & Areas" : tab === "tiers" ? `Tiers (${form.coverage_tiers?.length || 0})` : tab === "documents" ? "Documents" : tab === "agreement" ? "MD Agreement" : "GFE"}
              </button>
            ))}
          </div>

          <div className="space-y-5 pt-1">

            {/* ── BASICS TAB ── */}
            {activeTab === "basics" && <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Service Name *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Botox / Neurotoxin" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Category *</label>
                  <Select value={form.category} onValueChange={handleCategoryChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {CATEGORY_PRESETS[form.category] && (
                <button onClick={applyPreset}
                  className="w-full flex items-center gap-2 text-xs font-semibold px-3 py-2.5 rounded-lg border border-dashed transition-all hover:bg-amber-50"
                  style={{ borderColor: "var(--novi-gold)", color: "var(--novi-gold)" }}>
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-fill scope, areas & agreement for "{form.category.replace("_", " ")}" — edit as needed
                </button>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Description <span className="font-normal text-slate-400">(shown to providers on their dashboard)</span></label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of this service" />
              </div>

              {/* Monthly fee + clinical fields */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Monthly Membership Fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <Input type="number" className="pl-6" value={form.monthly_fee || ""} onChange={e => setForm(f => ({ ...f, monthly_fee: parseFloat(e.target.value) || null }))} placeholder="279" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Counts toward the $795/mo cap</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Max Units/Session</label>
                  <Input type="number" value={form.max_units_per_session || ""} onChange={e => setForm(f => ({ ...f, max_units_per_session: parseFloat(e.target.value) || null }))} placeholder="e.g. 50" />
                  <p className="text-xs text-slate-400 mt-1">Enforced on treatment records</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Supervision Required</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      className="pr-16"
                      value={form.requires_supervision_months || 0}
                      onChange={e => setForm(f => ({ ...f, requires_supervision_months: parseInt(e.target.value, 10) || 0 }))}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">months</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Who can perform this service? <span className="font-normal text-slate-400">(Required License Types)</span></label>
                <div className="flex flex-wrap gap-2">
                  {LICENSE_TYPES.map(lt => (
                    <button key={lt} onClick={() => toggleLicense(lt)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${form.requires_license_types?.includes(lt) ? "border-[#C9A96E] bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                      {lt}
                    </button>
                  ))}
                </div>
              </div>

              {/* What this unlocks */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> What activating this service does for a provider:</p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2"><Award className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" /> <span>Requires them to hold a <strong>certification</strong> tied to this service type (via NOVI course or external cert approval)</span></li>
                  <li className="flex items-start gap-2"><CreditCard className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" /> <span>Adds a <strong>monthly membership fee</strong> to their MD Board subscription (auto-capped at 5 services)</span></li>
                  <li className="flex items-start gap-2"><Stethoscope className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" /> <span>Unlocks this service on their <strong>treatment records</strong> and booking profile</span></li>
                  <li className="flex items-start gap-2"><Users className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" /> <span>Makes the provider <strong>discoverable by patients</strong> searching for this service</span></li>
                </ul>
              </div>

              {/* Certification unlock rules */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-bold text-slate-700">How can a provider unlock this service?</p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.requires_novi_course || false} onChange={e => setForm(f => ({ ...f, requires_novi_course: e.target.checked }))} className="rounded mt-0.5" />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">NOVI Course certification</span>
                    <p className="text-xs text-slate-400">Provider must complete a NOVI-run course that awards a cert for this service type</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.allow_external_cert || false} onChange={e => setForm(f => ({ ...f, allow_external_cert: e.target.checked }))} className="rounded mt-0.5" />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">External / prior certification</span>
                    <p className="text-xs text-slate-400">Provider can submit a cert from another school or training program — admin reviews and approves it</p>
                  </div>
                </label>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                <span className="text-sm text-slate-700">Active <span className="text-slate-400 font-normal">(visible to providers)</span></span>
              </label>
            </>}

            {/* ── SCOPE & AREAS TAB ── */}
            {activeTab === "scope" && <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>Scope rules and allowed areas are enforced on <strong>treatment records</strong>. When a provider submits a treatment, the MD reviewer sees these limits to ensure compliance.</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Allowed Treatment Areas <span className="font-normal text-slate-400">(enforced on treatment records)</span></label>
                <div className="flex gap-2 mb-2">
                  <Input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="Type an area and press Enter or Add" onKeyDown={e => e.key === "Enter" && addArea()} />
                  <Button type="button" variant="outline" onClick={addArea}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                  {form.allowed_areas?.length === 0 && <p className="text-xs text-slate-400">No areas added yet</p>}
                  {form.allowed_areas?.map(a => (
                    <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {a}
                      <button onClick={() => removeArea(a)} className="text-slate-400 hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Scope / Protocol Rules <span className="font-normal text-slate-400">(e.g. max units, intervals)</span></label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <Input value={newRule.rule_name} onChange={e => setNewRule(r => ({ ...r, rule_name: e.target.value }))} placeholder="Rule name" />
                  <Input value={newRule.rule_value} onChange={e => setNewRule(r => ({ ...r, rule_value: e.target.value }))} placeholder="Value" />
                  <Input value={newRule.unit} onChange={e => setNewRule(r => ({ ...r, unit: e.target.value }))} placeholder="Unit (units, ml...)" />
                  <Button type="button" variant="outline" onClick={addRule}>Add</Button>
                </div>
                <div className="space-y-1.5 min-h-[32px]">
                  {form.scope_rules?.length === 0 && <p className="text-xs text-slate-400">No rules added yet</p>}
                  {form.scope_rules?.map((r, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs">
                      <span><strong className="text-slate-700">{r.rule_name}:</strong> <span className="text-slate-600">{r.rule_value} {r.unit}</span></span>
                      <button onClick={() => removeRule(i)} className="text-slate-300 hover:text-red-500 ml-2 text-base leading-none">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Protocol Notes <span className="font-normal text-slate-400">(internal — visible to MD reviewers only)</span></label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-slate-400"
                  value={form.protocol_notes}
                  onChange={e => setForm(f => ({ ...f, protocol_notes: e.target.value }))}
                  placeholder="Internal notes on protocols, contraindications, etc."
                />
              </div>
            </>}

            {/* ── COVERAGE TIERS TAB ── */}
            {activeTab === "tiers" && <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Coverage Tiers</strong> — Same monthly membership, expanding scope. A provider on Tier 1 can perform basic areas; completing an advanced course automatically upgrades them to Tier 2 with more areas/units unlocked.
                </div>
              </div>

              {editingTier === null ? (
                <div className="space-y-3">
                  {(form.coverage_tiers || []).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No tiers defined. Add a tier below to enable progressive coverage.</p>
                  )}
                  {(form.coverage_tiers || []).sort((a,b) => a.tier_number - b.tier_number).map((tier, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: "rgba(200,230,60,0.2)", color: "#5a7a20" }}>
                          {tier.tier_number}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-800">{tier.tier_name || `Tier ${tier.tier_number}`}</p>
                          <p className="text-xs text-slate-500 truncate">{tier.allowed_areas?.length || 0} areas · {tier.scope_rules?.length || 0} rules · {tier.linked_course_ids?.length || 0} linked courses</p>
                          {tier.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{tier.description}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => { setTierForm({ ...EMPTY_TIER, ...tier }); setEditingTier(idx); }}>
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setForm(f => ({ ...f, coverage_tiers: f.coverage_tiers.filter((_, i) => i !== idx) }))}>
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => {
                    const nextNum = (form.coverage_tiers?.length || 0) + 1;
                    setTierForm({ ...EMPTY_TIER, tier_number: nextNum });
                    setEditingTier("new");
                  }}>
                    <Plus className="w-4 h-4 mr-1" /> Add Coverage Tier
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingTier(null)} className="text-xs text-slate-500 hover:text-slate-700 underline">← Back to tiers</button>
                    <span className="text-xs text-slate-400">/ {editingTier === "new" ? "New Tier" : `Tier ${tierForm.tier_number}`}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Tier Number</label>
                      <Input type="number" value={tierForm.tier_number} onChange={e => setTierForm(f => ({ ...f, tier_number: parseInt(e.target.value) || 1 }))} min={1} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Tier Name</label>
                      <Input value={tierForm.tier_name} onChange={e => setTierForm(f => ({ ...f, tier_name: e.target.value }))} placeholder="e.g. Level 1 — Foundations" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
                      <Input value={tierForm.description} onChange={e => setTierForm(f => ({ ...f, description: e.target.value }))} placeholder="What can providers do at this tier?" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Max Units/Session</label>
                      <Input type="number" value={tierForm.max_units_per_session || ""} onChange={e => setTierForm(f => ({ ...f, max_units_per_session: parseFloat(e.target.value) || null }))} placeholder="e.g. 40" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Allowed Areas for this Tier</label>
                    <div className="flex gap-2 mb-2">
                      <Input value={tierNewArea} onChange={e => setTierNewArea(e.target.value)} placeholder="Add an area" onKeyDown={e => { if (e.key === "Enter") { if (tierNewArea.trim()) { setTierForm(f => ({ ...f, allowed_areas: [...(f.allowed_areas||[]), tierNewArea.trim()] })); setTierNewArea(""); } } }} />
                      <Button type="button" variant="outline" onClick={() => { if (tierNewArea.trim()) { setTierForm(f => ({ ...f, allowed_areas: [...(f.allowed_areas||[]), tierNewArea.trim()] })); setTierNewArea(""); } }}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(tierForm.allowed_areas || []).map(a => (
                        <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {a}
                          <button onClick={() => setTierForm(f => ({ ...f, allowed_areas: f.allowed_areas.filter(x => x !== a) }))} className="text-slate-400 hover:text-red-500 ml-0.5">×</button>
                        </span>
                      ))}
                      {(tierForm.allowed_areas || []).length === 0 && <p className="text-xs text-slate-400">No areas added</p>}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Scope Rules for this Tier</label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <Input value={tierNewRule.rule_name} onChange={e => setTierNewRule(r => ({ ...r, rule_name: e.target.value }))} placeholder="Rule name" />
                      <Input value={tierNewRule.rule_value} onChange={e => setTierNewRule(r => ({ ...r, rule_value: e.target.value }))} placeholder="Value + unit" />
                      <Button type="button" variant="outline" onClick={() => { if (tierNewRule.rule_name.trim()) { setTierForm(f => ({ ...f, scope_rules: [...(f.scope_rules||[]), { ...tierNewRule }] })); setTierNewRule({ rule_name: "", rule_value: "", unit: "" }); } }}>Add</Button>
                    </div>
                    <div className="space-y-1">
                      {(tierForm.scope_rules || []).map((r, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs">
                          <span><strong className="text-slate-700">{r.rule_name}:</strong> <span className="text-slate-600">{r.rule_value} {r.unit}</span></span>
                          <button onClick={() => setTierForm(f => ({ ...f, scope_rules: f.scope_rules.filter((_, idx) => idx !== i) }))} className="text-slate-300 hover:text-red-500 ml-2 text-base">×</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Linked Course IDs <span className="font-normal text-slate-400">(completing any of these upgrades provider to this tier)</span></label>
                    <p className="text-xs text-slate-400 mb-1">Paste course IDs separated by commas. Find them in Admin → Courses.</p>
                    <Input
                      value={(tierForm.linked_course_ids || []).join(", ")}
                      onChange={e => setTierForm(f => ({ ...f, linked_course_ids: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                      placeholder="course_id_1, course_id_2"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" onClick={() => setEditingTier(null)} className="flex-1">Cancel</Button>
                    <Button
                      className="flex-1"
                      style={{ background: "#C8E63C", color: "#1a2540" }}
                      onClick={() => {
                        const tiers = [...(form.coverage_tiers || [])];
                        if (editingTier === "new") {
                          tiers.push({ ...tierForm });
                        } else {
                          tiers[editingTier] = { ...tierForm };
                        }
                        setForm(f => ({ ...f, coverage_tiers: tiers }));
                        setEditingTier(null);
                      }}
                    >
                      Save Tier
                    </Button>
                  </div>
                </div>
              )}
            </>}

            {/* ── DOCUMENTS TAB ── */}
            {activeTab === "documents" && <>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                <div>The <strong>MD Contract</strong> is shown to providers during onboarding when they sign up for this service. <strong>Protocol documents</strong> are unlocked for providers once their coverage is active.</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">MD Contract <span className="font-normal text-slate-400">(signed by providers during class day onboarding)</span></label>
                {form.md_contract_url ? (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <a href={form.md_contract_url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline flex-1">View uploaded contract</a>
                    <button onClick={() => setForm(f => ({ ...f, md_contract_url: "" }))} className="text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
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
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Protocol Documents <span className="font-normal text-slate-400">(visible to providers after coverage is active)</span></label>
                <div className="space-y-2 mb-3">
                  {form.protocol_document_urls?.length === 0 && <p className="text-xs text-slate-400">No protocol documents uploaded yet</p>}
                  {form.protocol_document_urls?.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2.5">
                      <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm text-purple-700 hover:underline flex-1">{doc.name}</a>
                      <button onClick={() => removeProtocol(i)} className="text-slate-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newProtocolName} onChange={e => setNewProtocolName(e.target.value)} placeholder="Document name (e.g. Botox Protocol 2024)" className="flex-1" />
                  <label className="flex items-center gap-1.5 cursor-pointer border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingProtocol ? "Uploading..." : "Upload File"}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg" onChange={uploadProtocol} disabled={uploadingProtocol} />
                  </label>
                </div>
                {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
              </div>
            </>}

            {/* ── AGREEMENT TAB ── */}
            {activeTab === "agreement" && <>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                <div>This text is shown to the provider on <strong>class day</strong> when they sign the MD Board agreement for this service. It appears alongside the MD Contract PDF above.</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">MD Agreement Text</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 min-h-[220px] resize-y focus:outline-none focus:ring-1 focus:ring-slate-400"
                  value={form.md_agreement_text}
                  onChange={e => setForm(f => ({ ...f, md_agreement_text: e.target.value }))}
                  placeholder="Enter the legal agreement text providers must sign..."
                />
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500">
                💡 Keep this concise — providers will also review the full contract PDF in the Documents tab.
              </div>
            </>}

            {/* ── GFE TAB ── */}
            {activeTab === "gfe" && <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
                <Video className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Good Faith Exam (GFE) via Qualiphy</strong> — When enabled, providers must send a GFE invite to patients before the appointment. The result (Approved / Deferred) is tracked on the appointment and treatment record for MD review.
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requires_gfe || false}
                    onChange={e => setForm(f => ({ ...f, requires_gfe: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm font-semibold text-slate-700">GFE Required before patient can be treated</span>
                </label>
              </div>

              {form.requires_gfe && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Qualiphy Exam IDs</label>
                    <p className="text-xs text-slate-400 mb-2">
                      Enter the Qualiphy exam IDs for this service (comma-separated). Find these in your Qualiphy dashboard under Exam List.
                    </p>
                    <Input
                      value={(form.qualiphy_exam_ids || []).join(", ")}
                      onChange={e => {
                        const ids = e.target.value.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                        setForm(f => ({ ...f, qualiphy_exam_ids: ids }));
                      }}
                      placeholder="e.g. 123, 456, 789"
                    />
                    {(form.qualiphy_exam_ids || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.qualiphy_exam_ids.map((id, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            Exam ID: {id}
                            <button onClick={() => setForm(f => ({ ...f, qualiphy_exam_ids: f.qualiphy_exam_ids.filter((_, idx) => idx !== i) }))} className="text-blue-300 hover:text-red-500 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
                    <strong>Setup reminder:</strong> Make sure your <code className="bg-amber-100 px-1 rounded">QUALIPHY_API_KEY</code> is set in environment variables and your webhook URL points to your <code className="bg-amber-100 px-1 rounded">qualiphyWebhook</code> function.
                  </div>
                </div>
              )}
            </>}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending} style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>
                {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Create Service Type"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}