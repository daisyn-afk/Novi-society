import React from "react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import {
  Shield, Users, Award, CheckCircle2, Sparkles, HeartHandshake,
  BookOpen, Star, TrendingUp, ArrowRight, Quote, Stethoscope, ClipboardCheck, BadgeCheck
} from "lucide-react";

function SwirlBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1200 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M1100,30 C1020,140 860,70 820,200 C780,330 940,390 890,500 C840,610 680,580 660,680" fill="none" stroke="#DA6A63" strokeWidth="2.5" strokeOpacity="0.16" strokeLinecap="round"/>
      <path d="M1160,90 C1070,220 900,130 850,280 C800,430 960,460 910,560 C860,660 700,630 670,730" fill="none" stroke="#FA6F30" strokeWidth="1.5" strokeOpacity="0.10" strokeLinecap="round"/>
      <path d="M-40,180 C90,160 130,310 60,400 C-10,490 110,530 90,640 C70,750 200,760 270,820" fill="none" stroke="#6B7DB3" strokeWidth="2" strokeOpacity="0.14" strokeLinecap="round"/>
      <path d="M490,0 C470,90 550,130 530,220 C510,310 420,330 450,420 C480,510 590,510 570,600" fill="none" stroke="#C8E63C" strokeWidth="1.5" strokeOpacity="0.18" strokeLinecap="round"/>
      <path d="M0,750 C180,710 300,790 500,750 C700,710 820,790 1020,750 C1110,728 1160,755 1200,748" fill="none" stroke="#C6BEA8" strokeWidth="2" strokeOpacity="0.22" strokeLinecap="round"/>
      <path d="M200,0 C190,60 230,100 210,160 C190,220 140,240 160,300" fill="none" stroke="#DA6A63" strokeWidth="1" strokeOpacity="0.12" strokeLinecap="round"/>
      <circle cx="960" cy="140" r="5" fill="#FA6F30" fillOpacity="0.22"/>
      <circle cx="930" cy="162" r="3" fill="#DA6A63" fillOpacity="0.18"/>
      <circle cx="980" cy="120" r="2" fill="#C8E63C" fillOpacity="0.28"/>
      <circle cx="140" cy="410" r="4" fill="#6B7DB3" fillOpacity="0.20"/>
      <circle cx="175" cy="388" r="2.5" fill="#DA6A63" fillOpacity="0.16"/>
      <circle cx="560" cy="560" r="3.5" fill="#FA6F30" fillOpacity="0.16"/>
      <circle cx="590" cy="540" r="2" fill="#C8E63C" fillOpacity="0.22"/>
      <circle cx="380" cy="820" r="4" fill="#6B7DB3" fillOpacity="0.14"/>
    </svg>
  );
}

const FEATURES = [
  { icon: Shield, title: "Scope of Practice Protection", desc: "Signed MD protocols define exactly what you can treat — no gray areas, no liability gaps.", color: "#FA6F30" },
  { icon: Users, title: "Real MD Oversight", desc: "Our vetted medical directors provide hands-on supervision, not rubber-stamp approval.", color: "#DA6A63" },
  { icon: TrendingUp, title: "Grow on Your Terms", desc: "Expand your service menu at your own pace, always within legal and clinical boundaries.", color: "#6B7DB3" },
  { icon: Award, title: "Recognized Certifications", desc: "Train with top injectors and earn credentials that open doors with vendors and patients.", color: "#FA6F30" },
];

const UNLOCKS = [
  { text: "Practice analytics & revenue tracking", color: "#C8E63C" },
  { text: "Verified scope of practice per service", color: "#FA6F30" },
  { text: "MD coverage dashboard & subscription tools", color: "#DA6A63" },
  { text: "Appointment scheduling & patient management", color: "#C8E63C" },
  { text: "Approved vendor access & product compliance", color: "#6B7DB3" },
  { text: "Professional reviews & reputation building", color: "#FA6F30" },
  { text: "Advanced training modules & CEU content", color: "#DA6A63" },
];

const HOW_IT_WORKS = [
  { icon: BookOpen, step: "01", title: "Complete a Course or Submit Your Cert", desc: "Enroll in a NOVI training course or upload an existing certification to get verified.", color: "#FA6F30" },
  { icon: BadgeCheck, step: "02", title: "Get MD-Supervised Coverage", desc: "We match you with a vetted medical director who signs your scope protocols.", color: "#DA6A63" },
  { icon: Stethoscope, step: "03", title: "Start Practicing with Protection", desc: "Your dashboard unlocks — accept patients, manage compliance, and grow your practice.", color: "#6B7DB3" },
];

const TESTIMONIALS = [
  {
    quote: "NOVI gave me the legal clarity I didn't know I was missing. I finally feel protected and supported doing what I love.",
    name: "Jessica R., RN",
    location: "Austin, TX",
    color: "#DA6A63",
  },
  {
    quote: "The MD supervision through NOVI is the real deal — not just a signature. My director actually reviews my charts.",
    name: "Mariana L., NP",
    location: "Miami, FL",
    color: "#6B7DB3",
  },
];

