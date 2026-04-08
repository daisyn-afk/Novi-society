import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Building2, ChevronDown, ChevronUp,
  Star, X, Upload, Globe, Mail, Package, Eye, EyeOff, Search
} from "lucide-react";

const CATEGORIES = ["injectables", "fillers", "devices", "skincare", "consumables", "prp", "laser", "body_contouring", "other"];
const CATEGORY_LABELS = {
  injectables: "Injectables", fillers: "Fillers & Dermal", devices: "Devices & Equipment",
  skincare: "Skincare & Retail", consumables: "Consumables", prp: "PRP & Regenerative",
  laser: "Laser & Energy", body_contouring: "Body Contouring", other: "Other",
};

const EMPTY_MFR = {
  name: "", category: "injectables", description: "", logo_url: "", website_url: "",
  account_rep_email: "", account_rep_name: "", products: [], benefits: [],
  required_fields: [], is_active: true, is_featured: false, sort_order: 0,
};

export default function AdminManufacturers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_MFR);
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState("details");
  const [newProduct, setNewProduct] = useState("");
  const [newBenefit, setNewBenefit] = useState("");
  const [newField, setNewField] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [viewTab, setViewTab] = useState("manufacturers");
  const [inventorySearch, setInventorySearch] = useState("");

  const { data: manufacturers = [], isLoading } = useQuery({
    queryKey: ["manufacturers-admin"],
    queryFn: () => base44.entities.Manufacturer.list(),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["manufacturer-applications-admin"],
    queryFn: () => base44.entities.ManufacturerApplication.list("-submitted_at"),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) return base44.entities.Manufacturer.update(editing.id, data);
      return base44.entities.Manufacturer.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["manufacturers-admin"] }); setOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Manufacturer.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manufacturers-admin"] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.Manufacturer.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manufacturers-admin"] }),
  });

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_MFR }); setActiveTab("details"); setOpen(true); };
  const openEdit = (m) => { setEditing(m); setForm({ ...EMPTY_MFR, ...m, products: m.products || [], benefits: m.benefits || [], required_fields: m.required_fields || [] }); setActiveTab("details"); setOpen(true); };

  const uploadLogo = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, logo_url: file_url }));
    setUploadingLogo(false);
  };

  const addItem = (key, value, setter) => {
    if (!value.trim()) return;
    setForm(f => ({ ...f, [key]: [...(f[key] || []), value.trim()] }));
    setter("");
  };
  const removeItem = (key, i) => setForm(f => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) }));

  const pendingApps = applications.filter(a => a.status === "submitted");
  const reviewedApps = applications.filter(a => a.status !== "submitted");

  const { data: allInventory = [] } = useQuery({
    queryKey: ["all-provider-inventory"],
    queryFn: () => base44.entities.ProviderInventory.list("-created_date"),
    enabled: viewTab === "inventory",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manufacturer Marketplace</h2>
          <p className="text-slate-500 text-sm mt-1">Manage suppliers shown to providers and review applications</p>
        </div>
        <Button onClick={openNew} style={{ background: "#C8E63C", color: "#1a2540" }}>
          <Plus className="w-4 h-4 mr-1" /> Add Manufacturer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Suppliers", value: manufacturers.length, color: "#7B8EC8" },
          { label: "Active", value: manufacturers.filter(m => m.is_active).length, color: "#C8E63C" },
          { label: "Featured", value: manufacturers.filter(m => m.is_featured).length, color: "#FA6F30" },
          { label: "Pending Applications", value: pendingApps.length, color: "#DA6A63" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl p-4 bg-white border border-slate-100">
            <p style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs: Manufacturers / Applications */}
      <Tabs value={viewTab} onValueChange={setViewTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="manufacturers">Manufacturers ({manufacturers.length})</TabsTrigger>
          <TabsTrigger value="applications">
            Applications {pendingApps.length > 0 && <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingApps.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="inventory">Provider Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="manufacturers">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          ) : manufacturers.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-white border border-slate-100">
              <Building2 className="w-10 h-10 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400">No manufacturers yet. Add your first one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {manufacturers.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(m => (
                <div key={m.id} className="rounded-2xl overflow-hidden bg-white border border-slate-100">
                  <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}>
                    <div className="flex items-center gap-3">
                      {m.logo_url
                        ? <img src={m.logo_url} alt={m.name} className="w-10 h-10 rounded-lg object-contain bg-slate-50 p-1 border border-slate-100" />
                        : <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><Building2 className="w-5 h-5 text-slate-400" /></div>
                      }
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">{m.name}</p>
                          <Badge className={m.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>{m.is_active ? "Active" : "Inactive"}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{CATEGORY_LABELS[m.category] || m.category}</Badge>
                          {m.is_featured && <Badge className="bg-amber-100 text-amber-700 text-xs"><Star className="w-2.5 h-2.5 mr-1" />Featured</Badge>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {m.products?.length || 0} products · Rep: {m.account_rep_email || "Not set"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" title={m.is_active ? "Deactivate" : "Activate"}
                        onClick={e => { e.stopPropagation(); toggleActiveMutation.mutate({ id: m.id, is_active: !m.is_active }); }}>
                        {m.is_active ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEdit(m); }}>
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); if (confirm("Delete this manufacturer?")) deleteMutation.mutate(m.id); }}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                      {expandedId === m.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                  {expandedId === m.id && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50 grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Products</p>
                        <div className="flex flex-wrap gap-1">
                          {m.products?.length > 0 ? m.products.map((p, i) => <Badge key={i} variant="outline" className="text-xs">{p}</Badge>) : <p className="text-xs text-slate-400">None listed</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Provider Benefits</p>
                        <ul className="space-y-0.5">
                          {m.benefits?.length > 0 ? m.benefits.map((b, i) => <li key={i} className="text-xs text-slate-600">• {b}</li>) : <p className="text-xs text-slate-400">None listed</p>}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Extra Required Fields</p>
                        <div className="flex flex-wrap gap-1">
                          {m.required_fields?.length > 0 ? m.required_fields.map((f, i) => <Badge key={i} className="bg-blue-100 text-blue-700 text-xs">{f}</Badge>) : <p className="text-xs text-slate-400">None (standard fields only)</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Account Rep</p>
                        <p className="text-xs text-slate-700">{m.account_rep_name || "—"}</p>
                        <p className="text-xs text-slate-500">{m.account_rep_email}</p>
                        {m.website_url && <a href={m.website_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"><Globe className="w-3 h-3" />{m.website_url}</a>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications">
          {applications.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-white border border-slate-100">
              <Mail className="w-10 h-10 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400">No applications submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map(app => (
                <div key={app.id} className="rounded-2xl bg-white border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{app.provider_name}</p>
                        <Badge className={{ submitted: "bg-blue-100 text-blue-700", under_review: "bg-yellow-100 text-yellow-700", approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700" }[app.status] || "bg-slate-100 text-slate-500"}>
                          {app.status?.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">Applied to <strong>{app.manufacturer_name}</strong></p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {app.license_type} · {app.license_number} · {app.license_state} · {app.practice_name && `${app.practice_name} · `}{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"
                        onClick={() => base44.entities.ManufacturerApplication.update(app.id, { status: "approved" }).then(() => qc.invalidateQueries({ queryKey: ["manufacturer-applications-admin"] }))}>
                        Approve
                      </Button>
                    </div>
                  </div>
                  {app.additional_fields && Object.keys(app.additional_fields).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Additional Fields</p>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(app.additional_fields).map(([k, v]) => (
                          <div key={k} className="text-xs"><span className="font-semibold text-slate-600">{k}:</span> <span className="text-slate-700">{v}</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none"
                  placeholder="Search by provider or product..."
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                />
              </div>
              <span className="text-xs text-slate-500">{allInventory.length} items across all providers</span>
            </div>
            {allInventory.length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-white border border-slate-100">
                <Package className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400">No provider inventory logged yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allInventory
                  .filter(i => !inventorySearch || i.provider_name?.toLowerCase().includes(inventorySearch.toLowerCase()) || i.product_name?.toLowerCase().includes(inventorySearch.toLowerCase()))
                  .map(item => {
                    const today = new Date();
                    const isExpired = item.expiration_date && new Date(item.expiration_date) < today;
                    const isExpiringSoon = item.expiration_date && !isExpired && new Date(item.expiration_date) <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                    return (
                      <div key={item.id} className="rounded-xl bg-white border p-4 flex items-center gap-4"
                        style={{ borderColor: isExpired ? "rgba(218,106,99,0.4)" : isExpiringSoon ? "rgba(250,111,48,0.3)" : "#e5e7eb" }}>
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 text-sm">{item.product_name}</p>
                            {item.manufacturer_name && <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{item.manufacturer_name}</span>}
                            {isExpired && <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Expired</span>}
                            {isExpiringSoon && <span className="text-xs font-bold px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full">Expiring Soon</span>}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Provider: <strong className="text-slate-600">{item.provider_name}</strong>
                            {item.batch_lot ? ` · Lot: ${item.batch_lot}` : ""}
                            {item.expiration_date ? ` · Exp: ${new Date(item.expiration_date).toLocaleDateString()}` : ""}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-lg" style={{ color: item.quantity <= 2 ? "#FA6F30" : "#1e2535" }}>{item.quantity}</p>
                          <p className="text-xs text-slate-400">{item.unit}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Manufacturer" : "Add Manufacturer"}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-2">
            {["details", "products", "form"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${activeTab === tab ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
                {tab === "details" ? "Details & Rep" : tab === "products" ? "Products & Benefits" : "Form Fields"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {activeTab === "details" && <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Manufacturer Name *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Allergan, Galderma, Solta Medical" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Category *</label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Sort Order</label>
                  <Input type="number" value={form.sort_order || 0} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
                  <textarea className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-slate-400"
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description shown to providers" />
                </div>
              </div>

              {/* Logo */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Logo</label>
                {form.logo_url ? (
                  <div className="flex items-center gap-3">
                    <img src={form.logo_url} alt="logo" className="w-16 h-16 rounded-xl object-contain border border-slate-200 bg-slate-50 p-2" />
                    <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, logo_url: "" }))}>Remove</Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-all">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-500">{uploadingLogo ? "Uploading..." : "Upload logo (PNG, JPG, SVG)"}</span>
                    <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={uploadLogo} disabled={uploadingLogo} />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Rep Name</label>
                  <Input value={form.account_rep_name} onChange={e => setForm(f => ({ ...f, account_rep_name: e.target.value }))} placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Rep Email (submissions go here) *</label>
                  <Input type="email" value={form.account_rep_email} onChange={e => setForm(f => ({ ...f, account_rep_email: e.target.value }))} placeholder="rep@manufacturer.com" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Website URL</label>
                  <Input value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://manufacturer.com" />
                </div>
              </div>

              <div className="flex items-center gap-6">
                {[{ key: "is_active", label: "Active (visible to providers)" }, { key: "is_featured", label: "Featured (shown first)" }].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </>}

            {activeTab === "products" && <>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Products / Notable Items</label>
                <div className="flex gap-2 mb-2">
                  <Input value={newProduct} onChange={e => setNewProduct(e.target.value)} placeholder="e.g. Botox, Juvederm, CoolSculpting"
                    onKeyDown={e => e.key === "Enter" && addItem("products", newProduct, setNewProduct)} />
                  <Button type="button" variant="outline" onClick={() => addItem("products", newProduct, setNewProduct)}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                  {form.products?.length === 0 && <p className="text-xs text-slate-400">No products added</p>}
                  {form.products?.map((p, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                      {p}<button onClick={() => removeItem("products", i)} className="text-slate-400 hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Provider Benefits (why open an account)</label>
                <div className="flex gap-2 mb-2">
                  <Input value={newBenefit} onChange={e => setNewBenefit(e.target.value)} placeholder="e.g. Exclusive NOVI provider pricing"
                    onKeyDown={e => e.key === "Enter" && addItem("benefits", newBenefit, setNewBenefit)} />
                  <Button type="button" variant="outline" onClick={() => addItem("benefits", newBenefit, setNewBenefit)}>Add</Button>
                </div>
                <div className="space-y-1 min-h-[32px]">
                  {form.benefits?.length === 0 && <p className="text-xs text-slate-400">No benefits added</p>}
                  {form.benefits?.map((b, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs">
                      <span className="text-slate-700">• {b}</span>
                      <button onClick={() => removeItem("benefits", i)} className="text-slate-300 hover:text-red-500 ml-2">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </>}

            {activeTab === "form" && <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
                <strong>Standard fields</strong> are always included (name, email, license, supervising physician, practice info). Add extra fields specific to this manufacturer below.
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Additional Required Fields</label>
                <div className="flex gap-2 mb-2">
                  <Input value={newField} onChange={e => setNewField(e.target.value)} placeholder="e.g. DEA Number, NPI, Preferred Territory"
                    onKeyDown={e => e.key === "Enter" && addItem("required_fields", newField, setNewField)} />
                  <Button type="button" variant="outline" onClick={() => addItem("required_fields", newField, setNewField)}>Add</Button>
                </div>
                <div className="space-y-1.5 min-h-[32px]">
                  {form.required_fields?.length === 0 && <p className="text-xs text-slate-400">No additional fields (standard form only)</p>}
                  {form.required_fields?.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
                      <span className="text-blue-800 font-medium">{f}</span>
                      <button onClick={() => removeItem("required_fields", i)} className="text-blue-300 hover:text-red-500 ml-2">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </>}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.account_rep_email || saveMutation.isPending}
                style={{ background: "#C8E63C", color: "#1a2540" }}>
                {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Add Manufacturer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}