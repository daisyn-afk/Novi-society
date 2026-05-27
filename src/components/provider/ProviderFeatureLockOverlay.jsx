/**
 * ProviderFeatureLockOverlay
 *
 * Promotional overlay wrapper for sidebar pages that are visible to locked
 * providers but not yet functional (Supplier Marketplace, Growth Studio,
 * My Practice, etc.).
 *
 * Behavior:
 *   - When `useProviderDashboardState().isUnlocked === true` → renders {children} unchanged
 *   - When locked → renders the locked overlay (gradient brand banner, value
 *     bullets, CTAs to the locked dashboard / coverage activation flow)
 *
 * This is a NAV-level lock (whole-page promotional). For per-service locks
 * inside an otherwise-unlocked page, keep using <ServiceLockGate /> (e.g.
 * a provider with MD coverage for one service trying to access a different
 * service still uses ServiceLockGate).
 */
import { Link } from "react-router-dom";
import {
  Lock, ArrowRight, Shield, ShoppingBag, Rocket, Stethoscope,
  Calendar, Star, FileText, Sparkles,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { useProviderDashboardState } from "@/hooks/useProviderDashboardState";

const COPY = {
  ProviderMarketplace: {
    Icon: ShoppingBag,
    eyebrow: "Supplier Marketplace",
    headline: "Exclusive supplier pricing — for active NOVI providers.",
    sub: "Once your MD coverage is active you'll unlock direct-from-manufacturer pricing, rep contacts, and pre-order windows reserved for the Society.",
    bullets: [
      "Negotiated pricing on injectables & devices",
      "Direct rep contacts inside the platform",
      "Early access to pre-order windows",
    ],
  },
  ProviderLaunchPad: {
    Icon: Rocket,
    eyebrow: "Growth Studio",
    headline: "Build a practice patients can actually find.",
    sub: "Profile branding, referral tools, and patient-marketplace placement unlock the moment you become an active NOVI provider.",
    bullets: [
      "Patient-facing profile, photos & service menu",
      "Referral & reputation tools",
      "Local market intelligence dashboard",
    ],
  },
  ProviderPractice: {
    Icon: Stethoscope,
    eyebrow: "My Practice",
    headline: "Run your full practice from one place.",
    sub: "Appointments, treatment records, charts, and patient management are reserved for active NOVI providers under MD supervision.",
    bullets: [
      "Patient charts & treatment records",
      "Confirm or decline appointment requests",
      "MD-reviewed clinical documentation",
    ],
  },
  ProviderAppointments: {
    Icon: Calendar,
    eyebrow: "Appointments",
    headline: "Manage your full schedule — once you're active.",
    sub: "Appointments turn on the moment your MD coverage activates. Until then, finish your activation steps from the dashboard.",
    bullets: [
      "Confirm, decline & manage patient requests",
      "Tied to your active service coverage",
      "Every appointment documented on your record",
    ],
  },
  ProviderReviews: {
    Icon: Star,
    eyebrow: "Reviews",
    headline: "Build your reputation — after activation.",
    sub: "Patient reviews are visible once you're an active NOVI provider seeing patients.",
    bullets: ["Showcase your work", "Respond to patient feedback", "Public reputation building"],
  },
  ProviderMDRelationships: {
    Icon: Shield,
    eyebrow: "MD Relationships",
    headline: "Your supervising MD is assigned at activation.",
    sub: "Once your MD coverage is approved, you'll see your medical director here with messaging, protocols, and chart review.",
    bullets: [
      "Vetted MD oversight",
      "Signed scope protocols",
      "Real chart review, not rubber-stamp",
    ],
  },
  ProviderScopeRules: {
    Icon: FileText,
    eyebrow: "Scope of Practice",
    headline: "Per-service protocols unlock at activation.",
    sub: "Your MD-signed scope rules, treatment areas, and dosing limits appear here the moment coverage is active.",
    bullets: [
      "Real-time MD updates",
      "Per-service protocol rules",
      "Legal protection in every patient interaction",
    ],
  },
  ProviderSubscription: {
    Icon: Sparkles,
    eyebrow: "Membership",
    headline: "Your NOVI membership starts here.",
    sub: "Finish your activation steps on the dashboard to enable membership billing and full-access features.",
    bullets: [
      "One membership for everything NOVI",
      "Add or remove service coverage anytime",
      "Cancel at any time",
    ],
  },
  default: {
    Icon: Lock,
    eyebrow: "Locked Feature",
    headline: "This is reserved for active NOVI providers.",
    sub: "Finish your activation steps on the dashboard and this feature unlocks the moment your MD coverage is approved.",
    bullets: [
      "Activate MD coverage to unlock",
      "All your progress is saved",
      "One step away from full access",
    ],
  },
};

export default function ProviderFeatureLockOverlay({ feature, children }) {
  const dashboardState = useProviderDashboardState();

  if (dashboardState.isLoading) return null;
  if (dashboardState.isUnlocked) return children;

  const copy = COPY[feature] || COPY.default;
  const { Icon, eyebrow, headline, sub, bullets } = copy;

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "0 12px 60px rgba(45,61,102,0.18)", border: "1px solid rgba(107,125,179,0.15)" }}>
        {/* gradient header */}
        <div
          className="px-8 pt-10 pb-8 text-center relative overflow-hidden"
          style={{
            background: `
              radial-gradient(ellipse at 5% 15%, rgba(218,106,99,0.42) 0%, transparent 48%),
              radial-gradient(ellipse at 92% 85%, rgba(250,111,48,0.32) 0%, transparent 45%),
              linear-gradient(160deg, #3d4f7c 0%, #2d3d66 55%, #1e2d52 100%)
            `,
          }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4" style={{ background: "rgba(250,111,48,0.18)", border: "1px solid rgba(250,111,48,0.35)" }}>
            <Sparkles className="w-3 h-3" style={{ color: "#FA6F30" }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#FA6F30" }}>NOVI Society</span>
          </div>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(250,111,48,0.18)", border: "1.5px solid rgba(250,111,48,0.4)" }}>
            <Icon className="w-7 h-7" style={{ color: "#FA6F30" }} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: "rgba(250,111,48,0.85)" }}>{eyebrow}</p>
          <h2 className="text-2xl font-bold text-white mb-3 leading-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>{headline}</h2>
          <p className="text-white/65 text-sm leading-relaxed max-w-sm mx-auto">{sub}</p>
        </div>

        {/* bullets */}
        <div className="px-8 py-5" style={{ background: "rgba(240,237,232,0.55)", borderTop: "1px solid rgba(198,190,168,0.25)", borderBottom: "1px solid rgba(198,190,168,0.25)" }}>
          <div className="space-y-2.5">
            {bullets.map((b) => (
              <div key={b} className="flex items-center gap-3 text-sm font-medium" style={{ color: "#2d3d66" }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#FA6F30" }} />
                {b}
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="px-8 py-6 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ background: "white" }}>
          <Link to={createPageUrl("ProviderDashboard")}>
            <button className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #FA6F30, #DA6A63)", color: "#fff" }}>
              Back to your dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link to={createPageUrl("ProviderCredentialsCoverage")}>
            <button className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:bg-slate-50" style={{ background: "transparent", border: "1.5px solid rgba(45,61,102,0.25)", color: "#2d3d66" }}>
              Continue activation
            </button>
          </Link>
        </div>
      </div>

      {/* Optionally render the original page content beneath, dimmed and pointer-events-none, so the route still mounts data fetches and we keep a glimpse for context. */}
      {children ? (
        <div aria-hidden="true" className="mt-10 pointer-events-none select-none" style={{ filter: "blur(6px) saturate(0.7)", opacity: 0.35 }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
