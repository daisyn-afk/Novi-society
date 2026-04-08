import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RepContactDialog from "./RepContactDialog";
import {
  Plus, Package, Pencil, Trash2, AlertTriangle, Building2, Star,
  Globe, ExternalLink, ChevronDown, ChevronUp, CheckCircle, Sparkles,
  Clock, RefreshCw, XCircle, Mail, Calendar, Send, TrendingUp, ShieldCheck
} from "lucide-react";
import { format } from "date-fns";

const CATEGORY_COLORS = {
  injectables: { bg: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "rgba(250,111,48,0.2)" },
  fillers: { bg: "rgba(123,142,200,0.1)", color: "#7B8EC8", border: "rgba(123,142,200,0.2)" },
  devices: { bg: "rgba(45,107,127,0.1)", color: "#2D6B7F", border: "rgba(45,107,127,0.2)" },
  skincare: { bg: "rgba(200,230,60,0.12)", color: "#5a7a20", border: "rgba(200,230,60,0.25)" },
  consumables: { bg: "rgba(218,106,99,0.1)", color: "#DA6A63", border: "rgba(218,106,99,0.2)" },
  other: { bg: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.55)", border: "rgba(30,37,53,0.1)" },
};

const CATEGORY_LABELS = {
  injectables: "Injectables", fillers: "Fillers & Dermal", devices: "Devices & Equipment",
  skincare: "Skincare & Retail", consumables: "Consumables", prp: "PRP & Regenerative",
  laser: "Laser & Energy", body_contouring: "Body Contouring", other: "Other",
};

const STATUS_CONFIG = {
  pending: { label: "Pending Review", color: "#FA6F30", bg: "rgba(250,111,48,0.1)", icon: Clock },
  under_review: { label: "Under Review", color: "#7B8EC8", bg: "rgba(123,142,200,0.1)", icon: RefreshCw },
  approved: { label: "Account Active", color: "#4a6b10", bg: "rgba(200,230,60,0.15)", icon: CheckCircle },
  rejected: { label: "Not Approved", color: "#DA6A63", bg: "rgba(218,106,99,0.1)", icon: XCircle },
  more_info_needed: { label: "Info Needed", color: "#D4900A", bg: "rgba(255,180,50,0.1)", icon: AlertTriangle },
};

