import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import RepContactDialog from "@/components/provider/RepContactDialog";
import ScheduleCallDialog from "@/components/provider/ScheduleCallDialog";
import UpcomingRepCalls from "@/components/provider/UpcomingRepCalls";
import RepInfoModal from "@/components/provider/RepInfoModal";
import OrderRequestDialog from "@/components/provider/OrderRequestDialog";
import SaveRepContactForm, { resolveRepDisplay } from "@/components/provider/SaveRepContactForm";
import ProviderInventoryTab from "@/components/provider/ProviderInventoryTab";
import {
  Search, CheckCircle, Send, Building2, ChevronRight, Star, Globe, ExternalLink,
  Sparkles, ShieldCheck, Zap, Award, Users, Package, ArrowLeft,
  Clock, CheckCircle2, XCircle, AlertCircle, Mail, MapPin, TrendingUp,
  Tag, Layers, RefreshCw, Calendar, Headphones, Bookmark,
  Pencil, User, DollarSign,
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { buildSupplierUsageStats, buildMonthlyTreatmentCounts, buildRecentTreatmentLines, formatTreatmentCountLabel } from "@/lib/supplierUsage";

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
  submitted: { label: "Pending Review", color: "#FA6F30", bg: "rgba(250,111,48,0.1)", border: "rgba(250,111,48,0.2)", icon: Clock },
  pending: { label: "Pending Review", color: "#FA6F30", bg: "rgba(250,111,48,0.1)", border: "rgba(250,111,48,0.2)", icon: Clock },
  under_review: { label: "Under Review", color: "#7B8EC8", bg: "rgba(123,142,200,0.1)", border: "rgba(123,142,200,0.2)", icon: RefreshCw },
  approved: { label: "Approved", color: "#4a6b10", bg: "rgba(200,230,60,0.15)", border: "rgba(200,230,60,0.3)", icon: CheckCircle2 },
  rejected: { label: "Not Approved", color: "#DA6A63", bg: "rgba(218,106,99,0.1)", border: "rgba(218,106,99,0.2)", icon: XCircle },
  more_info_needed: { label: "Info Needed", color: "#D4900A", bg: "rgba(255,180,50,0.1)", border: "rgba(255,180,50,0.2)", icon: AlertCircle },
};

const MFR_FALLBACK_COVERS = {
  allergan: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1200&q=85",
  galderma: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=85",
  merz: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&q=85",
  revance: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=1200&q=85",
  solta: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1200&q=85",
  inmode: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=85",
  hydrafacial: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&q=85",
  skinmedica: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1200&q=85",
  obagi: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1200&q=85",
};

const CATEGORY_FALLBACK_COVERS = {
  injectables: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=900&q=80",
  fillers: "https://images.unsplash.com/photo-1631390012074-8ba0f5c2e14d?w=900&q=80",
  devices: "https://images.unsplash.com/photo-1576671081837-49000212a370?w=900&q=80",
  skincare: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=900&q=80",
  laser: "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=900&q=80",
  consumables: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=900&q=80",
  prp: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=900&q=80",
  body_contouring: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=900&q=80",
  other: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=900&q=80",
};

function isValidMediaUrl(url) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value);
}

function getSupplierLogoUrl(mfr) {
  if (isValidMediaUrl(mfr?.logo_url)) return String(mfr.logo_url).trim();
  return null;
}

function hasUploadedCover(mfr) {
  return isValidMediaUrl(mfr?.cover_image_url);
}

function getSupplierCoverUrl(mfr) {
  if (hasUploadedCover(mfr)) return String(mfr.cover_image_url).trim();
  const mfrKey = Object.keys(MFR_FALLBACK_COVERS).find((k) =>
    mfr?.name?.toLowerCase().includes(k)
  );
  return (
    (mfrKey ? MFR_FALLBACK_COVERS[mfrKey] : null) ||
    CATEGORY_FALLBACK_COVERS[mfr?.category] ||
    CATEGORY_FALLBACK_COVERS.other
  );
}

const SUPPLIER_CARD_HEIGHT = 320;

const DEFAULT_NOVI_UNLOCK_BENEFITS = [
  "Exclusive NOVI member pricing",
  "Device financing programs",
  "Clinical training & certification",
  "Practice marketing support",
];

const ACTIVATE_ACCESS_TRUST_ITEMS = ["No paperwork", "Pre-approved", "Fast approval"];

const EST_MONTHLY_UNIT_COST = 12;

function estimateMonthlySpendFromTreatments(treatmentRecords = []) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = treatmentRecords.filter(
    (r) => r.treatment_date && new Date(r.treatment_date) >= cutoff
  );
  const units = recent.reduce((sum, r) => sum + (Number(r.units_used) || 0), 0);
  const productLines = recent.reduce(
    (sum, r) => sum + (r.products_used?.filter((p) => p.product_name)?.length || 0),
    0
  );
  if (units > 0) return Math.round(units * EST_MONTHLY_UNIT_COST);
  if (productLines > 0) return Math.round(productLines * EST_MONTHLY_UNIT_COST);
  return 0;
}

function getSavedRepContact(savedRep) {
  if (!savedRep?.rep_email) return null;
  return {
    rep_name: savedRep.rep_name?.trim() || "",
    rep_email: savedRep.rep_email,
    rep_phone: savedRep.rep_phone?.trim() || "",
  };
}

