import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Clock, Building2 } from "lucide-react";
import NoviFooter from "@/components/NoviFooter";
import ClinicGrowersFormEmbed from "@/components/ClinicGrowersFormEmbed";

export default function ContactUs() {
  return (
    <div className="min-h-screen" style={{ background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #2D6B7F 0%, #7B8EC8 55%, #C8E63C 100%)", padding: "60px 24px 48px" }}>
        <div className="max-w-4xl mx-auto text-center">
          <Link to="/">
            <img
              src="https://media.base44.com/images/public/699c9815c81b2b13b2643a48/632f46e8b_NOVI-WHITEGREEN.png"
              alt="NOVI Society"
              style={{ width: 180, display: "block", margin: "0 auto 28px" }}
            />
          </Link>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(2.2rem, 6vw, 3.25rem)", color: "#fff", fontStyle: "italic", fontWeight: 400, lineHeight: 1.1, marginBottom: 16 }}>
            Contact NOVI Society
          </h1>
          <p style={{ fontSize: "clamp(0.95rem, 2.5vw, 1.1rem)", color: "rgba(255,255,255,0.82)", lineHeight: 1.75, maxWidth: 640, margin: "0 auto" }}>
            Have questions about NOVI training, certification options, scheduling, or enrollment? Our team is here to help.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-5 gap-10">

          {/* Left: Contact Info */}
          <div className="lg:col-span-2 space-y-6">

            {/* Main Address */}
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}>
                  <Building2 className="w-4 h-4" style={{ color: "#5a7a20" }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2D6B7F" }}>Main Business Address</p>
              </div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: "#1e2535" }}>NOVI Society LLC</p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>8109 Meadow Valley Dr<br />McKinney, TX 75071</p>

            </div>

            {/* Secondary Address */}
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(123,142,200,0.12)" }}>
                  <MapPin className="w-4 h-4" style={{ color: "#7B8EC8" }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>Mailing & Training Inquiries</p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>2081 Bethany Rd<br />Sherman, TX 75090</p>
              <p className="text-xs mt-2 italic" style={{ color: "rgba(30,37,53,0.45)" }}>For mailing and training-related inquiries only — not our main business location.</p>
            </div>

            {/* Phone & Email */}
            <div className="rounded-2xl p-6 space-y-4" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#2D6B7F" }}>Phone</p>
                <a href="tel:+18178936317" className="flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: "#1e2535" }}>
                  <Phone className="w-4 h-4 flex-shrink-0" style={{ color: "#2D6B7F" }} />
                  +1 (817) 893-6317
                </a>
              </div>
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16 }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#2D6B7F" }}>Email</p>
                <a href="mailto:support@novisociety.com" className="flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: "#1e2535" }}>
                  <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "#2D6B7F" }} />
                  support@novisociety.com
                </a>
              </div>
            </div>

            {/* Business Hours */}
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}>
                  <Clock className="w-4 h-4" style={{ color: "#5a7a20" }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2D6B7F" }}>Business Hours</p>
              </div>
              <div className="space-y-2">
                {[
                  { day: "Monday – Friday", hours: "9:00 AM – 5:00 PM CT" },
                  { day: "Saturday", hours: "By Appointment Only" },
                  { day: "Sunday", hours: "Closed" },
                ].map(({ day, hours }) => (
                  <div key={day} className="flex items-center justify-between text-sm">
                    <span style={{ color: "rgba(30,37,53,0.6)" }}>{day}</span>
                    <span className="font-semibold" style={{ color: "#1e2535" }}>{hours}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Contact Form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl p-8" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)", minHeight: 900 }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "#1e2535", fontStyle: "italic", marginBottom: 6 }}>Send Us a Message</h2>
              <p className="text-sm mb-6" style={{ color: "rgba(30,37,53,0.55)" }}>We typically respond within 1–2 business days.</p>
              <ClinicGrowersFormEmbed />
            </div>
          </div>
        </div>
      </div>

      <NoviFooter />
    </div>
  );
}