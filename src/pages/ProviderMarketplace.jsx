import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import ProviderInventoryTab from "@/components/provider/ProviderInventoryTab";
import RepContactDialog from "@/components/provider/RepContactDialog";
import OrderRequestDialog from "@/components/provider/OrderRequestDialog";
import SpendDashboard from "@/components/provider/SpendDashboard";
import {
  Search, CheckCircle, Send, Building2, ChevronRight, Star, Globe, ExternalLink,
  Sparkles, ShieldCheck, Zap, Award, Users, Shield, Package, ArrowLeft,
  Clock, CheckCircle2, XCircle, AlertCircle, Mail, MapPin, TrendingUp,
  Tag, Layers, RefreshCw, Calendar, BarChart2
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

const CATEGORY_LABELS = {
  injectables: "Injectables",
  fillers: "Fillers & Dermal",
  devices: "Devices & Equipment",
  skincare: "Skincare & Retail",
  consumables: "Consumables",
  prp: "PRP & Regenerative",
  laser: "Laser & Energy",
  body_contouring: "Body Contouring",
  other: "Other",
};

const CATEGORY_COLORS = {
  injectables: { bg: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "rgba(250,111,48,0.2)" },
  fillers: { bg: "rgba(123,142,200,0.1)", color: "#7B8EC8", border: "rgba(123,142,200,0.2)" },
  devices: { bg: "rgba(45,107,127,0.1)", color: "#2D6B7F", border: "rgba(45,107,127,0.2)" },
  skincare: { bg: "rgba(200,230,60,0.12)", color: "#5a7a20", border: "rgba(200,230,60,0.25)" },
  consumables: { bg: "rgba(218,106,99,0.1)", color: "#DA6A63", border: "rgba(218,106,99,0.2)" },
  prp: { bg: "rgba(160,100,200,0.1)", color: "#9B59B6", border: "rgba(160,100,200,0.2)" },
  laser: { bg: "rgba(30,200,200,0.1)", color: "#1CA8A8", border: "rgba(30,200,200,0.2)" },
  body_contouring: { bg: "rgba(255,180,50,0.1)", color: "#D4900A", border: "rgba(255,180,50,0.2)" },
  other: { bg: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.55)", border: "rgba(30,37,53,0.1)" },
};

const APP_STATUS_CONFIG = {
  pending: { label: "Pending Review", color: "#FA6F30", bg: "rgba(250,111,48,0.1)", border: "rgba(250,111,48,0.2)", icon: Clock },
  under_review: { label: "Under Review", color: "#7B8EC8", bg: "rgba(123,142,200,0.1)", border: "rgba(123,142,200,0.2)", icon: RefreshCw },
  approved: { label: "Approved", color: "#4a6b10", bg: "rgba(200,230,60,0.15)", border: "rgba(200,230,60,0.3)", icon: CheckCircle2 },
  rejected: { label: "Not Approved", color: "#DA6A63", bg: "rgba(218,106,99,0.1)", border: "rgba(218,106,99,0.2)", icon: XCircle },
  more_info_needed: { label: "Info Needed", color: "#D4900A", bg: "rgba(255,180,50,0.1)", border: "rgba(255,180,50,0.2)", icon: AlertCircle },
};

function GlassCard({ children, className = "", style = {}, onClick }) {
  const base = {
    background: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.9)",
    boxShadow: "0 2px 16px rgba(30,37,53,0.06)",
    borderRadius: 16,
    ...style,
  };
  return onClick
    ? <button className={`text-left w-full ${className}`} style={base} onClick={onClick}>{children}</button>
    : <div className={className} style={base}>{children}</div>;
}