function ActivateAccessCTA({ onClick, disabled = false, loading = false, variant = "light", className = "" }) {
  const trustColor = variant === "dark" ? "rgba(255,255,255,0.45)" : "rgba(30,37,53,0.45)";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 font-bold text-base transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          background: "#C8E63C",
          color: "#1e2535",
          borderRadius: 9999,
          boxShadow: "0 4px 16px rgba(200, 230, 60, 0.35)",
        }}
      >
        <Zap className="w-4 h-4 shrink-0" fill="#1e2535" style={{ color: "#1e2535" }} />
        {loading ? "Activating..." : "Activate Access — It's Free"}
      </button>
      <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {ACTIVATE_ACCESS_TRUST_ITEMS.map((item) => (
          <span key={item} className="flex items-center gap-1.5 text-xs" style={{ color: trustColor }}>
            <CheckCircle className="w-3 h-3 shrink-0" style={{ color: "#5a7a20" }} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function SupplierMarketplaceCard({
  mfr,
  applied,
  appStatus,
  onOpen,
}) {
  const photo = getSupplierCoverUrl(mfr);
  const isApproved = applied?.status === "approved";
  const isApplied = !!applied;
  const StatusIcon = appStatus?.icon;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group text-left overflow-hidden w-full bg-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[rgba(30,37,53,0.35)] focus-visible:ring-offset-2"
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 20px rgba(30,37,53,0.14)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 8px 28px rgba(30,37,53,0.18)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(30,37,53,0.14)";
      }}
    >
      <div className="relative h-[148px] overflow-hidden">
        <img
          src={photo}
          alt={`${mfr.name} cover`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />

        {isApproved ? (
          <span
            className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full"
            style={{
              background: "#5a7a20",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.85)",
            }}
          />
        ) : null}

        <button
          type="button"
          aria-label="Save supplier"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white"
          style={{
            background: "rgba(255,255,255,0.82)",
            border: "1px solid rgba(30,37,53,0.08)",
          }}
        >
          <Bookmark className="w-3.5 h-3.5" style={{ color: "rgba(30,37,53,0.45)" }} />
        </button>

        <span
          className="absolute bottom-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full max-w-[75%] truncate"
          style={{
            background: "rgba(30,37,53,0.78)",
            color: "#fff",
            backdropFilter: "blur(8px)",
          }}
          title={CATEGORY_LABELS[mfr.category]}
        >
          {CATEGORY_LABELS[mfr.category]}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3 mb-3.5">
          <SupplierLogo mfr={mfr} size={40} variant="card" className="rounded-[10px] shrink-0" />
          <div className="flex-1 min-w-0 pt-0.5">
            <p
              className="line-clamp-2 leading-tight"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 17,
                color: "#1e2535",
                fontWeight: 400,
              }}
            >
              {mfr.name}
            </p>
            {mfr.products?.length > 0 ? (
              <p
                className="text-xs mt-1 line-clamp-2 leading-relaxed"
                style={{ color: "rgba(30,37,53,0.45)" }}
              >
                {mfr.products.slice(0, 3).join(" · ")}
                {mfr.products.length > 3 ? ` · +${mfr.products.length - 3}` : ""}
              </p>
            ) : mfr.description ? (
              <p
                className="text-xs mt-1 line-clamp-2 leading-relaxed"
                style={{ color: "rgba(30,37,53,0.45)" }}
              >
                {mfr.description}
              </p>
            ) : null}
          </div>
        </div>

        {isApproved ? (
          <div
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl"
            style={{
              background: "rgba(200,230,60,0.12)",
              border: "1px solid rgba(200,230,60,0.35)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: "#5a7a20" }}
            />
            <span className="text-sm font-semibold" style={{ color: "#4a6b10" }}>
              Approved
            </span>
          </div>
        ) : isApplied && appStatus ? (
          <div
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl"
            style={{
              background: appStatus.bg,
              border: `1px solid ${appStatus.border}`,
            }}
          >
            {StatusIcon ? (
              <StatusIcon className="w-3.5 h-3.5 shrink-0" style={{ color: appStatus.color }} />
            ) : null}
            <span className="text-sm font-semibold" style={{ color: appStatus.color }}>
              {appStatus.label}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-opacity hover:opacity-90"
            style={{ background: "#1e2535" }}
          >
            <Zap className="w-4 h-4 shrink-0" style={{ color: "#C8E63C" }} fill="#C8E63C" />
            <span className="text-sm font-bold tracking-wide" style={{ color: "#C8E63C" }}>
              Activate Access
            </span>
          </button>
        )}
      </div>
    </article>
  );
}

