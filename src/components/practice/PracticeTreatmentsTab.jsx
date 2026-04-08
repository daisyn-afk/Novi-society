import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Save, CheckCircle, Lock, Eye, EyeOff, ShieldCheck, Clock, DollarSign,
  ChevronDown, ChevronUp, Syringe, Sparkles, Star, Info, Plus, X, Gift, Package, Tag
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

const GLASS = {
  background: "rgba(255,255,255,0.5)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
};

const GLASS_INPUT = {
  background: "rgba(255,255,255,0.6)",
  border: "1px solid rgba(30,37,53,0.12)",
  color: "#1e2535",
};

const categoryLabel = {
  injectables: "Injectables", fillers: "Fillers", laser: "Laser",
  skincare: "Skincare", body_contouring: "Body Contouring", prp: "PRP", other: "Other",
};

// Services that should be split into sub-services
const INJECTABLE_SPLITS = [
  {
    key: "tox",
    label: "Neurotoxin (Botox / Dysport / Xeomin)",
    icon: Syringe,
    defaultDescription: "Precision neurotoxin treatments to smooth fine lines and wrinkles. I use only FDA-approved products tailored to your facial anatomy.",
    pricingHints: ["Per unit", "Per area", "Flat fee"],
    defaultDuration: 30,
    popularAreas: ["Forehead", "Glabella (11s)", "Crow's feet", "Brow lift", "Bunny lines", "Lip flip", "Chin dimpling", "Neck bands"],
  },
  {
    key: "filler",
    label: "Dermal Filler",
    icon: Sparkles,
    defaultDescription: "Hyaluronic acid filler treatments to restore volume, define contours, and enhance natural features.",
    pricingHints: ["Per syringe", "Per area", "Package price"],
    defaultDuration: 45,
    popularAreas: ["Lips", "Nasolabial folds", "Cheeks", "Under-eye (tear trough)", "Jawline", "Chin", "Temples", "Marionette lines"],
  },
];