function SupplierAccountCard({ app, mfr, treatmentRecords = [], certifications = [], me }) {
  const [expanded, setExpanded] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState("order");
  const col = mfr ? (CATEGORY_COLORS[mfr.category] || CATEGORY_COLORS.other) : CATEGORY_COLORS.other;
  const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const isApproved = app.status === "approved";

  // Auto-calculate brand usage from treatment records
  const mfrNameLower = app.manufacturer_name?.toLowerCase() || "";
  const brandRecords = treatmentRecords.filter(r =>
    r.products_used?.some(p => p.product_name?.toLowerCase().includes(mfrNameLower) ||
      (mfr?.products || []).some(mp => p.product_name?.toLowerCase().includes(mp.toLowerCase())))
  );
  const totalUnits = brandRecords.reduce((sum, r) => sum + (r.units_used || 0), 0);
  const lastUsed = brandRecords.length > 0
    ? brandRecords.sort((a, b) => new Date(b.treatment_date) - new Date(a.treatment_date))[0]?.treatment_date
    : null;

  // Lot numbers used in treatments
  const usedLots = new Set();
  brandRecords.forEach(r => r.products_used?.forEach(p => { if (p.batch_lot) usedLots.add(p.batch_lot); }));

  // Certifications for this brand's products
  const brandCerts = certifications.filter(c =>
    (mfr?.products || []).some(p => c.certification_name?.toLowerCase().includes(p.toLowerCase()) ||
      c.service_type_name?.toLowerCase().includes(mfrNameLower))
  );

  return (
    <div className="overflow-hidden" style={{ borderRadius: 16, border: `1.5px solid ${isApproved ? "rgba(200,230,60,0.35)" : "rgba(30,37,53,0.1)"}`, background: "rgba(255,255,255,0.9)", boxShadow: "0 2px 12px rgba(30,37,53,0.07)" }}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: isApproved ? "#C8E63C" : col.color, minHeight: 40 }} />
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: col.bg, border: `1px solid ${col.border}` }}>
          {mfr?.logo_url
            ? <img src={mfr.logo_url} alt={mfr.name} className="w-full h-full object-contain p-1" />
            : <Building2 className="w-5 h-5" style={{ color: col.color }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, color: "#1e2535", fontWeight: 400 }}>{app.manufacturer_name}</p>
            {mfr?.category && <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}` }}>{CATEGORY_LABELS[mfr.category]}</span>}
            {mfr?.is_featured && <span className="flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(200,230,60,0.15)", color: "#5a7a20" }}><Star className="w-2.5 h-2.5" /> Featured</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>Applied {app.submitted_at ? format(new Date(app.submitted_at), "MMM d, yyyy") : "—"}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: statusCfg.bg, color: statusCfg.color }}>
            <StatusIcon className="w-3 h-3" style={{ width: 12, height: 12 }} /> {statusCfg.label}
          </span>
          {isApproved && (
            <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-lg transition-colors hover:bg-slate-100">
              {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} />}
            </button>
          )}
        </div>
      </div>

      {/* Rep contact buttons — approved only */}
      {isApproved && (
        <div className="px-4 pb-3 flex gap-2">
          <button onClick={() => { setContactType("order"); setContactOpen(true); }}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
            style={{ background: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.2)" }}>
            <Send className="w-3 h-3" /> Order Request
          </button>
          <button onClick={() => { setContactType("call"); setContactOpen(true); }}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
            style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.2)" }}>
            <Calendar className="w-3 h-3" /> Schedule Call
          </button>
          <button onClick={() => { setContactType("message"); setContactOpen(true); }}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
            style={{ background: "rgba(45,107,127,0.1)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.2)" }}>
            <Mail className="w-3 h-3" /> Message
          </button>
        </div>
      )}

      {/* Expanded — approved only */}
      {isApproved && expanded && (
        <div style={{ borderTop: "1px solid rgba(30,37,53,0.07)" }}>
          {mfr?.products?.length > 0 && (
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
              <p className="text-xs font-black uppercase tracking-widest mb-2.5" style={{ color: col.color, letterSpacing: "0.13em" }}>Product Catalog</p>
              <div className="flex flex-wrap gap-1.5">
                {mfr.products.map((p, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}` }}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {mfr?.benefits?.length > 0 && (
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
              <p className="text-xs font-black uppercase tracking-widest mb-2.5" style={{ color: "#5a7a20", letterSpacing: "0.13em" }}>Account Perks & Rewards</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {mfr.benefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(200,230,60,0.2)" }}>
                      <CheckCircle className="w-2.5 h-2.5" style={{ color: "#5a7a20" }} />
                    </div>
                    <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>{b}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Auto-calculated brand usage from NOVI treatment records */}
          {(brandRecords.length > 0 || brandCerts.length > 0) && (
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)", background: "rgba(200,230,60,0.04)" }}>
              <p className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "#4a6b10", letterSpacing: "0.13em" }}>
                <TrendingUp className="w-3.5 h-3.5" /> Auto-Tracked Usage (from NOVI records)
              </p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(200,230,60,0.2)" }}>
                  <p className="font-bold text-base" style={{ color: "#1e2535" }}>{brandRecords.length}</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Treatments</p>
                </div>
                <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(200,230,60,0.2)" }}>
                  <p className="font-bold text-base" style={{ color: "#1e2535" }}>{totalUnits}</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Units Used</p>
                </div>
                <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(200,230,60,0.2)" }}>
                  <p className="font-bold text-base" style={{ color: "#1e2535" }}>{usedLots.size}</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Lot #s Tracked</p>
                </div>
              </div>
              {lastUsed && <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Last used: {format(new Date(lastUsed), "MMM d, yyyy")}</p>}
              {brandCerts.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4a6b10" }} />
                  <p className="text-xs font-semibold" style={{ color: "#4a6b10" }}>{brandCerts.length} NOVI certification{brandCerts.length > 1 ? "s" : ""} for this brand's products</p>
                </div>
              )}
            </div>
          )}

          <div className="px-5 py-3 flex items-center gap-4 flex-wrap" style={{ background: "rgba(30,37,53,0.02)" }}>
            {mfr?.website_url && (
              <a href={mfr.website_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold hover:underline" style={{ color: "#7B8EC8" }}>
                <Globe className="w-3.5 h-3.5" /> {mfr.website_url} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Rep contact dialog */}
      <RepContactDialog
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        manufacturer={mfr}
        me={me}
        initialType={contactType}
      />

      {/* Pending nudge */}
      {!isApproved && app.status !== "rejected" && (
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: "1px solid rgba(30,37,53,0.07)", background: "rgba(30,37,53,0.02)" }}>
          <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
          <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>Account details, pricing, and rewards will appear here once your application is approved.</p>
        </div>
      )}
    </div>
  );
}