export default function ProviderDashboardUnlock() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "#F0EDE8", fontFamily: "'DM Sans', sans-serif" }}>
      <SwirlBg />

      {/* ── Hero ── */}
      <div className="relative px-4 pt-16 pb-12 text-center z-10">
        <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(218,106,99,0.13)" }}/>
        <div className="absolute top-10 left-1/4 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(107,125,179,0.10)" }}/>
        <div className="absolute bottom-0 right-1/3 w-40 h-40 rounded-full blur-2xl pointer-events-none" style={{ background: "rgba(200,230,60,0.10)" }}/>

        <div className="relative max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6" style={{ background: "rgba(218,106,99,0.12)", border: "1px solid rgba(218,106,99,0.30)" }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: "#DA6A63" }}/>
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#DA6A63" }}>A new way to be seen</span>
          </div>

          <h1 className="text-4xl md:text-5xl mb-4 leading-tight" style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
            Practice with Confidence.<br/>
            <em style={{ color: "#DA6A63" }}>Be Seen with NOVI.</em>
          </h1>

          <p className="text-base md:text-lg leading-relaxed mb-2" style={{ color: "#5a6a8a" }}>
            NOVI is a new way to be seen — the clinical training, vetted MD supervision, and compliance infrastructure that lets your practice stand out, legitimately and beautifully.
          </p>
          <p className="text-sm mb-10" style={{ color: "#9a8f7e" }}>
            Complete your first course or submit an existing certification to unlock your full dashboard.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={createPageUrl("CourseCatalog")}>
              <Button size="lg" className="w-full sm:w-auto gap-2 font-semibold shadow-md" style={{ background: "#FA6F30", color: "white" }}>
                <BookOpen className="w-4 h-4"/>
                Browse Courses
              </Button>
            </Link>
            <Link to={createPageUrl("ProviderLicenses")}>
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 font-semibold" style={{ borderColor: "#6B7DB3", color: "#3d4f7c", background: "rgba(107,125,179,0.06)" }}>
                Submit Existing Certification
                <ArrowRight className="w-4 h-4"/>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-16 relative z-10">

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-4 mb-14">
          {[
            { number: "500+", label: "Active Providers", accent: "#FA6F30" },
            { number: "98%", label: "Compliance Rate", accent: "#DA6A63" },
            { number: "40+", label: "Training Courses", accent: "#6B7DB3" },
          ].map(({ number, label, accent }, i) => (
            <div key={i} className="rounded-2xl p-6 text-center relative overflow-hidden" style={{ background: "white", border: "1px solid rgba(198,190,168,0.5)", boxShadow: "0 2px 16px rgba(36,50,87,0.06)" }}>
              <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: accent, opacity: 0.12, transform: "translate(30%,-30%)" }}/>
              <p className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: "'DM Serif Display', serif", color: accent }}>{number}</p>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#9a8f7e" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ── Why + Unlock ── */}
        <div className="grid md:grid-cols-2 gap-6 mb-14">
          {/* Why NOVI */}
          <div className="rounded-2xl p-8 relative overflow-hidden" style={{ background: "white", border: "1px solid rgba(198,190,168,0.40)", boxShadow: "0 2px 20px rgba(36,50,87,0.06)" }}>
            <svg className="absolute top-0 right-0 w-40 h-40 pointer-events-none" viewBox="0 0 160 160" fill="none">
              <path d="M160,10 C120,40 80,20 70,70 C60,120 110,130 100,160" stroke="#FA6F30" strokeWidth="1.5" strokeOpacity="0.15" strokeLinecap="round"/>
              <path d="M160,40 C130,60 100,50 90,90 C80,130 120,140 110,160" stroke="#DA6A63" strokeWidth="1" strokeOpacity="0.10" strokeLinecap="round"/>
            </svg>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(218,106,99,0.12)" }}>
                <HeartHandshake className="w-5 h-5" style={{ color: "#DA6A63" }}/>
              </div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
                Why Providers Choose NOVI
              </h2>
            </div>
            <div className="space-y-5">
              {FEATURES.map(({ icon: Icon, title, desc, color }, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${color}18` }}>
                    <Icon className="w-4 h-4" style={{ color }}/>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: "#243257" }}>{title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "#9a8f7e" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What you unlock */}
          <div className="rounded-2xl p-8 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #3d4f7c 0%, #243257 100%)" }}>
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 400" fill="none" preserveAspectRatio="xMidYMid slice">
              <path d="M400,0 C320,80 280,40 240,140 C200,240 300,280 260,360 C220,440 120,420 80,480" stroke="#C8E63C" strokeWidth="1.5" strokeOpacity="0.18" strokeLinecap="round"/>
              <path d="M-20,300 C80,260 120,340 160,300 C200,260 200,320 260,290" stroke="#6B7DB3" strokeWidth="1.5" strokeOpacity="0.20" strokeLinecap="round"/>
              <circle cx="350" cy="60" r="60" fill="#C8E63C" fillOpacity="0.05"/>
              <circle cx="50" cy="350" r="80" fill="#6B7DB3" fillOpacity="0.07"/>
            </svg>
            <div className="flex items-center gap-3 mb-6 relative">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,230,60,0.18)" }}>
                <Star className="w-5 h-5" style={{ color: "#C8E63C" }}/>
              </div>
              <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>
                What You Unlock
              </h2>
            </div>
            <div className="space-y-3.5 relative">
              {UNLOCKS.map(({ text, color }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color }}/>
                  <p className="text-sm text-white/85">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── How It Works ── */}
        <div className="mb-14">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#DA6A63" }}>Simple by design</p>
            <h2 className="text-2xl md:text-3xl" style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
              How NOVI Works
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map(({ icon: Icon, step, title, desc, color }, i) => (
              <div key={i} className="rounded-2xl p-7 relative overflow-hidden" style={{ background: "white", border: "1px solid rgba(198,190,168,0.45)", boxShadow: "0 2px 16px rgba(36,50,87,0.05)" }}>
                {/* step number watermark */}
                <p className="absolute top-4 right-5 text-5xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: `${color}14`, lineHeight: 1 }}>{step}</p>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}15` }}>
                  <Icon className="w-5 h-5" style={{ color }}/>
                </div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: "#243257" }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#9a8f7e" }}>{desc}</p>
                {/* bottom accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl" style={{ background: `linear-gradient(90deg, ${color}, transparent)`, opacity: 0.4 }}/>
              </div>
            ))}
          </div>
        </div>

        {/* ── Testimonials ── */}
        <div className="mb-14">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#6B7DB3" }}>From our society</p>
            <h2 className="text-2xl md:text-3xl" style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
              The NOVI Society
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {TESTIMONIALS.map(({ quote, name, location, color }, i) => (
              <div key={i} className="rounded-2xl p-7 relative overflow-hidden" style={{ background: "white", border: `1px solid rgba(198,190,168,0.45)`, boxShadow: "0 2px 16px rgba(36,50,87,0.05)" }}>
                <div className="absolute top-0 left-0 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ background: color, opacity: 0.08, transform: "translate(-30%,-30%)" }}/>
                <Quote className="w-6 h-6 mb-4 opacity-30" style={{ color }}/>
                <p className="text-sm leading-relaxed mb-5 italic" style={{ color: "#4a5a7a" }}>"{quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: color }}>
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "#243257" }}>{name}</p>
                    <p className="text-xs" style={{ color: "#9a8f7e" }}>{location}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[...Array(5)].map((_, j) => <Star key={j} className="w-3 h-3 fill-current" style={{ color: "#FA6F30" }}/>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA Banner ── */}
        <div className="rounded-2xl px-8 py-12 text-center relative overflow-hidden" style={{ background: "linear-gradient(120deg, #FA6F30 0%, #DA6A63 60%, #6B7DB3 100%)" }}>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 900 200" fill="none" preserveAspectRatio="xMidYMid slice">
            <path d="M0,80 C150,40 200,120 350,80 C500,40 550,120 700,80 C800,55 850,90 900,80" stroke="white" strokeWidth="1.5" strokeOpacity="0.12" strokeLinecap="round"/>
            <path d="M0,130 C100,100 200,160 350,120 C500,80 600,150 800,120 C860,108 890,125 900,120" stroke="white" strokeWidth="1" strokeOpacity="0.08" strokeLinecap="round"/>
            <circle cx="820" cy="40" r="50" fill="white" fillOpacity="0.05"/>
            <circle cx="80" cy="160" r="60" fill="#C8E63C" fillOpacity="0.08"/>
          </svg>
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-white/70">Ready to get started?</p>
            <h3 className="text-2xl md:text-3xl mb-3 text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Your next chapter starts here.
            </h3>
            <p className="text-sm mb-8 max-w-md mx-auto text-white/80">
              Join a society of aesthetic providers who have found a new way to be seen — by their patients, their peers, and the industry.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to={createPageUrl("CourseCatalog")}>
                <Button size="lg" className="w-full sm:w-auto gap-2 font-semibold shadow-md" style={{ background: "white", color: "#FA6F30" }}>
                  <BookOpen className="w-4 h-4"/>
                  Browse Courses
                </Button>
              </Link>
              <Link to={createPageUrl("ProviderLicenses")}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 font-semibold" style={{ borderColor: "rgba(255,255,255,0.6)", color: "white", background: "rgba(255,255,255,0.10)" }}>
                  Submit Existing Cert
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Lime accent bar ── */}
        <div className="mt-6 rounded-xl px-6 py-4 flex items-center justify-between" style={{ background: "rgba(200,230,60,0.14)", border: "1px solid rgba(200,230,60,0.28)" }}>
          <p className="text-sm font-medium" style={{ color: "#4a5e1a" }}>
            ✦ NOVI providers are fully compliant, fully protected, and fully supported.
          </p>
          <a href="mailto:support@noviplatform.com" className="text-xs font-semibold underline" style={{ color: "#4a5e1a" }}>
            Contact us
          </a>
        </div>
      </div>
    </div>
  );
}