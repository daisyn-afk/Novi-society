import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const NOVI_LOGO_SRC = "/novi-email-logo.png";

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
          <div className="mb-2">
            <Link to={createPageUrl("LandingPage")} className="inline-flex items-center" aria-label="NOVI Society home">
              <img src={NOVI_LOGO_SRC} alt="" width={200} height={58} className="h-11 w-auto sm:h-12" />
            </Link>
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
            href={createPageUrl("LandingPage")}
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
