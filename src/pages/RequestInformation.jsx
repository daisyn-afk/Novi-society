import NoviFooter from "@/components/NoviFooter";
import ClinicGrowersFormEmbed from "@/components/ClinicGrowersFormEmbed";

export default function RequestInformation() {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(150deg, #ede9fb 0%, #f5f2ff 40%, #eaf5c8 75%, #C8E63C 100%)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>

      {/* Nav */}
      <header className="px-6 py-4 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
        <a href="/NoviLanding" className="flex items-baseline gap-1.5">
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#5a6f9f", fontStyle: "italic" }}>novi</span>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(123,142,200,0.6)" }}>Society</span>
        </a>
        <a href="/NoviLanding" className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.5)" }}>← Back</a>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header copy */}
        <div className="mb-8 text-center">
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.75rem, 5vw, 2.5rem)", color: "#1e2535", fontStyle: "italic", fontWeight: 400, lineHeight: 1.15, marginBottom: 12 }}>
            Get Certified in Aesthetics with NOVI Society
          </h1>
          <p className="font-semibold text-base mb-4" style={{ color: "rgba(30,37,53,0.75)" }}>
            Complete the form below to learn more about upcoming classes, certification opportunities, announcements, and special offers from NOVI Society.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.6)", maxWidth: 580, margin: "0 auto" }}>
            NOVI Society offers aesthetics certification training, compliance-focused education, and support resources for qualified providers. After submitting your information and selecting your communication preferences below, you will be contacted by a NOVI consultant regarding classes, enrollment options, updates, and related support.
          </p>
        </div>

        {/* Vimeo Video */}
        <div className="mb-8 mx-auto" style={{ width: 430, maxWidth: "100%" }}>
          <div style={{ padding: "100% 0 0 0", position: "relative" }}>
            <iframe
              src="https://player.vimeo.com/video/1189175347?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              title="NOVI-LandingPage-Video"
            />
          </div>
          <script src="https://player.vimeo.com/api/player.js" />
        </div>

        <div className="rounded-3xl p-6 sm:p-8" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 8px 40px rgba(30,37,53,0.1)", minHeight: 900 }}>
          <ClinicGrowersFormEmbed />
        </div>
      </div>
      <NoviFooter />
    </div>
  );
}