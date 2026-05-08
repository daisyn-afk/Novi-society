import { createPageUrl } from "@/utils";

/** Shared footer for public NOVI flows (model signup, booking lookup, etc.). */
export default function NoviFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="py-12 px-6"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#1e2535",
        borderTop: "1px solid rgba(255,255,255,0.08)"
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8">
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: "1.35rem",
                color: "#fff",
                fontStyle: "italic",
                fontWeight: 400
              }}
            >
              novi
            </span>
            <span
              className="text-[9px] font-bold tracking-[0.2em] uppercase"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Society
            </span>
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Training &amp; compliance for aesthetic providers.
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-2 text-sm">
          <a
            href="mailto:support@novisociety.com"
            className="transition-opacity hover:opacity-90"
            style={{ color: "#C8E63C" }}
          >
            support@novisociety.com
          </a>
          <a
            href={createPageUrl("NoviLanding")}
            className="transition-opacity hover:opacity-90"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Return to home
          </a>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            © {year} NOVI Society LLC
          </p>
        </div>
      </div>
    </footer>
  );
}
