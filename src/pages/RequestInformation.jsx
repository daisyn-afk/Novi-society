import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Sparkles, MapPin, Phone, Mail, ArrowRight, Shield, Star, Clock } from "lucide-react";
import NoviFooter from "@/components/NoviFooter";

const SERVICES = [
  "Botox / Neuromodulators",
  "Dermal Fillers",
  "PRP / PRF",
  "Laser Treatments",
  "Chemical Peels",
  "Microneedling",
  "Kybella",
  "Skincare Consultation",
  "Other",
];

const TRUST_BADGES = [
  { icon: Shield, label: "Licensed Providers", desc: "Every NOVI provider is credentialed and verified" },
  { icon: Star, label: "Top-Rated Care", desc: "4.9★ average across thousands of patient reviews" },
  { icon: Clock, label: "Quick Response", desc: "Providers typically respond within 24 hours" },
];

export default function RequestInformation() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    services_interested: [],
    message: "",
    preferred_contact: "email",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleService = (s) => {
    setForm(f => ({
      ...f,
      services_interested: f.services_interested.includes(s)
        ? f.services_interested.filter(x => x !== s)
        : [...f.services_interested, s],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: "info@novisociety.com",
        subject: `New Information Request from ${form.full_name}`,
        body: `
New patient information request submitted via novisociety.com/request-information

Name: ${form.full_name}
Email: ${form.email}
Phone: ${form.phone || "Not provided"}
City: ${form.city || "Not provided"}
Preferred Contact: ${form.preferred_contact}
Services Interested In: ${form.services_interested.join(", ") || "Not specified"}

Message:
${form.message || "No message provided"}
        `.trim(),
      });
    } catch (_) {
      // silently continue — still show success to user
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(150deg, #ede9fb 0%, #f5f2ff 40%, #eaf5c8 75%, #C8E63C 100%)" }}>
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(200,230,60,0.2)", border: "2px solid rgba(200,230,60,0.4)" }}>
            <CheckCircle className="w-10 h-10" style={{ color: "#4a6b10" }} />
          </div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535" }}>Request Received!</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
            Thank you, <strong>{form.full_name}</strong>! A NOVI team member will be in touch within 24 hours to connect you with the right provider.
          </p>
          <a href="/NoviLanding" className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm" style={{ background: "#1e2535", color: "#C8E63C" }}>
            Back to Home <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

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

        <div className="rounded-3xl p-6 sm:p-8" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 8px 40px rgba(30,37,53,0.1)" }}>
          <iframe
            src="https://link.novisociety.com/widget/form/DHztOTDwit9t6VtQp1tk"
            style={{ width: "100%", height: 900, border: "none", borderRadius: 3, display: "block" }}
            id="inline-DHztOTDwit9t6VtQp1tk"
            data-layout="{'id':'INLINE'}"
            data-trigger-type="alwaysShow"
            data-trigger-value=""
            data-activation-type="alwaysActivated"
            data-activation-value=""
            data-deactivation-type="neverDeactivate"
            data-deactivation-value=""
            data-form-name=" A2P Compliant form for website"
            data-height="791"
            data-layout-iframe-id="inline-DHztOTDwit9t6VtQp1tk"
            data-form-id="DHztOTDwit9t6VtQp1tk"
            title=" A2P Compliant form for website"
          />
          <script src="https://link.novisociety.com/js/form_embed.js" />
        </div>
      </div>
      <NoviFooter />
    </div>
  );
}