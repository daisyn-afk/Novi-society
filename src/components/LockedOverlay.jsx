/**
 * LockedOverlay
 *
 * Generic, reusable "freemium overlay" for the Provider dashboard. Renders the
 * real page content underneath, blurred + disabled, with an "Unlock this
 * feature" card floating on top. Used to give non-certified providers a
 * see-but-not-fully-use preview of restricted sections (Supplier Marketplace,
 * Growth Studio, My Practice, etc.).
 *
 * Spec ref: "Locked Provider Experience" — replicate the Base44 locked
 * dashboard concept inside this Vercel codebase.
 *
 * Props:
 *   • title              — overlay headline (default "Unlock this feature")
 *   • description        — short explanation of the module
 *   • benefits           — string[] of value-bullets shown in the card
 *   • icon               — lucide icon component
 *   • accentColor        — hex/rgba color used for icon + bullets
 *   • primaryCta         — { label, to } (optional)
 *   • secondaryCta       — { label, to } (optional)
 *   • statusBadge        — small banner above the card (optional ReactNode)
 *   • footnote           — small line under the CTA (optional ReactNode)
 *   • children           — the real page content (rendered blurred behind)
 */
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";

const ACCENT_DEFAULT = "#FA6F30";

function CtaButton({ cta, variant = "primary", accentColor = ACCENT_DEFAULT }) {
  if (!cta?.label) return null;

  const primaryStyle = {
    background: `linear-gradient(135deg, ${accentColor}, #DA6A63)`,
    color: "white",
  };
  const secondaryStyle = {
    background: "rgba(30,37,53,0.04)",
    color: "#1e2535",
    border: "1px solid rgba(30,37,53,0.12)",
  };

  const className =
    "w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90";

  const inner = (
    <button className={className} style={variant === "primary" ? primaryStyle : secondaryStyle}>
      {cta.label}
      {variant === "primary" && <ArrowRight className="w-4 h-4" />}
    </button>
  );

  if (cta.to) {
    return (
      <Link to={cta.to} className="block">
        {inner}
      </Link>
    );
  }
  if (cta.onClick) {
    return (
      <button
        type="button"
        onClick={cta.onClick}
        className={className}
        style={variant === "primary" ? primaryStyle : secondaryStyle}
      >
        {cta.label}
        {variant === "primary" && <ArrowRight className="w-4 h-4" />}
      </button>
    );
  }
  return inner;
}

export default function LockedOverlay({
  title = "Unlock this feature",
  description,
  benefits = [],
  icon: Icon = Lock,
  accentColor = ACCENT_DEFAULT,
  primaryCta,
  secondaryCta,
  statusBadge,
  footnote,
  children,
}) {
  return (
    <div className="relative min-h-[70vh]">
      {/* Real page content rendered underneath — visible but blurred and
          non-interactive. Crucially: route stays mounted, sidebar still works. */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none"
        style={{
          filter: "blur(6px) saturate(0.85)",
          opacity: 0.55,
          userSelect: "none",
        }}
      >
        {children}
      </div>

      {/* Overlay layer */}
      <div
        className="absolute inset-0 flex items-start justify-center px-4 py-10 sm:py-14 overflow-y-auto"
        style={{
          background:
            "linear-gradient(180deg, rgba(245,243,239,0.55) 0%, rgba(245,243,239,0.75) 100%)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
        role="dialog"
        aria-modal="false"
        aria-label={title}
      >
        <div className="w-full max-w-lg pointer-events-auto">
          {statusBadge ? <div className="mb-4">{statusBadge}</div> : null}

          <div
            className="rounded-3xl overflow-hidden shadow-xl"
            style={{
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(30,37,53,0.08)",
              boxShadow: "0 24px 60px rgba(30,37,53,0.18)",
            }}
          >
            {/* Header */}
            <div
              className="px-6 pt-6 pb-5 flex items-start gap-4"
              style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${accentColor}1f` }}
              >
                <Icon className="w-6 h-6" style={{ color: accentColor }} />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: accentColor }}
                >
                  Locked Feature
                </p>
                <h2
                  className="text-xl mt-1 leading-tight"
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    color: "#1e2535",
                  }}
                >
                  {title}
                </h2>
                {description ? (
                  <p
                    className="text-sm mt-2 leading-relaxed"
                    style={{ color: "rgba(30,37,53,0.65)" }}
                  >
                    {description}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Benefits */}
            {benefits.length > 0 ? (
              <div className="px-6 py-5 space-y-2.5">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: "rgba(30,37,53,0.45)" }}
                >
                  What you'll unlock
                </p>
                {benefits.map((bullet, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: accentColor }}
                    />
                    <p className="text-sm" style={{ color: "rgba(30,37,53,0.78)" }}>
                      {bullet}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {/* CTAs */}
            {(primaryCta || secondaryCta) && (
              <div className="px-6 pb-6 space-y-2.5">
                {primaryCta ? (
                  <CtaButton cta={primaryCta} variant="primary" accentColor={accentColor} />
                ) : null}
                {secondaryCta ? (
                  <CtaButton cta={secondaryCta} variant="secondary" accentColor={accentColor} />
                ) : null}
              </div>
            )}
          </div>

          {footnote ? (
            <p
              className="text-center text-xs mt-4"
              style={{ color: "rgba(30,37,53,0.5)" }}
            >
              {footnote}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