function TagInput({ values = [], onChange, placeholder, suggestions = [] }) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const add = (val) => {
    const trimmed = val.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const remove = (i) => onChange(values.filter((_, idx) => idx !== i));

  const filtered = suggestions.filter(s => !values.includes(s) && s.toLowerCase().includes(input.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: "rgba(123,142,200,0.15)", color: "#4a5f9a", border: "1px solid rgba(123,142,200,0.25)" }}>
            {v}
            <button onClick={() => remove(i)} className="hover:opacity-60"><X className="w-2.5 h-2.5" /></button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={e => { if (e.key === "Enter" && input) { e.preventDefault(); add(input); } }}
          placeholder={placeholder}
          className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
          style={GLASS_INPUT}
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden shadow-lg" style={{ background: "rgba(255,255,255,0.97)", border: "1px solid rgba(30,37,53,0.1)" }}>
            {filtered.slice(0, 6).map(s => (
              <button key={s} onMouseDown={() => add(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors" style={{ color: "#1e2535" }}>
                <Plus className="inline w-3 h-3 mr-1.5 opacity-50" />{s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubServiceCard({ sub, data, onChange }) {
  const Icon = sub.icon;
  const [expanded, setExpanded] = useState(true);

  const isLive = data.is_live ?? false;
  const update = (field, val) => onChange({ ...data, [field]: val });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ ...GLASS, border: isLive ? "1.5px solid rgba(200,230,60,0.45)" : "1px solid rgba(255,255,255,0.75)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)", background: "rgba(255,255,255,0.3)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(123,142,200,0.12)" }}>
            <Icon className="w-3.5 h-3.5" style={{ color: "#7B8EC8" }} />
          </div>
          <p className="font-bold text-sm" style={{ color: "#1e2535" }}>{sub.label}</p>
          {isLive && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }}>
              <Eye className="w-3 h-3" />Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-0.5">
            <Switch checked={isLive} onCheckedChange={val => update("is_live", val)} />
            <span className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>{isLive ? "Live" : "Hidden"}</span>
          </div>
          <button onClick={() => setExpanded(e => !e)} className="p-1 rounded-lg hover:bg-black/5 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-5 space-y-5">
          {/* Pricing & Duration */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Pricing & Duration</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1" style={{ color: "rgba(30,37,53,0.55)" }}>
                  <DollarSign className="w-3 h-3" />Starting Price ($)
                </label>
                <input type="number" placeholder="e.g. 300" value={data.price || ""} onChange={e => update("price", e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1" style={{ color: "rgba(30,37,53,0.55)" }}>
                  <DollarSign className="w-3 h-3" />Max Price ($) <span className="font-normal opacity-60">(optional)</span>
                </label>
                <input type="number" placeholder="e.g. 800" value={data.price_max || ""} onChange={e => update("price_max", e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1" style={{ color: "rgba(30,37,53,0.55)" }}>
                  <Clock className="w-3 h-3" />Duration (min)
                </label>
                <input type="number" placeholder={String(sub.defaultDuration)} value={data.duration_minutes || ""} onChange={e => update("duration_minutes", e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
              </div>
            </div>
            {/* Pricing model */}
            <div className="mt-3 space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.55)" }}>Pricing Model</label>
              <div className="flex gap-2 flex-wrap">
                {sub.pricingHints.map(hint => (
                  <button key={hint} onClick={() => update("pricing_model", hint)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                    style={data.pricing_model === hint
                      ? { background: "#FA6F30", color: "#fff", border: "1px solid #FA6F30" }
                      : { background: "rgba(255,255,255,0.65)", color: "#1e2535", border: "1px solid rgba(30,37,53,0.12)" }}>
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Your Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.55)" }}>
              Your Service Description <span className="font-normal opacity-60">(shown on your public profile)</span>
            </label>
            <textarea
              rows={3}
              placeholder={sub.defaultDescription}
              value={data.custom_description || ""}
              onChange={e => update("custom_description", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={GLASS_INPUT}
            />
          </div>

          {/* Areas Treated */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.55)" }}>
              Areas You Treat <span className="font-normal opacity-60">(type or select)</span>
            </label>
            <TagInput
              values={data.areas_offered || []}
              onChange={val => update("areas_offered", val)}
              placeholder="Type an area and press Enter…"
              suggestions={sub.popularAreas}
            />
          </div>

          {/* Products / Brands */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.55)" }}>
              Products & Brands You Use <span className="font-normal opacity-60">(builds trust with patients)</span>
            </label>
            <input
              placeholder="e.g. Botox, Dysport, Juvéderm, Restylane…"
              value={data.products_used || ""}
              onChange={e => update("products_used", e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
              style={GLASS_INPUT}
            />
          </div>

          {/* What to Expect / Consultation Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.55)" }}>
              What Patients Can Expect <span className="font-normal opacity-60">(consultation style, what's included, etc.)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Every treatment begins with a thorough facial assessment and custom dosing plan…"
              value={data.what_to_expect || ""}
              onChange={e => update("what_to_expect", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={GLASS_INPUT}
            />
          </div>

          {/* Highlights / Selling Points */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1" style={{ color: "rgba(30,37,53,0.55)" }}>
              <Star className="w-3 h-3" />Key Highlights <span className="font-normal opacity-60">(shown as bullet points on your profile)</span>
            </label>
            <TagInput
              values={data.highlights || []}
              onChange={val => update("highlights", val)}
              placeholder="e.g. Natural-looking results, Free touch-up within 2 weeks…"
              suggestions={[
                "Free 2-week touch-up", "Natural-looking results", "Baby Botox available",
                "Conservative approach", "Premium products only", "Complimentary consultation",
                "Same-day appointments available", "Before & after photos provided",
              ]}
            />
          </div>

          {/* Internal note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>
              <Info className="w-3 h-3" />Internal Note <span className="font-normal opacity-60">(private — not shown to patients)</span>
            </label>
            <input
              placeholder="Notes for yourself or your team…"
              value={data.internal_note || ""}
              onChange={e => update("internal_note", e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
              style={GLASS_INPUT}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StandardServiceCard({ st, data, onChange }) {
  const [expanded, setExpanded] = useState(true);
  const isLive = data.is_live ?? false;
  const update = (field, val) => onChange({ ...data, [field]: val });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ ...GLASS, border: isLive ? "1.5px solid rgba(200,230,60,0.45)" : "1px solid rgba(255,255,255,0.75)" }}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)", background: "rgba(255,255,255,0.3)" }}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <p className="font-bold text-sm" style={{ color: "#1e2535" }}>{st.name}</p>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.2)" }}>
            {categoryLabel[st.category] || st.category}
          </span>
          {isLive && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }}>
              <Eye className="w-3 h-3" />Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-0.5">
            <Switch checked={isLive} onCheckedChange={val => update("is_live", val)} />
            <span className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>{isLive ? "Live" : "Hidden"}</span>
          </div>
          <button onClick={() => setExpanded(e => !e)} className="p-1 rounded-lg hover:bg-black/5 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-5 space-y-5">
          {st.description && <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.5)" }}>{st.description}</p>}

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1" style={{ color: "rgba(30,37,53,0.55)" }}><DollarSign className="w-3 h-3" />Starting Price ($)</label>
              <input type="number" placeholder="e.g. 500" value={data.price || ""} onChange={e => update("price", e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1" style={{ color: "rgba(30,37,53,0.55)" }}><DollarSign className="w-3 h-3" />Max Price ($) <span className="font-normal opacity-60">(opt.)</span></label>
              <input type="number" placeholder="optional" value={data.price_max || ""} onChange={e => update("price_max", e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1" style={{ color: "rgba(30,37,53,0.55)" }}><Clock className="w-3 h-3" />Duration (min)</label>
              <input type="number" placeholder="60" value={data.duration_minutes || ""} onChange={e => update("duration_minutes", e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.55)" }}>Your Service Description</label>
            <textarea rows={3} placeholder="Describe how you perform this service and what makes your approach unique…"
              value={data.custom_description || ""} onChange={e => update("custom_description", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={GLASS_INPUT} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.55)" }}>Products & Brands You Use</label>
            <input placeholder="e.g. Sculptra, Radiesse, Kybella…" value={data.products_used || ""} onChange={e => update("products_used", e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1" style={{ color: "rgba(30,37,53,0.55)" }}>
              <Star className="w-3 h-3" />Key Highlights
            </label>
            <TagInput values={data.highlights || []} onChange={val => update("highlights", val)}
              placeholder="e.g. Minimal downtime, Personalized treatment plan…"
              suggestions={["Natural results", "Minimal downtime", "Free consultation", "Complimentary follow-up", "Premium devices only"]} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>
              <Info className="w-3 h-3" />Internal Note <span className="font-normal opacity-60">(private)</span>
            </label>
            <input placeholder="Notes for yourself or your team…" value={data.internal_note || ""} onChange={e => update("internal_note", e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
          </div>
        </div>
      )}
    </div>
  );
}

// Detects if a service type is the combined injectable (tox + filler)
function isInjectableBundle(st) {
  return st.category === "injectables" || st.name?.toLowerCase().includes("neurotoxin") || st.name?.toLowerCase().includes("injectable");
}

const PACKAGE_TYPES = [
  { value: "bundle", label: "Bundle", icon: Package, desc: "e.g. 3 sessions for a flat price" },
  { value: "reward", label: "Loyalty Reward", icon: Gift, desc: "e.g. 10th visit free, referral discount" },
  { value: "promo", label: "Promo / Discount", icon: Tag, desc: "e.g. New patient special, seasonal offer" },
];

const EMPTY_PACKAGE = { type: "bundle", title: "", description: "", price: "", original_price: "", sessions: "", is_active: true };

function PackagesRewardsSection({ packages, onChange }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_PACKAGE);
  const [editIndex, setEditIndex] = useState(null);

  const startEdit = (i) => { setForm(packages[i]); setEditIndex(i); setAdding(true); };
  const cancel = () => { setForm(EMPTY_PACKAGE); setEditIndex(null); setAdding(false); };

  const save = () => {
    if (!form.title) return;
    if (editIndex !== null) {
      const updated = [...packages];
      updated[editIndex] = form;
      onChange(updated);
    } else {
      onChange([...packages, form]);
    }
    cancel();
  };

  const remove = (i) => onChange(packages.filter((_, idx) => idx !== i));
  const toggle = (i) => { const updated = [...packages]; updated[i] = { ...updated[i], is_active: !updated[i].is_active }; onChange(updated); };

  const TypeIcon = PACKAGE_TYPES.find(t => t.value === form.type)?.icon || Package;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.5)" }}>Packages, Bundles & Rewards</p>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all"
            style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.3)" }}>
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {packages.length === 0 && !adding && (
        <div className="rounded-2xl px-5 py-8 text-center" style={{ background: "rgba(255,255,255,0.5)", border: "1px dashed rgba(30,37,53,0.15)" }}>
          <Gift className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(30,37,53,0.2)" }} />
          <p className="text-sm font-semibold" style={{ color: "rgba(30,37,53,0.45)" }}>No packages or rewards yet</p>
          <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.3)" }}>Add bundles, loyalty rewards, and promos to attract and retain patients.</p>
        </div>
      )}

      {/* Existing packages */}
      {packages.map((pkg, i) => {
        const PIcon = PACKAGE_TYPES.find(t => t.value === pkg.type)?.icon || Package;
        return (
          <div key={i} className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.7)", border: pkg.is_active ? "1.5px solid rgba(200,230,60,0.4)" : "1px solid rgba(30,37,53,0.08)" }}>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(123,142,200,0.12)" }}>
                <PIcon className="w-4 h-4" style={{ color: "#7B8EC8" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{pkg.title}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.18)" }}>
                    {PACKAGE_TYPES.find(t => t.value === pkg.type)?.label}
                  </span>
                  {pkg.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }}>Live</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {pkg.price && <span className="text-xs font-bold" style={{ color: "#FA6F30" }}>${pkg.price}</span>}
                  {pkg.original_price && <span className="text-xs line-through" style={{ color: "rgba(30,37,53,0.35)" }}>${pkg.original_price}</span>}
                  {pkg.sessions && <span className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>{pkg.sessions} sessions</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch checked={pkg.is_active} onCheckedChange={() => toggle(i)} />
                <button onClick={() => startEdit(i)} className="text-xs px-2.5 py-1 rounded-lg hover:bg-black/5" style={{ color: "rgba(30,37,53,0.5)" }}>Edit</button>
                <button onClick={() => remove(i)} className="hover:text-red-400" style={{ color: "rgba(30,37,53,0.25)" }}><X className="w-4 h-4" /></button>
              </div>
            </div>
            {pkg.description && (
              <div className="px-4 pb-3">
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{pkg.description}</p>
              </div>
            )}
          </div>
        );
      })}

      {/* Add / Edit form */}
      {adding && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.85)", border: "1.5px solid rgba(123,142,200,0.3)", boxShadow: "0 4px 16px rgba(30,37,53,0.08)" }}>
          <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(30,37,53,0.07)", background: "rgba(123,142,200,0.06)" }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>{editIndex !== null ? "Edit" : "New"} Package / Reward</p>
          </div>
          <div className="px-5 py-5 space-y-4">
            {/* Type selector */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "rgba(30,37,53,0.55)" }}>Type</p>
              <div className="flex gap-2 flex-wrap">
                {PACKAGE_TYPES.map(t => (
                  <button key={t.value} onClick={() => setForm(p => ({ ...p, type: t.value }))}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                    style={form.type === t.value
                      ? { background: "#7B8EC8", color: "#fff" }
                      : { background: "rgba(255,255,255,0.65)", color: "#1e2535", border: "1px solid rgba(30,37,53,0.12)" }}>
                    <t.icon className="w-3 h-3" />{t.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: "rgba(30,37,53,0.4)" }}>{PACKAGE_TYPES.find(t => t.value === form.type)?.desc}</p>
            </div>
            {/* Title */}
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>Title *</p>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. 3-Session Botox Bundle, New Patient Special…"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
            </div>
            {/* Description */}
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>Description <span className="font-normal opacity-60">(shown to patients)</span></p>
              <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="What's included? Any terms or conditions?"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={GLASS_INPUT} />
            </div>
            {/* Pricing & sessions */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>Package Price ($)</p>
                <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>Original Price ($) <span className="font-normal opacity-60">(opt)</span></p>
                <input type="number" value={form.original_price} onChange={e => setForm(p => ({ ...p, original_price: e.target.value }))}
                  placeholder="e.g. 600"
                  className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>Sessions / Uses <span className="font-normal opacity-60">(opt)</span></p>
                <input type="number" value={form.sessions} onChange={e => setForm(p => ({ ...p, sessions: e.target.value }))}
                  placeholder="e.g. 3"
                  className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={GLASS_INPUT} />
              </div>
            </div>
            {/* Active toggle */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.1)" }}>
              <Switch checked={form.is_active} onCheckedChange={val => setForm(p => ({ ...p, is_active: val }))} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Show on my profile</p>
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Patients will see this package when viewing your services</p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={save} disabled={!form.title} style={{ background: "#FA6F30", color: "#fff" }} size="sm" className="font-bold">
                {editIndex !== null ? "Save Changes" : "Add Package"}
              </Button>
              <Button onClick={cancel} variant="outline" size="sm">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PracticeTreatmentsTab({ me, serviceTypes, activeServiceIds, mdSubs, onSave, saving, saved }) {
  const [offerings, setOfferings] = useState({});
  const [packages, setPackages] = useState([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (me && !initialized) {
      setOfferings(me.service_offerings_v2 || {});
      setPackages(me.practice_packages || []);
      setInitialized(true);
    }
  }, [me, initialized]);

  const updateOffering = (key, data) => {
    setOfferings(prev => ({ ...prev, [key]: data }));
  };

  const activeSubs = serviceTypes.filter(st => activeServiceIds.has(st.id));
  const inactiveSubs = serviceTypes.filter(st => !activeServiceIds.has(st.id) && st.is_active !== false);

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="flex items-start gap-3 px-5 py-4 rounded-2xl" style={{ background: "rgba(123,142,200,0.1)", border: "1px solid rgba(123,142,200,0.25)" }}>
        <ShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#7B8EC8" }} />
        <div>
          <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>Your treatments are tied to your active MD coverage</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.55)" }}>
            Only services with active MD coverage can be made live. Customize each service to attract more patients.
          </p>
        </div>
      </div>

      {/* Active services */}
      {activeSubs.length === 0 ? (
        <div className="py-14 text-center px-6 rounded-2xl" style={GLASS}>
          <ShieldCheck className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
          <p className="font-semibold" style={{ color: "#1e2535" }}>No active MD coverage yet</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "rgba(30,37,53,0.5)" }}>Activate MD coverage on the Credentials & Coverage page to unlock your treatment menu.</p>
          <Link to={createPageUrl("ProviderCredentialsCoverage")}>
            <Button style={{ background: "#FA6F30", color: "#fff" }}>Get MD Coverage</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#5a7a20" }}>Active Treatments ({activeSubs.length})</p>
          {activeSubs.map(st => {
            if (isInjectableBundle(st)) {
              // Split into tox + filler sub-cards
              return (
                <div key={st.id} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#1e2535" }}>{st.name}</div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.2)" }}>
                      {categoryLabel[st.category] || st.category}
                    </span>
                    <span className="text-xs" style={{ color: "rgba(30,37,53,0.35)" }}>— customize each service separately</span>
                  </div>
                  {INJECTABLE_SPLITS.map(sub => (
                    <SubServiceCard
                      key={sub.key}
                      sub={sub}
                      data={offerings[`${st.id}_${sub.key}`] || {}}
                      onChange={data => updateOffering(`${st.id}_${sub.key}`, data)}
                    />
                  ))}
                </div>
              );
            }
            return (
              <StandardServiceCard
                key={st.id}
                st={st}
                data={offerings[st.id] || {}}
                onChange={data => updateOffering(st.id, data)}
              />
            );
          })}
        </div>
      )}

      {/* Locked services */}
      {inactiveSubs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)" }}>Locked Services</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {inactiveSubs.map(st => (
              <div key={st.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.35)", border: "1px solid rgba(30,37,53,0.08)" }}>
                <Lock className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.25)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "rgba(30,37,53,0.45)" }}>{st.name}</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.3)" }}>{categoryLabel[st.category] || st.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Packages & Rewards ── */}
      <PackagesRewardsSection packages={packages} onChange={setPackages} />

      <Button onClick={() => onSave({ service_offerings_v2: offerings, practice_packages: packages })} disabled={saving} className="font-bold gap-2" style={{ background: "#FA6F30", color: "#fff", borderRadius: 12 }}>
        {saved ? <><CheckCircle className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />Save Treatments</>}
      </Button>
    </div>
  );
}