function SupplierLogo({ mfr, size = 44, className = "", variant = "default" }) {
  const logo = getSupplierLogoUrl(mfr);
  const col = CATEGORY_COLORS[mfr?.category] || CATEGORY_COLORS.other;
  const initial = mfr?.name?.trim()?.[0]?.toUpperCase() || "S";
  const isCard = variant === "card";

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        background: isCard && !logo ? col.bg : "#fff",
        border: isCard ? `1px solid ${col.border}` : "1px solid rgba(255,255,255,0.9)",
        boxShadow: isCard ? "none" : "0 2px 12px rgba(30,37,53,0.15)",
        borderRadius: isCard ? 10 : undefined,
      }}
    >
      {logo ? (
        <img
          src={logo}
          alt={`${mfr?.name || "Supplier"} logo`}
          className="w-full h-full object-contain p-1.5"
        />
      ) : isCard ? (
        <span
          className="font-bold select-none"
          style={{ color: col.color, fontSize: size * 0.42 }}
        >
          {initial}
        </span>
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: col.bg }}
        >
          <Building2 style={{ color: col.color, width: size * 0.42, height: size * 0.42 }} />
        </div>
      )}
    </div>
  );
}

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

function ApprovedAccountHub({ mfr, me, className = "", layout = "default", applicationId = null }) {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState("order");
  const [orderOpen, setOrderOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [repModalOpen, setRepModalOpen] = useState(false);

  const { data: savedRep } = useQuery({
    queryKey: ["provider-manufacturer-rep", mfr?.id],
    queryFn: () => base44.entities.ProviderManufacturerRep.lookup({ manufacturer_id: mfr.id }),
    enabled: !!mfr?.id,
  });
  const rep = resolveRepDisplay(savedRep, mfr);

  if (!mfr) {
    return (
      <div
        className={`px-3 py-2.5 rounded-xl flex items-center gap-2 ${className}`}
        style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.25)" }}
      >
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#4a6b10" }} />
        <p className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.75)" }}>
          Account active — a rep should have reached out via email to complete setup.
        </p>
      </div>
    );
  }

  const actions = [
    {
      label: layout === "tiles" ? "Place Order" : "Place Order Request",
      icon: Send,
      color: "#FA6F30",
      bg: "rgba(250,111,48,0.1)",
      onClick: () => setOrderOpen(true),
    },
    {
      label: "Schedule Call",
      icon: Calendar,
      color: "#7B8EC8",
      bg: "rgba(123,142,200,0.1)",
      onClick: () => setScheduleOpen(true),
    },
    {
      label: "Message Rep",
      icon: Mail,
      color: "#2D6B7F",
      bg: "rgba(45,107,127,0.1)",
      onClick: () => { setContactType("message"); setContactOpen(true); },
    },
  ];

  return (
    <>
      <div className={className}>
        {layout === "default" && (
          <p className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "#4a6b10", letterSpacing: "0.13em" }}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Account Active — Contact Your Rep
          </p>
        )}

        {layout === "tiles" ? (
          <div className="grid grid-cols-3 gap-3">
            {actions.map(({ label, icon: Icon, color, bg, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="flex flex-col items-center gap-2.5 px-3 py-4 rounded-xl transition-all hover:opacity-90"
                style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.1)", boxShadow: "0 1px 6px rgba(30,37,53,0.05)" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: bg }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-xs font-semibold text-center leading-tight" style={{ color: "#1e2535" }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {actions.map(({ label, icon: Icon, color, bg, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-full transition-all hover:opacity-80"
                style={
                  label.startsWith("Place Order")
                    ? { background: "linear-gradient(135deg, #FA6F30, #e05a20)", color: "#fff", boxShadow: "0 4px 14px rgba(250,111,48,0.3)" }
                    : { background: bg, color, border: `1px solid ${color}33` }
                }
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        )}

        {layout === "default" && rep.rep_email && (
          <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>
            Rep:{" "}
            {rep.rep_name ? (
              <strong style={{ color: "rgba(30,37,53,0.7)" }}>{rep.rep_name}</strong>
            ) : null}
            {rep.rep_name && rep.rep_email ? " · " : null}
            {rep.rep_email}
            {rep.rep_phone ? ` · ${rep.rep_phone}` : null}
          </p>
        )}
      </div>
      <RepContactDialog
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        manufacturer={mfr}
        me={me}
        initialType={contactType}
        savedRep={savedRep}
      />
      <ScheduleCallDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        manufacturer={mfr}
        me={me}
        savedRep={savedRep}
        onAddRepInfo={() => setRepModalOpen(true)}
      />
      <RepInfoModal
        open={repModalOpen}
        onClose={() => setRepModalOpen(false)}
        manufacturer={mfr}
        applicationId={applicationId}
        initialRep={savedRep}
      />
      <OrderRequestDialog
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        manufacturer={mfr}
        me={me}
        savedRep={savedRep}
      />
    </>
  );
}

function MyAccountCard({ app, mfr, me, savedRep }) {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState("order");
  const [orderOpen, setOrderOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [repModalOpen, setRepModalOpen] = useState(false);

  const repContact = getSavedRepContact(savedRep);
  const activityDate = app.approved_at || app.submitted_at;
  const displayDate = activityDate ? format(new Date(activityDate), "MMM d") : "—";

  const actionBtnStyle = (color) => ({
    background: "#fff",
    border: "1px solid rgba(30,37,53,0.12)",
    color,
    boxShadow: "0 1px 4px rgba(30,37,53,0.04)",
  });

  return (
    <>
      <GlassCard style={{ borderRadius: 16, overflow: "hidden" }}>
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            {mfr ? (
              <SupplierLogo mfr={mfr} size={44} variant="card" className="rounded-xl" />
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(30,37,53,0.06)", border: "1px solid rgba(30,37,53,0.1)" }}
              >
                <Building2 className="w-5 h-5" style={{ color: "rgba(30,37,53,0.4)" }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p
                className="font-bold truncate leading-tight"
                style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, color: "#1e2535" }}
              >
                {app.manufacturer_name || mfr?.name}
              </p>
              {mfr && (
                <p className="text-xs mt-0.5 capitalize" style={{ color: "rgba(30,37,53,0.45)" }}>
                  {CATEGORY_LABELS[mfr.category]}
                </p>
              )}
            </div>
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0"
              style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.35)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#5a7a20" }} />
              Active
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOrderOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-85"
              style={actionBtnStyle("#FA6F30")}
            >
              <Send className="w-3.5 h-3.5" style={{ color: "#FA6F30" }} /> Order
            </button>
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-85"
              style={actionBtnStyle("#7B8EC8")}
            >
              <Calendar className="w-3.5 h-3.5" style={{ color: "#7B8EC8" }} /> Schedule
            </button>
            <button
              type="button"
              onClick={() => { setContactType("message"); setContactOpen(true); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-85"
              style={actionBtnStyle("#2D6B7F")}
            >
              <Mail className="w-3.5 h-3.5" style={{ color: "#2D6B7F" }} /> Message
            </button>
            <div className="ml-auto flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: "rgba(30,37,53,0.4)" }}>
              {displayDate}
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {mfr && (
            <button
              type="button"
              onClick={() => setRepModalOpen(true)}
              className="mt-3 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-opacity hover:opacity-90"
              style={
                repContact
                  ? { background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }
                  : { background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.2)" }
              }
            >
              {repContact ? (
                <>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(123,142,200,0.15)" }}
                  >
                    <User className="w-4 h-4" style={{ color: "#7B8EC8" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>
                      {repContact.rep_name || "Your Rep"}
                    </p>
                    <p className="text-xs truncate" style={{ color: "rgba(30,37,53,0.5)" }}>
                      {repContact.rep_email}
                      {repContact.rep_phone ? ` · ${repContact.rep_phone}` : ""}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#FA6F30" }} />
                  <p className="flex-1 text-xs font-medium" style={{ color: "rgba(30,37,53,0.65)" }}>
                    Add your assigned rep&apos;s contact info
                  </p>
                </>
              )}
              <Pencil className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Deactivate your ${app.manufacturer_name} account? Contact NOVI support if you need help.`)) {
                window.alert("To deactivate this account, please contact NOVI support or your manufacturer rep.");
              }
            }}
            className="mt-3 text-[11px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: "#DA6A63" }}
          >
            Deactivate Account
          </button>
        </div>
      </GlassCard>

      {mfr && (
        <>
          <RepContactDialog
            open={contactOpen}
            onClose={() => setContactOpen(false)}
            manufacturer={mfr}
            me={me}
            initialType={contactType}
            savedRep={savedRep}
          />
          <ScheduleCallDialog
            open={scheduleOpen}
            onClose={() => setScheduleOpen(false)}
            manufacturer={mfr}
            me={me}
            savedRep={savedRep}
            onAddRepInfo={() => setRepModalOpen(true)}
          />
          <OrderRequestDialog
            open={orderOpen}
            onClose={() => setOrderOpen(false)}
            manufacturer={mfr}
            me={me}
            savedRep={savedRep}
          />
          <RepInfoModal
            open={repModalOpen}
            onClose={() => setRepModalOpen(false)}
            manufacturer={mfr}
            applicationId={app.id}
            initialRep={savedRep}
          />
        </>
      )}
    </>
  );
}

function UsageActivityCard({ brandRecords, totalUnits, usedLots, manufacturer }) {
  const monthlyCounts = buildMonthlyTreatmentCounts(brandRecords);
  const recentLines = buildRecentTreatmentLines(brandRecords, manufacturer);
  const treatmentCount = brandRecords.length;

  return (
    <GlassCard style={{ borderRadius: 16 }}>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.14em" }}>
            Usage Activity
          </p>
          {treatmentCount > 0 && (
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.25)" }}
            >
              {formatTreatmentCountLabel(treatmentCount)}
            </span>
          )}
        </div>

        {treatmentCount === 0 ? (
          <div className="text-center py-6">
            <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(30,37,53,0.15)" }} />
            <p className="text-sm font-semibold" style={{ color: "rgba(30,37,53,0.55)" }}>No treatments logged yet</p>
            <p className="text-xs mt-1 max-w-xs mx-auto leading-relaxed" style={{ color: "rgba(30,37,53,0.4)" }}>
              As you document treatment records using this supplier&apos;s products, your usage data will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.12em" }}>
              Monthly Treatments
            </p>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {monthlyCounts.map((month) => (
                <div key={month.key} className="text-center">
                  <div className="flex justify-center mb-2.5 px-3">
                    <div
                      className="rounded-full w-full max-w-[72px]"
                      style={{
                        background: month.count > 0 ? "#FA6F30" : "rgba(30,37,53,0.12)",
                        height: month.count > 0 ? 4 : 2,
                        marginTop: month.count > 0 ? 0 : 1,
                      }}
                    />
                  </div>
                  <p className="text-xs font-medium" style={{ color: "rgba(30,37,53,0.55)" }}>{month.label}</p>
                </div>
              ))}
            </div>

            <div
              className="grid grid-cols-3 mb-5"
              style={{ borderTop: "1px solid rgba(30,37,53,0.08)", borderBottom: "1px solid rgba(30,37,53,0.08)" }}
            >
              {[
                { label: "Total Treatments", value: treatmentCount },
                { label: "Units Used", value: totalUnits },
                { label: "Lots Tracked", value: usedLots.size },
              ].map(({ label, value }, index) => (
                <div
                  key={label}
                  className="py-4 text-center"
                  style={index > 0 ? { borderLeft: "1px solid rgba(30,37,53,0.08)" } : undefined}
                >
                  <p className="text-2xl font-bold leading-none" style={{ color: "#1e2535" }}>{value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest mt-2" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.1em" }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.12em" }}>
              Recent Treatments
            </p>
            <div className="space-y-3">
              {recentLines.map((line) => (
                <div key={line.id} className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: "#FA6F30" }} />
                    <p className="text-sm font-medium leading-snug" style={{ color: "#1e2535" }}>{line.product_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold whitespace-nowrap" style={{ color: "#1e2535" }}>
                      {line.units} {line.unit_label}
                    </p>
                    {line.treatment_date && (
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>
                        {format(new Date(line.treatment_date), "MMM d")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}

function ApprovedSupplierDetailView({
  mfr,
  me,
  onBack,
  brandRecords,
  totalUnits,
  usedLots,
}) {
  const col = CATEGORY_COLORS[mfr.category] || CATEGORY_COLORS.other;
  const perks = mfr.benefits?.length > 0 ? mfr.benefits : DEFAULT_NOVI_UNLOCK_BENEFITS;

  const { data: savedRep } = useQuery({
    queryKey: ["provider-manufacturer-rep", mfr?.id],
    queryFn: () => base44.entities.ProviderManufacturerRep.lookup({ manufacturer_id: mfr.id }),
    enabled: !!mfr?.id,
  });
  const rep = resolveRepDisplay(savedRep, mfr);

  return (
    <div className="space-y-4">
      {/* Dark header */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1e2535 0%, #2a3355 100%)", boxShadow: "0 8px 32px rgba(30,37,53,0.18)" }}
      >
        <div className="px-5 pt-4 pb-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Directory
            </button>
            <span
              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
              style={{ background: "rgba(200,230,60,0.12)", color: "#C8E63C", border: "1px solid rgba(200,230,60,0.3)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#C8E63C", boxShadow: "0 0 6px rgba(200,230,60,0.7)" }} />
              Account Active
            </span>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <SupplierLogo mfr={mfr} size={56} className="rounded-xl" />
            <div className="min-w-0">
              <h2
                className="truncate"
                style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#fff", lineHeight: 1.15, fontWeight: 400 }}
              >
                {mfr.name}
              </h2>
              <span
                className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1.5 capitalize"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                {CATEGORY_LABELS[mfr.category]}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Treatments", value: brandRecords.length || "—" },
              { label: "Units Used", value: totalUnits || "—" },
              { label: "Lots Tracked", value: usedLots.size || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center py-2">
                <p className="text-lg font-bold" style={{ color: "#fff" }}>{value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action tiles */}
      <ApprovedAccountHub mfr={mfr} me={me} layout="tiles" />

      <UpcomingRepCalls manufacturerId={mfr.id} />

      {/* Account rep */}
      {rep.rep_email && (
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.08)" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(123,142,200,0.15)" }}
          >
            <Headphones className="w-4 h-4" style={{ color: "#7B8EC8" }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)", letterSpacing: "0.12em" }}>
              Your Account Rep
            </p>
            {rep.rep_name && (
              <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>{rep.rep_name}</p>
            )}
            <p className="text-xs truncate" style={{ color: "rgba(30,37,53,0.5)" }}>{rep.rep_email}</p>
            {rep.rep_phone ? (
              <p className="text-xs truncate" style={{ color: "rgba(30,37,53,0.45)" }}>{rep.rep_phone}</p>
            ) : null}
          </div>
        </div>
      )}

      {/* Usage activity */}
      <UsageActivityCard
        brandRecords={brandRecords}
        totalUnits={totalUnits}
        usedLots={usedLots}
        manufacturer={mfr}
      />

      {/* Product portfolio */}
      <GlassCard style={{ borderRadius: 16 }}>
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.14em" }}>
              Product Portfolio
            </p>
            {mfr.products?.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}` }}>
                {mfr.products.length} product{mfr.products.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {mfr.products?.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {mfr.products.map((p, i) => (
                <span
                  key={i}
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}` }}
                >
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs mb-5" style={{ color: "rgba(30,37,53,0.4)" }}>No products listed.</p>
          )}

          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.14em" }}>
            Key Benefits
          </p>
          <div className="space-y-2 mb-4">
            {perks.map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#5a7a20" }} />
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>{b}</p>
              </div>
            ))}
          </div>

          {mfr.website_url && (
            <a
              href={mfr.website_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
              style={{ color: "#7B8EC8" }}
            >
              <Globe className="w-3.5 h-3.5" /> Visit Website <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Supplier Detail Panel ───────────────────────────────────────────────────
function SupplierDetailView({ mfr, onBack, onApply, application, me, treatmentRecords = [], certifications = [] }) {
  const col = CATEGORY_COLORS[mfr.category] || CATEGORY_COLORS.other;
  const app = application;
  const statusCfg = app ? (APP_STATUS_CONFIG[app.status] || APP_STATUS_CONFIG.pending) : null;
  const isApproved = app?.status === "approved";

  const { brandRecords, totalUnits, usedLots } = buildSupplierUsageStats(treatmentRecords, mfr);

  const heroPhoto = getSupplierCoverUrl(mfr);
  const uploadedCover = hasUploadedCover(mfr);

  if (isApproved) {
    return (
      <ApprovedSupplierDetailView
        mfr={mfr}
        me={me}
        onBack={onBack}
        brandRecords={brandRecords}
        totalUnits={totalUnits}
        usedLots={usedLots}
      />
    );
  }

  return (
    <div className="space-y-0">
      {/* Hero Banner */}
      <div className="relative overflow-hidden" style={{ borderRadius: "20px 20px 0 0", height: 240 }}>
        <img
          src={heroPhoto}
          alt={`${mfr.name} cover`}
          className="absolute inset-0 w-full h-full object-cover"
          style={uploadedCover ? undefined : { filter: "brightness(0.88)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: uploadedCover
              ? "linear-gradient(180deg, rgba(8,10,20,0.15) 0%, rgba(8,10,20,0.55) 55%, rgba(8,10,20,0.88) 100%)"
              : "linear-gradient(180deg, rgba(8,10,20,0.25) 0%, rgba(8,10,20,0.75) 100%)",
          }}
        />
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
        {/* Logo + name over hero */}
        <div className="absolute bottom-5 left-5 right-5 flex items-end gap-4">
          <SupplierLogo mfr={mfr} size={64} className="rounded-2xl" />
          <div className="flex-1 min-w-0 pb-0.5">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full mb-2 inline-block capitalize"
              style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
              {CATEGORY_LABELS[mfr.category]}
            </span>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#fff", lineHeight: 1.1, fontWeight: 400 }}>{mfr.name}</h2>
          </div>
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

          {!app && (
            <ActivateAccessCTA onClick={onApply} className="mt-5" />
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

        {/* What You Unlock */}
        <div className="mx-6 my-5 overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(30,37,53,0.08)", boxShadow: "0 2px 12px rgba(30,37,53,0.06)" }}>
          <div className="flex items-start justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(135deg, #1e2535 0%, #2a3355 100%)" }}>
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#C8E63C", letterSpacing: "0.14em" }}>
                What You Unlock
              </p>
              <p style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 20, color: "#fff", lineHeight: 1.2 }}>
                Exclusive NOVI benefits
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-1" style={{ color: "rgba(255,255,255,0.35)" }} />
          </div>
          <div className="px-5 py-4" style={{ background: "#fff" }}>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {DEFAULT_NOVI_UNLOCK_BENEFITS.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(200,230,60,0.2)" }}>
                    <CheckCircle className="w-2.5 h-2.5" style={{ color: "#5a7a20" }} />
                  </div>
                  <p className="text-sm" style={{ color: "rgba(30,37,53,0.75)" }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
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
        <div className="mt-4 rounded-2xl overflow-hidden px-6 py-8 text-center" style={{ background: "linear-gradient(135deg, #1e2535 0%, #2a3355 100%)", boxShadow: "0 8px 32px rgba(30,37,53,0.12)" }}>
          <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: "#C8E63C", letterSpacing: "0.14em" }}>
            Ready to get started?
          </p>
          <p className="mb-6" style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 24, color: "#fff", lineHeight: 1.25 }}>
            Get access to {mfr.name} through NOVI
          </p>
          <ActivateAccessCTA onClick={onApply} variant="dark" />
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
  const [lastApplication, setLastApplication] = useState(null);
  const [myAccountsSubview, setMyAccountsSubview] = useState("accounts");
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

  const { data: mdSubs = [] } = useQuery({
    queryKey: ["my-md-subscriptions-mktplace"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: u.id });
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

  const { data: savedReps = [] } = useQuery({
    queryKey: ["provider-manufacturer-reps"],
    queryFn: () => base44.entities.ProviderManufacturerRep.list(),
    enabled: !!me,
  });

  const submitMutation = useMutation({
    mutationFn: () => base44.functions.invoke("sendManufacturerInquiry", {
      manufacturer_id: selectedManufacturer.id,
      form_data: formData,
    }),
    onSuccess: (res) => {
      setSubmitted(true);
      setLastApplication(res?.data?.application || null);
      qc.invalidateQueries({ queryKey: ["my-manufacturer-applications"] });
    },
  });

  const verifiedLicense = licenses[0] || {};
  const mdRel = mdRels[0] || {};
  const activeMdSubs = mdSubs.filter((sub) => sub.status === "active");

  const formatPracticeAddress = () =>
    [me?.address_line1, me?.address_line2, [me?.city, me?.state].filter(Boolean).join(", "), me?.zip]
      .filter(Boolean)
      .join(" ")
      .trim();

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
      practice_name: me?.practice_name || me?.full_name || "",
      practice_address: formatPracticeAddress() || me?.address || "",
      practice_phone: me?.phone || "",
      additional_fields: {
        md_coverage:
          activeMdSubs.length > 0
            ? activeMdSubs.map((sub) => sub.service_type_name).filter(Boolean).join("; ")
            : "",
        certifications_summary: certifications
          .filter((cert) => cert.status === "active")
          .map((cert) => cert.certification_name || cert.course_title)
          .filter(Boolean)
          .join("; "),
      },
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
  const savedRepByMfrId = Object.fromEntries(savedReps.map((r) => [r.manufacturer_id, r]));
  const activeCategories = Object.keys(CATEGORY_LABELS).filter(c => grouped[c]?.length > 0);

  const approvedCount = myApplications.filter(a => a.status === "approved").length;
  const pendingCount = myApplications.filter(a => ["submitted", "pending", "under_review", "more_info_needed"].includes(a.status)).length;
  const approvedApplications = myApplications
    .filter((a) => a.status === "approved")
    .sort((a, b) => (a.manufacturer_name || "").localeCompare(b.manufacturer_name || ""));
  const estMonthlySpend = estimateMonthlySpendFromTreatments(treatmentRecords);
  const activeProgressPct = manufacturers.length
    ? Math.min(100, Math.round((approvedCount / manufacturers.length) * 100))
    : 0;

  const pageContent = (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#7B8EC8", letterSpacing: "0.14em" }}>Provider Marketplace</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.2 }}>Supplier Network</h1>
        </div>
        <div className="flex flex-col items-end gap-1.5 min-w-[120px]">
          <p className="text-sm font-bold whitespace-nowrap" style={{ color: "#4a6b10" }}>
            {approvedCount}/{manufacturers.length} active
          </p>
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(30,37,53,0.08)", maxWidth: 140 }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${activeProgressPct}%`, background: "#C8E63C" }}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="suppliers">
        <TabsList className="mb-2 w-full overflow-x-auto flex" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: 12 }}>
          <TabsTrigger value="suppliers" className="gap-1.5 flex-1 text-xs sm:text-sm whitespace-nowrap"><Building2 className="w-3.5 h-3.5 hidden sm:block" /> Supplier Network</TabsTrigger>
          <TabsTrigger value="applications" className="gap-1.5 flex-1 text-xs sm:text-sm whitespace-nowrap">
            <CheckCircle className="w-3.5 h-3.5 hidden sm:block" /> My Accounts
            {approvedCount > 0 && (
              <span className="ml-1 text-xs font-semibold" style={{ color: "rgba(30,37,53,0.5)" }}>· {approvedCount} Active</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── MY ACCOUNTS TAB ── */}
        <TabsContent value="applications">
          <div className="space-y-4">
            <div
              className="inline-flex p-1 rounded-xl"
              style={{ background: "rgba(30,37,53,0.06)", border: "1px solid rgba(30,37,53,0.08)" }}
            >
              {[
                { key: "accounts", label: "Accounts" },
                { key: "inventory", label: "Inventory" },
              ].map(({ key, label }) => {
                const active = myAccountsSubview === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMyAccountsSubview(key)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: active ? "#fff" : "transparent",
                      color: active ? "#1e2535" : "rgba(30,37,53,0.5)",
                      boxShadow: active ? "0 1px 6px rgba(30,37,53,0.08)" : "none",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {myAccountsSubview === "inventory" ? (
              <ProviderInventoryTab
                me={me}
                myApplications={approvedApplications}
                manufacturers={manufacturers}
              />
            ) : approvedApplications.length === 0 ? (
              <GlassCard className="py-16 text-center">
                <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
                <p className="font-semibold" style={{ color: "#1e2535" }}>No active accounts yet</p>
                <p className="text-xs mt-1 mb-4" style={{ color: "rgba(30,37,53,0.5)" }}>
                  {pendingCount > 0
                    ? `${pendingCount} application${pendingCount > 1 ? "s" : ""} awaiting approval.`
                    : "Apply to a supplier from the directory to get started."}
                </p>
              </GlassCard>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.08)", boxShadow: "0 1px 8px rgba(30,37,53,0.04)" }}>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(200,230,60,0.15)", border: "1px solid rgba(200,230,60,0.3)" }}
                    >
                      <CheckCircle className="w-5 h-5" style={{ color: "#4a6b10" }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.45)" }}>Active Accounts</p>
                      <p className="text-2xl font-bold leading-tight mt-0.5" style={{ color: "#1e2535" }}>
                        {approvedCount}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                        {myApplications.length} total applied
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.08)", boxShadow: "0 1px 8px rgba(30,37,53,0.04)" }}>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(123,142,200,0.12)", border: "1px solid rgba(123,142,200,0.25)" }}
                    >
                      <DollarSign className="w-5 h-5" style={{ color: "#7B8EC8" }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.45)" }}>Est. Monthly</p>
                      <p className="text-2xl font-bold leading-tight mt-0.5" style={{ color: "#1e2535" }}>
                        {estMonthlySpend > 0 ? `$${estMonthlySpend.toLocaleString()}` : "—"}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                        based on treatment logs
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {approvedApplications.map((app) => {
                    const mfr = manufacturers.find((m) => m.id === app.manufacturer_id);
                    const savedRep = savedRepByMfrId[app.manufacturer_id];
                    return (
                      <MyAccountCard
                        key={app.id}
                        app={app}
                        mfr={mfr}
                        me={me}
                        savedRep={savedRep}
                      />
                    );
                  })}
                </div>
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
                      <div className="py-8 px-6">
                        <div className="text-center mb-6">
                          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(200,230,60,0.2)" }}>
                            <CheckCircle className="w-7 h-7" style={{ color: "#5a7a20" }} />
                          </div>
                          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#1e2535" }}>Account Activated!</h2>
                          <p className="text-sm mt-2" style={{ color: "rgba(30,37,53,0.6)", maxWidth: 380, margin: "8px auto 0" }}>
                            Your <strong>{selectedManufacturer?.name}</strong> credentials have been sent to their rep team — expect outreach within 1–2 business days.
                          </p>
                        </div>

                        <SaveRepContactForm
                          manufacturer={selectedManufacturer}
                          applicationId={lastApplication?.id}
                          onSaved={() => {
                            setTimeout(() => {
                              setViewMode("directory");
                              setSelectedManufacturer(null);
                              setSubmitted(false);
                              setLastApplication(null);
                            }, 1200);
                          }}
                          onSkip={() => {
                            setViewMode("directory");
                            setSelectedManufacturer(null);
                            setSubmitted(false);
                            setLastApplication(null);
                          }}
                        />

                        <div className="mt-6 text-center">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setViewMode("directory");
                              setSelectedManufacturer(null);
                              setSubmitted(false);
                              setLastApplication(null);
                            }}
                          >
                            Back to Marketplace
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  ) : (
                    <GlassCard>
                      <div className="p-5 space-y-4">
                        <div className="text-center pb-1">
                          <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#1e2535" }}>
                            Activate {selectedManufacturer.name}
                          </h3>
                          <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                            Your credentials will be forwarded automatically
                          </p>
                        </div>

                        <div className="rounded-xl px-4 py-3 space-y-2.5" style={{ background: "rgba(30,37,53,0.02)", border: "1px solid rgba(30,37,53,0.08)" }}>
                          <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.12em" }}>
                            Submitting on your behalf
                          </p>
                          {[
                            { label: "Name", value: me?.full_name || "—" },
                            {
                              label: "License",
                              value: [formData.license_type, formData.license_number, formData.license_state].filter(Boolean).join(" - ") || "—",
                            },
                            {
                              label: "MD Coverage",
                              value: formData.additional_fields?.md_coverage || activeMdSubs.map((sub) => sub.service_type_name).filter(Boolean).join(", ") || "—",
                            },
                            { label: "Supervising MD", value: formData.supervising_physician_name || "—" },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-center gap-2.5">
                              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#5a7a20" }} />
                              <p className="text-sm" style={{ color: "rgba(30,37,53,0.75)" }}>
                                <span className="font-semibold" style={{ color: "#1e2535" }}>{label}:</span> {value}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.25)" }}>
                          <p className="text-xs font-medium leading-relaxed" style={{ color: "rgba(30,37,53,0.7)" }}>
                            NOVI-verified providers are prioritized — typically approved in 2–3 business days vs. 1–2 weeks standard.
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-black uppercase tracking-widest mb-2.5" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.12em" }}>
                            What You Unlock
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {DEFAULT_NOVI_UNLOCK_BENEFITS.map((item, i) => (
                              <span
                                key={i}
                                className="text-xs font-medium px-3 py-1.5 rounded-full"
                                style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.3)" }}
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button variant="outline" className="flex-1 h-11" onClick={() => setViewMode("detail")}>Cancel</Button>
                          <button
                            type="button"
                            className="flex-1 h-11 flex items-center justify-center gap-2 font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                            style={{
                              background: "#C8E63C",
                              color: "#1e2535",
                              borderRadius: 9999,
                              boxShadow: "0 4px 16px rgba(200, 230, 60, 0.35)",
                            }}
                            onClick={() => submitMutation.mutate()}
                            disabled={submitMutation.isPending}
                          >
                            <Zap className="w-4 h-4 shrink-0" fill="#1e2535" style={{ color: "#1e2535" }} />
                            {submitMutation.isPending ? "Activating..." : "Activate Access — It's Free"}
                          </button>
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
                    {[{ key: "all", label: "All" }, ...Object.keys(CATEGORY_LABELS).map(k => ({ key: k, label: CATEGORY_LABELS[k] }))].map(({ key, label }) => {
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
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <div key={i} className="rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.5)", height: SUPPLIER_CARD_HEIGHT }} />)}</div>
                ) : filtered.length === 0 ? (
                  <div className="py-20 text-center rounded-2xl" style={{ background: "#fff", border: "1.5px solid rgba(30,37,53,0.07)" }}>
                    <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.15)" }} />
                    <p className="font-semibold" style={{ color: "#1e2535" }}>No suppliers found</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.map((mfr) => {
                      const applied = existingAppMap[mfr.id];
                      const appStatus = applied
                        ? APP_STATUS_CONFIG[applied.status] || APP_STATUS_CONFIG.pending
                        : null;
                      return (
                        <SupplierMarketplaceCard
                          key={mfr.id}
                          mfr={mfr}
                          applied={applied}
                          appStatus={appStatus}
                          onOpen={() => openDetail(mfr)}
                        />
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