const EMPTY_ITEM = {
  product_name: "", manufacturer_name: "", batch_lot: "",
  quantity: "", unit: "units", expiration_date: "", purchase_date: "", notes: ""
};

export default function ProviderInventoryTab({ me, myApplications = [], manufacturers = [] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: treatmentRecords = [] } = useQuery({
    queryKey: ["my-treatment-records-for-inventory"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.TreatmentRecord.filter({ provider_id: u.id });
    },
    enabled: !!me,
  });

  const { data: certifications = [] } = useQuery({
    queryKey: ["my-certs-for-inventory"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: u.id, status: "active" });
    },
    enabled: !!me,
  });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["my-inventory"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.ProviderInventory.filter({ provider_id: u.id }, "-created_date");
    },
    enabled: !!me,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const u = await base44.auth.me();
      const payload = { ...data, provider_id: u.id, provider_email: u.email, provider_name: u.full_name, quantity: parseFloat(data.quantity) || 0 };
      if (editing) return base44.entities.ProviderInventory.update(editing.id, payload);
      return base44.entities.ProviderInventory.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-inventory"] }); setOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProviderInventory.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-inventory"] }),
  });

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_ITEM }); setOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...EMPTY_ITEM, ...item }); setOpen(true); };

  const today = new Date();
  const expiringSoon = inventory.filter(i => i.expiration_date && new Date(i.expiration_date) <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) && new Date(i.expiration_date) >= today);
  const lowStock = inventory.filter(i => i.quantity <= 2 && i.quantity > 0);

  const approvedApps = myApplications.filter(a => a.status === "approved");
  const displayedSuppliers = showAllSuppliers ? myApplications : myApplications.slice(0, 4);

  return (
    <div className="space-y-6">

      {/* ── Supplier Accounts ── */}
      {myApplications.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.15em" }}>My Supplier Accounts</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                {approvedApps.length} active · {myApplications.length - approvedApps.length} pending
              </p>
            </div>
            {approvedApps.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.3)" }}>
                <Sparkles className="w-3 h-3" /> {approvedApps.length} Active
              </div>
            )}
          </div>
          <div className="space-y-3">
            {displayedSuppliers.map(app => {
              const mfr = manufacturers.find(m => m.id === app.manufacturer_id);
              return <SupplierAccountCard key={app.id} app={app} mfr={mfr} treatmentRecords={treatmentRecords} certifications={certifications} me={me} />;
            })}
          </div>
          {myApplications.length > 4 && (
            <button onClick={() => setShowAllSuppliers(v => !v)}
              className="w-full py-2 text-xs font-semibold text-center rounded-xl transition-colors"
              style={{ color: "rgba(30,37,53,0.45)", border: "1px solid rgba(30,37,53,0.08)", background: "rgba(255,255,255,0.5)" }}>
              {showAllSuppliers ? "Show less" : `Show all ${myApplications.length} suppliers`}
            </button>
          )}
        </div>
      )}

      <div className="h-px" style={{ background: "rgba(30,37,53,0.08)" }} />

      {/* ── Alerts ── */}
      {(expiringSoon.length > 0 || lowStock.length > 0) && (
        <div className="space-y-2">
          {expiringSoon.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.3)" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#DA6A63" }} />
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{expiringSoon.length} product{expiringSoon.length > 1 ? "s" : ""} expiring within 30 days</p>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(250,111,48,0.1)", border: "1px solid rgba(250,111,48,0.3)" }}>
              <Package className="w-4 h-4 flex-shrink-0" style={{ color: "#FA6F30" }} />
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{lowStock.length} product{lowStock.length > 1 ? "s" : ""} running low (2 or fewer units)</p>
            </div>
          )}
        </div>
      )}

      {/* ── Product Inventory ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.15em" }}>Product Inventory</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
            Track products on hand. Treatments without matching inventory will be flagged.
          </p>
        </div>
        <Button size="sm" onClick={openNew} style={{ background: "#FA6F30", color: "#fff", borderRadius: 10 }} className="gap-1.5 h-8 text-xs font-bold">
          <Plus className="w-3.5 h-3.5" /> Add Product
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.4)" }} />)}</div>
      ) : inventory.length === 0 ? (
        <div className="py-14 text-center rounded-2xl" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.7)" }}>
          <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
          <p className="font-semibold" style={{ color: "#1e2535" }}>No inventory logged yet</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "rgba(30,37,53,0.5)" }}>Add the products you have on hand to stay compliant.</p>
          <Button onClick={openNew} style={{ background: "#FA6F30", color: "#fff" }} className="gap-2">
            <Plus className="w-4 h-4" /> Add First Product
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {inventory.map(item => {
            const isExpired = item.expiration_date && new Date(item.expiration_date) < today;
            const isExpiringSoon = !isExpired && item.expiration_date && new Date(item.expiration_date) <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
            return (
              <div key={item.id} className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${isExpired ? "rgba(218,106,99,0.35)" : isExpiringSoon ? "rgba(250,111,48,0.25)" : "rgba(30,37,53,0.08)"}` }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(123,142,200,0.12)" }}>
                  <Package className="w-4 h-4" style={{ color: "#7B8EC8" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{item.product_name}</p>
                    {item.manufacturer_name && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.55)" }}>{item.manufacturer_name}</span>}
                    {isExpired && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(218,106,99,0.12)", color: "#DA6A63" }}>Expired</span>}
                    {isExpiringSoon && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(250,111,48,0.1)", color: "#FA6F30" }}>Expiring Soon</span>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                    {item.batch_lot ? `Lot: ${item.batch_lot} · ` : ""}
                    {item.expiration_date ? `Exp: ${format(new Date(item.expiration_date), "MMM d, yyyy")} · ` : ""}
                    {item.purchase_date ? `Purchased: ${format(new Date(item.purchase_date), "MMM d, yyyy")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-base" style={{ color: item.quantity <= 2 ? "#FA6F30" : "#1e2535" }}>{item.quantity}</p>
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>{item.unit}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)} className="w-8 h-8">
                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remove this item?")) deleteMutation.mutate(item.id); }} className="w-8 h-8">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Inventory Item" : "Add Product to Inventory"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Product Name *</label>
              <Input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} placeholder="e.g. Botox, Juvederm Ultra" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Manufacturer</label>
                <Input value={form.manufacturer_name} onChange={e => setForm(f => ({ ...f, manufacturer_name: e.target.value }))} placeholder="e.g. Allergan" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Batch / Lot #</label>
                <Input value={form.batch_lot} onChange={e => setForm(f => ({ ...f, batch_lot: e.target.value }))} placeholder="LOT123456" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Quantity *</label>
                <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Unit</label>
                <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="units, mL, syringes" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Purchase Date</label>
                <Input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Expiration Date</label>
                <Input type="date" value={form.expiration_date} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.product_name || !form.quantity || saveMutation.isPending}
                style={{ background: "#FA6F30", color: "#fff" }}>
                {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Add to Inventory"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}