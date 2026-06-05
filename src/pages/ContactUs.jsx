import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApiRequest } from "@/api/adminApiRequest";
import NoviFooter from "@/components/NoviFooter";

const BLANK = { name: "", email: "", phone: "", subject: "", message: "" };

export default function ContactUs() {
  const [form, setForm] = useState(BLANK);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSending(true);
    setError("");
    try {
      await adminApiRequest("/admin/contact", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          subject: form.subject,
          message: form.message,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          "Something went wrong. Please email us directly at support@novisociety.com"
      );
    } finally {
      setSending(false);
    }
  };

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
            <div className="rounded-2xl p-8" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>
              {submitted ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(200,230,60,0.15)" }}>
                    <CheckCircle2 className="w-8 h-8" style={{ color: "#5a7a20" }} />
                  </div>
                  <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.75rem", color: "#1e2535", fontStyle: "italic" }}>Message Sent!</h3>
                  <p className="text-base max-w-sm mx-auto" style={{ color: "rgba(30,37,53,0.65)", lineHeight: 1.7 }}>
                    Thanks for reaching out. Our team will respond to <strong>{form.email}</strong> within 1–2 business days.
                  </p>
                  <Button onClick={() => { setForm(BLANK); setSubmitted(false); setError(""); }} className="mt-2 px-8 py-3 rounded-full font-bold" style={{ background: "#C8E63C", color: "#1a2540" }}>
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <>
                  <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "#1e2535", fontStyle: "italic", marginBottom: 6 }}>Send Us a Message</h2>
                  <p className="text-sm mb-3" style={{ color: "rgba(30,37,53,0.55)" }}>We typically respond within 1–2 business days.</p>
                  <p className="text-sm mb-6" style={{ color: "rgba(30,37,53,0.55)" }}>Use this form for general questions about training, scheduling, and enrollment. SMS consent, where applicable, is collected separately through designated opt-in forms.</p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Full Name *</Label>
                        <Input
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Jane Smith"
                          required
                          className="h-11 rounded-xl"
                          style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Email *</Label>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="jane@example.com"
                          required
                          className="h-11 rounded-xl"
                          style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Phone <span className="font-normal" style={{ color: "rgba(30,37,53,0.4)" }}>(optional)</span></Label>
                        <Input
                          value={form.phone}
                          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder="(555) 123-4567"
                          className="h-11 rounded-xl"
                          style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Subject <span className="font-normal" style={{ color: "rgba(30,37,53,0.4)" }}>(optional)</span></Label>
                        <Input
                          value={form.subject}
                          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                          placeholder="e.g. Course Enrollment, Scheduling"
                          className="h-11 rounded-xl"
                          style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Message *</Label>
                      <textarea
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder="Tell us how we can help..."
                        required
                        rows={5}
                        className="w-full rounded-xl p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-300"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)", color: "#1e2535", fontFamily: "'DM Sans', sans-serif" }}
                      />
                    </div>

                    {error && (
                      <p className="text-sm rounded-xl px-3 py-2" style={{ background: "rgba(254,226,226,0.85)", border: "1px solid rgba(220,38,38,0.35)", color: "#991b1b" }}>
                        {error}
                      </p>
                    )}

                    <Button
                      type="submit"
                      disabled={!form.name || !form.email || !form.message || sending}
                      className="w-full py-5 text-base font-bold rounded-xl"
                      style={{ background: "#C8E63C", color: "#1a2540" }}
                    >
                      {sending ? (
                        <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />Sending...</>
                      ) : (
                        <><Send className="w-4 h-4 mr-2" />Send Message</>
                      )}
                    </Button>
                  </form>
                </>
              )}
            </div>


          </div>
        </div>
      </div>

      <NoviFooter />
    </div>
  );
}