// ─── Supplier Detail Panel ───────────────────────────────────────────────────
function SupplierDetailView({ mfr, onBack, onApply, application, me, treatmentRecords = [], certifications = [] }) {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState("order");
  const [orderOpen, setOrderOpen] = useState(false);
  const col = CATEGORY_COLORS[mfr.category] || CATEGORY_COLORS.other;
  const app = application;
  const statusCfg = app ? (APP_STATUS_CONFIG[app.status] || APP_STATUS_CONFIG.pending) : null;
  const isApproved = app?.status === "approved";

  // Auto-calculate brand usage from treatment records
  const mfrNameLower = mfr.name?.toLowerCase() || "";
  const brandRecords = treatmentRecords.filter(r =>
    r.products_used?.some(p => p.product_name?.toLowerCase().includes(mfrNameLower) ||
      (mfr?.products || []).some(mp => p.product_name?.toLowerCase().includes(mp.toLowerCase())))
  );
  const totalUnits = brandRecords.reduce((sum, r) => sum + (r.units_used || 0), 0);
  const lastUsed = brandRecords.length > 0
    ? brandRecords.sort((a, b) => new Date(b.treatment_date) - new Date(a.treatment_date))[0]?.treatment_date
    : null;
  const usedLots = new Set();
  brandRecords.forEach(r => r.products_used?.forEach(p => { if (p.batch_lot) usedLots.add(p.batch_lot); }));
  const brandCerts = certifications.filter(c =>
    (mfr?.products || []).some(p => c.certification_name?.toLowerCase().includes(p.toLowerCase()) ||
      c.service_type_name?.toLowerCase().includes(mfrNameLower))
  );

  const MFR_PHOTOS = {
    "allergan": "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1200&q=85",
    "galderma": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=85",
    "merz": "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&q=85",
    "revance": "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=1200&q=85",
    "solta": "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1200&q=85",
    "inmode": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=85",
    "hydrafacial": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&q=85",
    "skinmedica": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1200&q=85",
    "obagi": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1200&q=85",
  };
  const CATEGORY_PHOTOS = {
    injectables: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1200&q=85",
    fillers: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=85",
    devices: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=85",
    skincare: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1200&q=85",
    laser: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1200&q=85",
    other: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&q=85",
  };
  const mfrKey = Object.keys(MFR_PHOTOS).find(k => mfr.name?.toLowerCase().includes(k));
  const heroPhoto = mfr.cover_image_url || (mfrKey ? MFR_PHOTOS[mfrKey] : null) || CATEGORY_PHOTOS[mfr.category] || CATEGORY_PHOTOS.other;

  return (
    <div className="space-y-0">
      {/* Hero Banner */}
      <div className="relative overflow-hidden" style={{ borderRadius: "20px 20px 0 0", height: 220 }}>
        <img src={heroPhoto} alt={mfr.name} className="absolute inset-0 w-full h-full object-cover" style={{ filter: "blur(1px) brightness(0.75)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(8,10,20,0.2) 0%, rgba(8,10,20,0.75) 100%)" }} />
        {/* Back button */}
        <button onClick={onBack} className="absolute top-4 left-5 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.15)", color: "#fff", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.2)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Directory
        </button>
        {/* Badges top-right */}
        <div className="absolute top-4 right-5 flex gap-2">
          {mfr.is_featured && (
            <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(200,230,60,0.25)", color: "#d4f04a", backdropFilter: "blur(12px)", border: "1px solid rgba(200,230,60,0.4)" }}>
              <Star className="w-2.5 h-2.5" /> Featured Partner
            </span>
          )}
          {mfr.fda_approved_us_products && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.2)" }}>FDA ✓</span>
          )}
        </div>
        {/* Name over hero */}
        <div className="absolute bottom-5 left-5 right-5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full mb-2 inline-block capitalize"
            style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
            {CATEGORY_LABELS[mfr.category]}
          </span>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#fff", lineHeight: 1.1, fontWeight: 400 }}>{mfr.name}</h2>
        </div>
      </div>

      {/* Main content card */}
      <div className="rounded-b-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.9)", borderTop: "none", boxShadow: "0 8px 32px rgba(30,37,53,0.1)" }}>

        {/* Description + stats */}
        <div className="px-6 pt-5 pb-4">
          {mfr.description && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(30,37,53,0.65)", maxWidth: 620 }}>{mfr.description}</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Products", value: mfr.products?.length || "—", icon: Package },
              { label: "Min. Order", value: mfr.min_order_amount ? `$${mfr.min_order_amount}` : "Contact rep", icon: Tag },
              { label: "Ships To", value: mfr.ships_to_states || "All US States", icon: MapPin },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl px-3 py-3 text-center" style={{ background: "rgba(30,37,53,0.03)", border: "1px solid rgba(30,37,53,0.07)" }}>
                <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: col.color }} />
                <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>{label}</p>
              </div>
            ))}
          </div>
          {mfr.website_url && (
            <a href={mfr.website_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs mt-3 hover:underline" style={{ color: "#7B8EC8" }}>
              <Globe className="w-3.5 h-3.5" /> {mfr.website_url} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="h-px mx-6" style={{ background: "rgba(30,37,53,0.07)" }} />

        {/* Products + Perks */}
        <div className="grid sm:grid-cols-2 gap-0">
          {mfr.products?.length > 0 && (
            <div className="p-6" style={{ borderRight: "1px solid rgba(30,37,53,0.07)" }}>
              <p className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: col.color, letterSpacing: "0.14em" }}>
                <Layers className="w-3.5 h-3.5" /> Product Portfolio
              </p>
              <div className="flex flex-wrap gap-1.5">
                {mfr.products.map((p, i) => (
                  <span key={i} className="text-xs px-3 py-1 rounded-full font-medium"
                    style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}` }}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {mfr.benefits?.length > 0 && (
            <div className="p-6">
              <p className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "#5a7a20", letterSpacing: "0.14em" }}>
                <Sparkles className="w-3.5 h-3.5" /> Account Perks
              </p>
              <div className="space-y-2">
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
        </div>

        <div className="h-px mx-6" style={{ background: "rgba(30,37,53,0.07)" }} />

        {/* NOVI Advantage */}
        <div className="px-6 py-5" style={{ background: "linear-gradient(135deg, #1e2535 0%, #2a3355 100%)", borderRadius: "0 0 16px 16px" }}>
          <p className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-1.5" style={{ color: "#C8E63C", letterSpacing: "0.14em" }}>
            <ShieldCheck className="w-3.5 h-3.5" /> Why NOVI Members Get Faster Approvals
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: ShieldCheck, title: "MD-Supervised Credentials", desc: "Your NOVI Board MD oversight is automatically included — no tracking down your own physician." },
              { icon: Zap, title: "Pre-Filled Application", desc: "Your license, DEA/NPI, practice details, and MD info are pulled from your profile automatically." },
              { icon: Award, title: "Verified Provider Status", desc: "NOVI-certified providers skip the standard vetting queue — reps prioritize NOVI members." },
              { icon: Users, title: "Dedicated Rep Access", desc: "Direct access to manufacturer territory reps for pricing, samples, and product education." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}>
                  <Icon className="w-4 h-4" style={{ color: "#C8E63C" }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: "#fff" }}>{title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Approved Account Hub CTA strip */}
      {isApproved && (
        <div className="mt-4 space-y-4">
          {/* Rep contact */}
          <GlassCard style={{ borderRadius: 16 }}>
            <div className="p-5">
              <p className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "#4a6b10", letterSpacing: "0.13em" }}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Account Active — Contact Your Rep
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => setOrderOpen(true)}
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-full transition-all hover:opacity-80"
                  style={{ background: "linear-gradient(135deg, #FA6F30, #e05a20)", color: "#fff", boxShadow: "0 4px 14px rgba(250,111,48,0.3)" }}>
                  <Send className="w-4 h-4" /> Place Order Request
                </button>
                <button onClick={() => { setContactType("call"); setContactOpen(true); }}
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-full transition-all hover:opacity-80"
                  style={{ background: "rgba(123,142,200,0.15)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.3)" }}>
                  <Calendar className="w-4 h-4" /> Schedule Call
                </button>
                <button onClick={() => { setContactType("message"); setContactOpen(true); }}
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-full transition-all hover:opacity-80"
                  style={{ background: "rgba(45,107,127,0.12)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.2)" }}>
                  <Mail className="w-4 h-4" /> Message Rep
                </button>
              </div>
              {mfr.account_rep_name && (
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Rep: <strong style={{ color: "rgba(30,37,53,0.7)" }}>{mfr.account_rep_name}</strong> · {mfr.account_rep_email}</p>
              )}
            </div>
          </GlassCard>

          {/* Auto-tracked usage */}
          <GlassCard style={{ borderRadius: 16 }}>
            <div className="p-5">
              <p className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "#4a6b10", letterSpacing: "0.13em" }}>
                <TrendingUp className="w-3.5 h-3.5" /> Auto-Tracked Usage (from NOVI records)
              </p>
              {brandRecords.length === 0 ? (
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>No treatment records linked to this supplier yet. Usage will auto-populate as you log treatments.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: "Treatments", value: brandRecords.length },
                      { label: "Units Used", value: totalUnits },
                      { label: "Lot #s Tracked", value: usedLots.size },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl px-3 py-2.5 text-center" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.2)" }}>
                        <p className="font-bold text-lg" style={{ color: "#1e2535" }}>{value}</p>
                        <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>{label}</p>
                      </div>
                    ))}
                  </div>
                  {lastUsed && <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Last used: {format(new Date(lastUsed), "MMM d, yyyy")}</p>}
                  {brandCerts.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4a6b10" }} />
                      <p className="text-xs font-semibold" style={{ color: "#4a6b10" }}>{brandCerts.length} NOVI certification{brandCerts.length > 1 ? "s" : ""} for this brand's products</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </GlassCard>

          <RepContactDialog
            open={contactOpen}
            onClose={() => setContactOpen(false)}
            manufacturer={mfr}
            me={me}
            initialType={contactType}
          />
          <OrderRequestDialog
            open={orderOpen}
            onClose={() => setOrderOpen(false)}
            manufacturer={mfr}
            me={me}
          />
        </div>
      )}

      {/* Non-approved: Application status or CTA */}
      {!isApproved && app && (
        <GlassCard style={{ borderRadius: 16 }} className="mt-4">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: statusCfg.bg }}>
                <statusCfg.icon className="w-5 h-5" style={{ color: statusCfg.color }} />
              </div>
              <div className="flex-1">
                <p className="font-bold" style={{ color: "#1e2535" }}>Application Status</p>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
                  {statusCfg.label}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Submitted</p>
                <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>{app.submitted_at ? format(new Date(app.submitted_at), "MMM d, yyyy") : "—"}</p>
              </div>
            </div>
            <div className="space-y-0">
              {[
                { label: "Application submitted to rep team", done: true },
                { label: "Credentials reviewed by manufacturer", done: ["approved", "rejected"].includes(app.status) },
                { label: "Account activated & rep assigned", done: app.status === "approved" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: step.done ? "rgba(200,230,60,0.2)" : "rgba(30,37,53,0.08)", border: step.done ? "1.5px solid rgba(200,230,60,0.5)" : "1.5px solid rgba(30,37,53,0.12)" }}>
                      {step.done ? <CheckCircle className="w-3 h-3" style={{ color: "#4a6b10" }} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(30,37,53,0.2)" }} />}
                    </div>
                    {i < 2 && <div className="w-px h-4 mt-0.5" style={{ background: step.done ? "rgba(200,230,60,0.3)" : "rgba(30,37,53,0.1)" }} />}
                  </div>
                  <p className="text-xs" style={{ color: step.done ? "rgba(30,37,53,0.8)" : "rgba(30,37,53,0.4)", fontWeight: step.done ? 500 : 400 }}>{step.label}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}

      {!isApproved && !app && (
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1 h-12" onClick={onBack}>Cancel</Button>
          <Button className="flex-1 h-12 gap-2 font-bold text-base" style={{ background: "linear-gradient(135deg, #FA6F30, #e05a20)", color: "#fff", borderRadius: 12, boxShadow: "0 4px 20px rgba(250,111,48,0.35)" }} onClick={onApply}>
            <Send className="w-4 h-4" /> Apply for Account
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ProviderMarketplace() {
  const { status: accessStatus } = useProviderAccess();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedManufacturer, setSelectedManufacturer] = useState(null);
  const [viewMode, setViewMode] = useState("directory"); // "directory" | "detail" | "apply"
  const [formData, setFormData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const qc = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: manufacturers = [], isLoading } = useQuery({
    queryKey: ["manufacturers"],
    queryFn: () => base44.entities.Manufacturer.filter({ is_active: true }),
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.License.filter({ provider_id: u.id, status: "verified" });
    },
    enabled: !!me,
  });

  const { data: mdRels = [] } = useQuery({
    queryKey: ["my-md-relationships"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.MedicalDirectorRelationship.filter({ provider_id: u.id, status: "active" });
    },
    enabled: !!me,
  });

  const { data: myApplications = [] } = useQuery({
    queryKey: ["my-manufacturer-applications"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.ManufacturerApplication.filter({ provider_id: u.id });
    },
    enabled: !!me,
  });

  const { data: treatmentRecords = [] } = useQuery({
    queryKey: ["my-treatment-records-mktplace"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.TreatmentRecord.filter({ provider_id: u.id });
    },
    enabled: !!me,
  });

  const { data: certifications = [] } = useQuery({
    queryKey: ["my-certs-mktplace"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: u.id, status: "active" });
    },
    enabled: !!me,
  });

  const submitMutation = useMutation({
    mutationFn: () => base44.functions.invoke("sendManufacturerInquiry", {
      manufacturer_id: selectedManufacturer.id,
      form_data: formData,
    }),
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["my-manufacturer-applications"] });
    },
  });

  const verifiedLicense = licenses[0] || {};
  const mdRel = mdRels[0] || {};

  const openDetail = (mfr) => {
    setSelectedManufacturer(mfr);
    setViewMode("detail");
    setSubmitted(false);
  };

  const openApply = () => {
    setFormData({
      license_type: verifiedLicense.license_type || "",
      license_number: verifiedLicense.license_number || "",
      license_state: verifiedLicense.issuing_state || "",
      supervising_physician_name: mdRel.medical_director_name || "NOVI Board of Medical Directors",
      supervising_physician_email: mdRel.medical_director_email || "",
      practice_name: me?.practice_name || "",
      practice_address: me?.address || "",
      practice_phone: me?.phone || "",
      additional_fields: {},
    });
    setViewMode("apply");
  };

  const filtered = manufacturers
    .filter(m => {
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.description?.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || m.category === categoryFilter;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

  const grouped = filtered.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const existingAppMap = Object.fromEntries(myApplications.map(a => [a.manufacturer_id, a]));
  const activeCategories = Object.keys(CATEGORY_LABELS).filter(c => grouped[c]?.length > 0);

  const approvedCount = myApplications.filter(a => a.status === "approved").length;
  const pendingCount = myApplications.filter(a => ["pending", "under_review"].includes(a.status)).length;

  const pageContent = (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#7B8EC8", letterSpacing: "0.14em" }}>Provider Marketplace</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.2 }}>Suppliers & Inventory</h1>
          <p className="mt-1 text-sm" style={{ color: "rgba(30,37,53,0.55)", maxWidth: 480 }}>
            Apply for supplier accounts and track your product inventory for compliance.
          </p>
        </div>
        {myApplications.length > 0 && (
          <div className="flex gap-3">
            {approvedCount > 0 && (
              <div className="rounded-2xl px-4 py-3 text-center" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.3)" }}>
                <p className="text-lg font-bold" style={{ color: "#4a6b10" }}>{approvedCount}</p>
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>Active Accounts</p>
              </div>
            )}
            {pendingCount > 0 && (
              <div className="rounded-2xl px-4 py-3 text-center" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.2)" }}>
                <p className="text-lg font-bold" style={{ color: "#FA6F30" }}>{pendingCount}</p>
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>Pending</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="suppliers">
        <TabsList className="mb-2 w-full overflow-x-auto flex" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: 12 }}>
          <TabsTrigger value="suppliers" className="gap-1.5 flex-1 text-xs sm:text-sm whitespace-nowrap"><Building2 className="w-3.5 h-3.5 hidden sm:block" /> Suppliers</TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5 flex-1 text-xs sm:text-sm whitespace-nowrap"><Package className="w-3.5 h-3.5 hidden sm:block" /> Inventory</TabsTrigger>
          <TabsTrigger value="spend" className="gap-1.5 flex-1 text-xs sm:text-sm whitespace-nowrap"><BarChart2 className="w-3.5 h-3.5 hidden sm:block" /> Spend & Orders</TabsTrigger>
          <TabsTrigger value="applications" className="gap-1.5 flex-1 text-xs sm:text-sm whitespace-nowrap">
            <CheckCircle className="w-3.5 h-3.5 hidden sm:block" /> Applications
            {myApplications.length > 0 && (
              <span className="ml-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "rgba(250,111,48,0.15)", color: "#FA6F30" }}>{myApplications.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── INVENTORY TAB ── */}
        <TabsContent value="inventory">
          <ProviderInventoryTab me={me} myApplications={myApplications} manufacturers={manufacturers} />
        </TabsContent>

        {/* ── SPEND & ORDERS TAB ── */}
        <TabsContent value="spend">
          <SpendDashboard manufacturers={manufacturers} />
        </TabsContent>

        {/* ── APPLICATIONS TAB ── */}
        <TabsContent value="applications">
          <div className="space-y-4">
            {myApplications.length === 0 ? (
              <GlassCard className="py-16 text-center">
                <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
                <p className="font-semibold" style={{ color: "#1e2535" }}>No applications yet</p>
                <p className="text-xs mt-1 mb-4" style={{ color: "rgba(30,37,53,0.5)" }}>Apply to a supplier from the directory to get started.</p>
              </GlassCard>
            ) : (
              <>
                {/* Summary strip */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Applied", value: myApplications.length, color: "#7B8EC8", bg: "rgba(123,142,200,0.1)" },
                    { label: "Active Accounts", value: approvedCount, color: "#4a6b10", bg: "rgba(200,230,60,0.12)" },
                    { label: "Awaiting Response", value: pendingCount, color: "#FA6F30", bg: "rgba(250,111,48,0.08)" },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className="rounded-2xl px-4 py-4 text-center" style={{ background: bg, border: `1px solid ${color}33` }}>
                      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                      <p className="text-xs mt-0.5 font-semibold" style={{ color: "rgba(30,37,53,0.55)" }}>{label}</p>
                    </div>
                  ))}
                </div>

                {myApplications.map(app => {
                  const mfr = manufacturers.find(m => m.id === app.manufacturer_id);
                  const col = mfr ? (CATEGORY_COLORS[mfr.category] || CATEGORY_COLORS.other) : CATEGORY_COLORS.other;
                  const statusCfg = APP_STATUS_CONFIG[app.status] || APP_STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <GlassCard key={app.id}>
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                            style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                            {mfr?.logo_url
                              ? <img src={mfr.logo_url} alt={mfr.name} className="w-full h-full object-contain p-1" />
                              : <Building2 className="w-5 h-5" style={{ color: col.color }} />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{app.manufacturer_name}</p>
                              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
                                <StatusIcon className="w-3 h-3" style={{ width: 12, height: 12 }} />
                                {statusCfg.label}
                              </span>
                            </div>
                            {mfr && <p className="text-xs mt-0.5 capitalize" style={{ color: "rgba(30,37,53,0.45)" }}>{CATEGORY_LABELS[mfr.category]}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Submitted</p>
                            <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>
                              {app.submitted_at ? format(new Date(app.submitted_at), "MMM d, yyyy") : "—"}
                            </p>
                          </div>
                        </div>

                        {/* Progress timeline */}
                        <div className="mt-4 flex items-center gap-0">
                          {[
                            { label: "Submitted", done: true },
                            { label: "In Review", done: ["approved", "rejected", "more_info_needed", "under_review"].includes(app.status) },
                            { label: "Decision", done: ["approved", "rejected"].includes(app.status) },
                            { label: "Active", done: app.status === "approved" },
                          ].map((step, i, arr) => (
                            <div key={i} className="flex items-center flex-1">
                              <div className="flex flex-col items-center flex-shrink-0">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                  style={{ background: step.done ? "rgba(200,230,60,0.2)" : "rgba(30,37,53,0.07)", border: step.done ? "1.5px solid rgba(200,230,60,0.5)" : "1.5px solid rgba(30,37,53,0.12)", color: step.done ? "#4a6b10" : "rgba(30,37,53,0.3)" }}>
                                  {step.done ? <CheckCircle className="w-3.5 h-3.5" style={{ color: "#4a6b10" }} /> : (i + 1)}
                                </div>
                                <p className="text-xs mt-1 whitespace-nowrap" style={{ color: step.done ? "rgba(30,37,53,0.7)" : "rgba(30,37,53,0.3)", fontWeight: step.done ? 500 : 400, fontSize: 10 }}>{step.label}</p>
                              </div>
                              {i < arr.length - 1 && (
                                <div className="flex-1 h-px mx-1 mb-4" style={{ background: step.done ? "rgba(200,230,60,0.4)" : "rgba(30,37,53,0.1)" }} />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Status-specific message */}
                        {app.status === "approved" && (
                          <div className="mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.25)" }}>
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#4a6b10" }} />
                            <p className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.75)" }}>Account active — a rep should have reached out via email to complete setup.</p>
                          </div>
                        )}
                        {app.status === "more_info_needed" && (
                          <div className="mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2" style={{ background: "rgba(255,180,50,0.1)", border: "1px solid rgba(255,180,50,0.25)" }}>
                            <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#D4900A" }} />
                            <p className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.75)" }}>The rep needs more info — check your email to respond.</p>
                          </div>
                        )}
                        {["pending", "under_review"].includes(app.status) && (
                          <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: "rgba(123,142,200,0.07)", border: "1px solid rgba(123,142,200,0.18)" }}>
                            <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#7B8EC8" }} />
                            <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>Typical response time: 3–5 business days. Check your email for updates.</p>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  );
                })}
              </>
            )}
          </div>
        </TabsContent>

        {/* ── SUPPLIERS TAB ── */}
        <TabsContent value="suppliers">
          <div className="space-y-5">

            {/* Detail / Apply view */}
            {(viewMode === "detail" || viewMode === "apply") && selectedManufacturer ? (
              viewMode === "apply" ? (
                /* ── Apply Form ── */
                <div className="space-y-5">
                  <button onClick={() => setViewMode("detail")} className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70" style={{ color: "rgba(30,37,53,0.5)" }}>
                    <ArrowLeft className="w-4 h-4" /> Back to {selectedManufacturer.name}
                  </button>

                  {submitted ? (
                    <GlassCard>
                      <div className="text-center py-10 px-6">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(200,230,60,0.2)" }}>
                          <CheckCircle className="w-7 h-7" style={{ color: "#5a7a20" }} />
                        </div>
                        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#1e2535" }}>Application Submitted!</h2>
                        <p className="text-sm mt-2 mb-5" style={{ color: "rgba(30,37,53,0.6)", maxWidth: 340, margin: "8px auto 20px" }}>
                          Your application to <strong>{selectedManufacturer?.name}</strong> is on its way. A rep will reach out within 3–5 business days.
                        </p>
                        <div className="rounded-xl px-4 py-3 mb-5 text-left space-y-2 max-w-sm mx-auto"
                          style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.2)" }}>
                          {["Application sent to manufacturer rep team", "They'll review your credentials and reach out by email", "Expect a response within 3–5 business days"].map((s, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#5a7a20" }} />
                              <p className="text-xs" style={{ color: "rgba(30,37,53,0.65)" }}>{s}</p>
                            </div>
                          ))}
                        </div>
                        <Button onClick={() => { setViewMode("directory"); setSelectedManufacturer(null); setSubmitted(false); }} style={{ background: "#1e2535", color: "#fff" }}>
                          Back to Marketplace
                        </Button>
                      </div>
                    </GlassCard>
                  ) : (
                    <GlassCard>
                      <div className="p-5 space-y-4">
                        <div>
                          <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#1e2535" }}>Apply to {selectedManufacturer.name}</h3>
                          <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>Your NOVI credentials are pre-filled — just confirm and submit.</p>
                        </div>

                        <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: "rgba(200,230,60,0.07)", border: "1px solid rgba(200,230,60,0.2)" }}>
                          <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#5a7a20" }} />
                          <p className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.7)" }}>Fields pre-filled from your NOVI profile — edit if needed before submitting.</p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.35)" }}>Your NOVI credentials</p>
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className="text-xs font-medium mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Full Name</label><Input value={me?.full_name || ""} disabled style={{ background: "rgba(30,37,53,0.03)" }} /></div>
                              <div><label className="text-xs font-medium mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Email</label><Input value={me?.email || ""} disabled style={{ background: "rgba(30,37,53,0.03)" }} /></div>
                              <div><label className="text-xs font-medium mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>License Type</label><Input value={formData.license_type || ""} onChange={e => setFormData(d => ({ ...d, license_type: e.target.value }))} placeholder="RN, NP, PA..." /></div>
                              <div><label className="text-xs font-medium mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>License #</label><Input value={formData.license_number || ""} onChange={e => setFormData(d => ({ ...d, license_number: e.target.value }))} /></div>
                              <div><label className="text-xs font-medium mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>State</label><Input value={formData.license_state || ""} onChange={e => setFormData(d => ({ ...d, license_state: e.target.value }))} placeholder="TX" /></div>
                              <div><label className="text-xs font-medium mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Supervising MD</label><Input value={formData.supervising_physician_name || ""} onChange={e => setFormData(d => ({ ...d, supervising_physician_name: e.target.value }))} /></div>
                            </div>
                            <div><label className="text-xs font-medium mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Practice / Business Name</label><Input value={formData.practice_name || ""} onChange={e => setFormData(d => ({ ...d, practice_name: e.target.value }))} placeholder="Your practice name" /></div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className="text-xs font-medium mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Practice Address</label><Input value={formData.practice_address || ""} onChange={e => setFormData(d => ({ ...d, practice_address: e.target.value }))} /></div>
                              <div><label className="text-xs font-medium mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Phone</label><Input value={formData.practice_phone || ""} onChange={e => setFormData(d => ({ ...d, practice_phone: e.target.value }))} /></div>
                            </div>
                            {selectedManufacturer.required_fields?.length > 0 && (
                              <div className="space-y-2 pt-2">
                                <div className="h-px" style={{ background: "rgba(30,37,53,0.07)" }} />
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(30,37,53,0.35)" }}>Required by {selectedManufacturer.name}</p>
                                {selectedManufacturer.required_fields.map((field, i) => (
                                  <div key={i}>
                                    <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>{field}</label>
                                    <Input value={formData.additional_fields?.[field] || ""} onChange={e => setFormData(d => ({ ...d, additional_fields: { ...(d.additional_fields || {}), [field]: e.target.value } }))} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-xs px-3 py-2.5 rounded-xl" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)", color: "rgba(30,37,53,0.6)" }}>
                          Your info will be forwarded to the {selectedManufacturer.name} account team. A rep typically follows up within 3–5 business days.
                        </p>

                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1" onClick={() => setViewMode("detail")}>Back</Button>
                          <Button className="flex-1 gap-2 font-bold" style={{ background: "#1e2535", color: "#fff" }}
                            onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                            <Send className="w-3.5 h-3.5" />
                            {submitMutation.isPending ? "Submitting..." : "Submit Application"}
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  )}
                </div>
              ) : (
                /* ── Detail View ── */
                <SupplierDetailView
                  mfr={selectedManufacturer}
                  onBack={() => { setViewMode("directory"); setSelectedManufacturer(null); }}
                  onApply={openApply}
                  application={existingAppMap[selectedManufacturer.id]}
                  me={me}
                  treatmentRecords={treatmentRecords}
                  certifications={certifications}
                />
              )
            ) : (
              /* ── Directory View ── */
              <>
                {/* NOVI benefit slim bar */}
                <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl" style={{ background: "linear-gradient(135deg, #1e2535, #2a3355)", border: "1px solid rgba(200,230,60,0.15)" }}>
                  <div className="flex items-center gap-3">
                    <span style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 17, color: "#fff" }}>novi</span>
                    <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.15)" }} />
                    <span className="text-xs hidden sm:block" style={{ color: "rgba(255,255,255,0.5)" }}>Applications pre-filled with your license &amp; MD oversight — no paperwork</span>
                  </div>
                  <Link to={createPageUrl("ProviderCredentialsCoverage")} className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: "rgba(200,230,60,0.18)", color: "#C8E63C", border: "1px solid rgba(200,230,60,0.3)" }}>My Coverage →</Link>
                </div>

                {/* Search + filters */}
                <div className="space-y-2">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "rgba(30,37,53,0.35)" }} />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..."
                      className="pl-9 h-10 text-sm w-full" style={{ background: "rgba(255,255,255,0.9)", border: "1.5px solid rgba(30,37,53,0.1)", borderRadius: 10 }} />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {[{ key: "all", label: "All" }, ...Object.keys(CATEGORY_LABELS).filter(c => grouped[c]?.length > 0).map(k => ({ key: k, label: CATEGORY_LABELS[k] }))].map(({ key, label }) => {
                      const active = categoryFilter === key;
                      return (
                        <button key={key} onClick={() => setCategoryFilter(key)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0"
                          style={{ background: active ? "#1e2535" : "rgba(255,255,255,0.8)", color: active ? "#fff" : "rgba(30,37,53,0.6)", border: active ? "none" : "1px solid rgba(30,37,53,0.1)", boxShadow: active ? "0 2px 8px rgba(30,37,53,0.2)" : "none" }}>
                          {label}
                        </button>
                      );
                    })}
                    <span className="text-xs ml-auto flex-shrink-0 pr-1" style={{ color: "rgba(30,37,53,0.35)" }}>{filtered.length}</span>
                  </div>
                </div>

                {/* Photo grid */}
                {isLoading ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.5)" }} />)}</div>
                ) : filtered.length === 0 ? (
                  <div className="py-20 text-center rounded-2xl" style={{ background: "#fff", border: "1.5px solid rgba(30,37,53,0.07)" }}>
                    <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.15)" }} />
                    <p className="font-semibold" style={{ color: "#1e2535" }}>No suppliers found</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.map(mfr => {
                      const col = CATEGORY_COLORS[mfr.category] || CATEGORY_COLORS.other;
                      const applied = existingAppMap[mfr.id];
                      const appStatus = applied ? (APP_STATUS_CONFIG[applied.status] || APP_STATUS_CONFIG.pending) : null;
                      const MFR_PHOTOS = {
                        "allergan": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=700&q=80",
                        "galderma": "https://images.unsplash.com/photo-1631390012074-8ba0f5c2e14d?w=700&q=80",
                        "merz": "https://images.unsplash.com/photo-1559181567-c3190bebb3e2?w=700&q=80",
                        "revance": "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=700&q=80",
                        "solta": "https://images.unsplash.com/photo-1576671081837-49000212a370?w=700&q=80",
                        "syneron": "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=700&q=80",
                        "inmode": "https://images.unsplash.com/photo-1576671081837-49000212a370?w=700&q=80",
                        "sciton": "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=700&q=80",
                        "cutera": "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=700&q=80",
                        "coolsculpting": "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=700&q=80",
                        "skinmedica": "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=700&q=80",
                        "obagi": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=700&q=80",
                        "jan marini": "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=700&q=80",
                        "hydrafacial": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=700&q=80",
                      };
                      const CATEGORY_PHOTOS = {
                        injectables: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=700&q=80",
                        fillers: "https://images.unsplash.com/photo-1631390012074-8ba0f5c2e14d?w=700&q=80",
                        devices: "https://images.unsplash.com/photo-1576671081837-49000212a370?w=700&q=80",
                        skincare: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=700&q=80",
                        laser: "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=700&q=80",
                        consumables: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=700&q=80",
                        prp: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=700&q=80",
                        body_contouring: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=700&q=80",
                        other: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=700&q=80",
                      };
                      const mfrKey = Object.keys(MFR_PHOTOS).find(k => mfr.name?.toLowerCase().includes(k));
                      const photo = mfr.cover_image_url || (mfrKey ? MFR_PHOTOS[mfrKey] : null) || CATEGORY_PHOTOS[mfr.category] || CATEGORY_PHOTOS.other;
                      return (
                        <button key={mfr.id} onClick={() => openDetail(mfr)}
                          className="group relative text-left overflow-hidden"
                          style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(30,37,53,0.14)", height: mfr.is_featured ? 260 : 210, transition: "all 0.25s ease", display: "block", width: "100%" }}
                          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
                          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                        >
                          {/* Photo */}
                          <img src={photo} alt={mfr.name} className="absolute inset-0 w-full h-full object-cover"
                            style={{ transition: "transform 0.5s ease" }}
                            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.06)"}
                            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"} />

                          {/* Blur layer */}
                          <div className="absolute inset-0" style={{ backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
                          {/* Gradient overlay */}
                          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(8,10,20,0.25) 0%, rgba(8,10,20,0.55) 45%, rgba(8,10,20,0.94) 100%)" }} />

                          {/* Top badges */}
                          <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.18)" }}>
                              {CATEGORY_LABELS[mfr.category]}
                            </span>
                            <div className="flex gap-1.5">
                              {mfr.is_featured && (
                                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                                  style={{ background: "rgba(200,230,60,0.22)", color: "#d4f04a", backdropFilter: "blur(12px)", border: "1px solid rgba(200,230,60,0.35)" }}>
                                  <Star className="w-2.5 h-2.5" /> Featured
                                </span>
                              )}
                              {mfr.fda_approved_us_products && (
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                  style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.18)" }}>FDA ✓</span>
                              )}
                            </div>
                          </div>

                          {/* Bottom content */}
                          <div className="absolute bottom-0 left-0 right-0 p-5">
                            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: mfr.is_featured ? 22 : 18, color: "#fff", lineHeight: 1.2, marginBottom: 6, fontWeight: 400 }}>{mfr.name}</p>
                            {mfr.description && <p className="text-xs line-clamp-2 mb-4" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{mfr.description}</p>}
                            {mfr.products?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-4">
                                {mfr.products.slice(0, 3).map((p, i) => (
                                  <span key={i} className="text-xs px-2.5 py-0.5 rounded-full"
                                    style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>{p}</span>
                                ))}
                                {mfr.products.length > 3 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: "rgba(255,255,255,0.4)" }}>+{mfr.products.length - 3}</span>}
                              </div>
                            )}
                            {applied ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                                style={{ background: appStatus.bg, color: appStatus.color }}>
                                <appStatus.icon className="w-3 h-3" style={{ width: 12, height: 12 }} />{appStatus.label}
                              </span>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold px-5 py-2 rounded-full"
                                  style={{ background: "rgba(255,255,255,0.95)", color: "#1e2535", backdropFilter: "blur(8px)" }}>Apply for Account</span>
                                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
                                  <ChevronRight className="w-4 h-4" style={{ color: "#fff" }} />
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <ProviderSalesLock feature="marketplace" applicationStatus={accessStatus} requiredTier="full">
      {pageContent}
    </ProviderSalesLock>
  );
}