import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Award, Shield, Heart, ArrowRight, Check, Sparkles,
  BookOpen, Clock, MapPin, ChevronRight, Zap, Phone,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import NoviFooter from "@/components/NoviFooter";
import NoviOfferingsPortal from "@/components/landing/NoviOfferingsPortal";
import { DEFAULT_COURSE_IMAGE_URL } from "@/lib/courseDisplay";

const pillars = [
  { number: "01", icon: Award, title: "Certification", subtitle: "Where the journey begins.", description: "NOVI creates a direct pathway from education to active practice. Providers enter the NOVI ecosystem through certification, training, and mentorship designed to ensure they begin their careers with the proper knowledge, skill foundation, and professional support.", outcome: "Certification establishes the credibility and preparation required to safely enter the field of aesthetic medicine.", accent: "#C8E63C" },
  { number: "02", icon: Shield, title: "Compliance", subtitle: "The structure that protects providers and patients.", description: "Once certified, providers operate within NOVI's integrated compliance framework. This includes medical director oversight, scope-of-practice management, documentation, chart review, and regulatory safeguards.", outcome: "Compliance ensures that every provider within the NOVI Society practices within a safe, legally supported medical structure.", accent: "#7B8EC8" },
  { number: "03", icon: Sparkles, title: "Connection", subtitle: "Where providers meet patients.", description: "Through advanced patient matching technology, treatment conversations, and facial analysis tools, NOVI connects patients with the providers best suited for their goals and treatment needs. Rather than patients searching blindly, NOVI intelligently guides them to trusted providers within the Society.", outcome: "Connection turns discovery into meaningful relationships.", accent: "#2D6B7F" },
  { number: "04", icon: Heart, title: "Community", subtitle: "The long-term growth engine.", description: "NOVI Society creates a collaborative environment where providers continue to grow through mentorship, shared knowledge, and professional support. Patients remain connected through ongoing care, education, and trusted provider relationships.", outcome: "Community transforms the platform from a service into a movement within the aesthetics industry.", accent: "#C8E63C" },
];

const differentiators = [
  { title: "The Only Platform with Built-In MD Coverage", description: "Every other platform leaves you to find your own Medical Director. NOVI integrates physician oversight directly — scope management, chart reviews, and compliance are handled within the platform." },
  { title: "A Complete Career Pipeline, Not Just a Course", description: "Training → Credential Verification → Medical Oversight → Active Practice → Patient Growth. NOVI is structured to support your entire career, not just get you certified." },
  { title: "Technology That Has Never Existed in This Industry", description: "Instant data-driven market intelligence shows you exactly where you stand competitively, what your strengths are, and what could differentiate you even further. NOVI's AI does what no consultant, coach, or tool has ever done for aesthetic providers before." },
  { title: "A Living Patient Ecosystem, Not Just a Booking App", description: "NOVI tracks patient results in real daily time — feeding recovery data, satisfaction signals, and outcome trends directly back to you. Every check-in becomes insight. Every insight becomes retention." },
  { title: "One System. Everything Included.", description: "Scheduling, documentation, compliance, payments, messaging, and analytics — all in one platform. No stitching together 6 different tools to run your practice." },
];

export default function NoviLanding() {
  return (
    <div className="min-h-screen" style={{ background: "#f5f3ef" }}>

      {/* ── HERO ── */}
      <section style={{ background: "linear-gradient(135deg, #2D6B7F 0%, #7B8EC8 55%, #C8E63C 100%)", minHeight: "85vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px" }}>
        <div className="max-w-4xl mx-auto text-center">

          <img src="https://media.base44.com/images/public/699c9815c81b2b13b2643a48/632f46e8b_NOVI-WHITEGREEN.png" alt="NOVI Society" style={{ width: 350, maxWidth: "90vw", marginBottom: "24px", display: "block", marginLeft: "auto", marginRight: "auto" }} />
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "rgba(255,255,255,0.9)", fontStyle: "italic", fontWeight: 300, lineHeight: 1.3, marginBottom: "24px" }}>A New Way to Be Seen</p>
          <p style={{ fontSize: "clamp(1rem, 2.5vw, 1.2rem)", color: "rgba(255,255,255,0.88)", lineHeight: 1.75, maxWidth: "680px", margin: "0 auto 16px" }}>NOVI is a next-generation aesthetics ecosystem designed to elevate both providers and patients through technology, compliance infrastructure, and community.</p>
          <p style={{ fontSize: "clamp(0.9rem, 2vw, 1.05rem)", color: "rgba(255,255,255,0.65)", lineHeight: 1.75, maxWidth: "600px", margin: "0 auto 48px", fontStyle: "italic" }}>More than a platform, NOVI is a <strong style={{ color: "#C8E63C", fontWeight: 600, fontStyle: "normal" }}>Society</strong> — a trusted environment where providers build thriving practices and patients find the right care with confidence.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="px-10 py-6 rounded-full text-base font-bold" style={{ background: "#C8E63C", color: "#1e2535", border: "none" }} onClick={() => document.getElementById("offerings").scrollIntoView({ behavior: "smooth" })}>Reserve Your Spot <ArrowRight className="ml-2 w-5 h-5" /></Button>
            <Button size="lg" variant="outline" className="px-10 py-6 rounded-full text-base font-medium" style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.5)", color: "#fff" }} onClick={() => window.location.href = "tel:8178936317"}><Phone className="mr-2 w-5 h-5" />Call Now</Button>
            <Button size="lg" variant="outline" className="px-10 py-6 rounded-full text-base font-medium" style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.5)", color: "#fff" }} onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
          </div>
        </div>
      </section>

      {/* ── 4 PILLARS ── */}
      <section id="pillars" className="py-24 px-6" style={{ background: "#fff" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>The NOVI Ecosystem</p>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(2.25rem, 6vw, 3.5rem)", color: "#1e2535", fontStyle: "italic", fontWeight: 400, lineHeight: 1.1, marginBottom: "16px" }}>Four Pillars of NOVI Society</h2>
            <p className="max-w-2xl mx-auto text-base leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>The NOVI ecosystem is built around four core pillars that guide every step of the journey — in the order of the provider and patient experience.</p>
          </div>
          <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
            {["Certification", "Compliance", "Connection", "Community"].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="px-4 py-1.5 rounded-full text-sm font-semibold" style={{ background: "rgba(200,230,60,0.15)", color: "#3d5a0a", border: "1px solid rgba(200,230,60,0.3)" }}>{label}</span>
                {i < 3 && <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.25)" }} />}
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {pillars.map((pillar, idx) => (
              <div key={idx} className="p-8 rounded-2xl" style={{ background: "#f9f8f6", border: "1px solid rgba(0,0,0,0.07)" }}>
                <div className="flex items-start gap-4 mb-5">
                  <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "2.5rem", color: "#C8E63C", fontStyle: "italic", lineHeight: 1, flexShrink: 0, fontWeight: 400 }}>{pillar.number}</span>
                  <div>
                    <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.4rem", color: "#1e2535", fontStyle: "italic", fontWeight: 400, marginBottom: "4px" }}>{pillar.title}</h3>
                    <p className="text-sm font-medium" style={{ color: "#2D6B7F" }}>{pillar.subtitle}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.75 }}>{pillar.description}</p>
                <p className="text-sm font-medium italic" style={{ color: "#2D6B7F", borderLeft: "2px solid #C8E63C", paddingLeft: "12px" }}>{pillar.outcome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INDUSTRY PROBLEM ── */}
      <section className="py-24 px-6" style={{ background: "#1e2535" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>The Problem</p>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(2rem, 5vw, 3.25rem)", color: "#fff", fontStyle: "italic", fontWeight: 400, lineHeight: 1.15, marginBottom: "28px" }}>The Aesthetics Industry Has a<br />Trust Problem.</h2>
          <p className="text-base leading-relaxed mb-6 max-w-3xl mx-auto" style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.8 }}>Unlicensed platforms and unstructured training pipelines have saturated the market — making it increasingly difficult to distinguish qualified practitioners from those operating without proper oversight, education, or compliance infrastructure.</p>
          <p className="text-base leading-relaxed mb-10 max-w-3xl mx-auto" style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.8 }}>The result? Medical Directors face liability exposure. Providers operate in legal grey zones. Patients have no reliable way to verify credentials or safety standards. The entire industry suffers when there is no standard to uphold.</p>
          <div className="grid sm:grid-cols-3 gap-4 mb-12">
            {[{ label: "Medical Directors", issue: "Exposed to liability without proper oversight infrastructure" }, { label: "Providers", issue: "Left to navigate compliance, training, and oversight alone" }, { label: "Patients", issue: "No reliable way to verify credentials or safety standards" }].map((item, i) => (
              <div key={i} className="p-6 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#C8E63C" }}>{item.label}</p>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{item.issue}</p>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "40px" }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.35rem, 3.5vw, 2rem)", color: "#fff", fontStyle: "italic", fontWeight: 400, lineHeight: 1.4, marginBottom: "16px" }}>Qualified providers deserve better than this.</p>
            <p className="text-base max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.75 }}>NOVI was built to give serious, licensed aesthetic professionals the platform, structure, and community they have always deserved — and the industry has always needed.</p>
          </div>
        </div>
      </section>

      {/* ── WHY DIFFERENT ── */}
      <section className="py-24 px-6" style={{ background: "#f5f3ef" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>Why NOVI</p>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(2.25rem, 6vw, 3.5rem)", color: "#1e2535", fontStyle: "italic", fontWeight: 400, lineHeight: 1.1 }}>Nothing Else Like It</h2>
            <p className="mt-4 max-w-2xl mx-auto text-base leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>NOVI isn't a marketplace, a course catalog, or a scheduling tool. It's the infrastructure layer that connects all of them.</p>
          </div>
          <div className="space-y-4">
            {differentiators.map((item, idx) => (
              <div key={idx} className="flex gap-6 p-7 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ background: "rgba(200,230,60,0.2)" }}><Check className="w-4 h-4" style={{ color: "#5a7a20" }} /></div>
                <div><h3 className="font-bold text-base mb-1.5" style={{ color: "#1e2535" }}>{item.title}</h3><p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.68)", lineHeight: 1.7 }}>{item.description}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center p-10 rounded-3xl" style={{ background: "linear-gradient(135deg, #2D6B7F, #7B8EC8)" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(200,230,60,0.8)", letterSpacing: "0.2em" }}>The NOVI Ecosystem Flow</p>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.25rem, 3vw, 1.75rem)", color: "#fff", fontStyle: "italic", fontWeight: 400, lineHeight: 1.4, marginBottom: "16px" }}>Certification → Compliance → Connection → Community</p>
            <p className="text-sm max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>This structure supports providers from the moment they enter the industry through the entire lifecycle of building a successful aesthetic practice.</p>
          </div>
        </div>
      </section>

      {/* ── TECHNOLOGY ── */}
      <section className="py-24 px-6" style={{ background: "#fff" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>The NOVI Intelligence Layer</p>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(2.25rem, 6vw, 3.5rem)", color: "#1e2535", fontStyle: "italic", fontWeight: 400, lineHeight: 1.1, marginBottom: "16px" }}>Technology Like You've<br />Never Seen Before</h2>
            <p className="max-w-2xl mx-auto text-base leading-relaxed" style={{ color: "rgba(30,37,53,0.62)" }}>NOVI isn't powered by a scheduling engine. It's powered by intelligence — built specifically for the aesthetics industry, with capabilities no other platform has ever brought to market.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="p-8 rounded-2xl" style={{ background: "linear-gradient(145deg, #1e2535, #2D4060)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}><Zap className="w-5 h-5" style={{ color: "#C8E63C" }} /></div><p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#C8E63C" }}>Market Intelligence</p></div>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.5rem", color: "#fff", fontStyle: "italic", fontWeight: 400, marginBottom: "14px" }}>Know Exactly Where You Stand — Instantly</h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>The moment you join NOVI, you get access to real-time, data-driven market analysis of your competitive landscape. See what services are in demand in your area, where gaps exist, and what your unique strengths are as a provider.</p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>NOVI's guidance doesn't just describe the market — it tells you specifically what could set <em>you</em> apart, based on your credentials, location, and the data it sees across the entire Society.</p>
              <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}><p className="text-xs font-semibold italic" style={{ color: "#C8E63C" }}>"No consultant, coach, or tool has ever offered this to aesthetic providers. Until now."</p></div>
            </div>
            <div className="p-8 rounded-2xl" style={{ background: "linear-gradient(145deg, #1e3530, #2D6B60)", border: "1px solid rgba(200,230,60,0.12)" }}>
              <div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}><Heart className="w-5 h-5" style={{ color: "#C8E63C" }} /></div><p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#C8E63C" }}>Living Patient Ecosystem</p></div>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.5rem", color: "#fff", fontStyle: "italic", fontWeight: 400, marginBottom: "14px" }}>Real Daily Results. Delivered Back to You.</h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>NOVI's patient marketplace doesn't end at booking. Every patient tracks their recovery and results in real time through daily check-ins — photos, symptoms, comfort levels, and progress milestones — all fed directly back to you.</p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>This continuous data loop lets you personalize follow-ups, create deeply loyal patient relationships, and generate retention like you've never experienced.</p>
              <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(200,230,60,0.15)" }}><p className="text-xs font-semibold italic" style={{ color: "#C8E63C" }}>"Every check-in is an insight. Every insight is a reason to come back."</p></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[{ stat: "Real-time", label: "Daily patient result tracking" }, { stat: "Instant", label: "Competitive market intelligence" }, { stat: "AI-driven", label: "Personalized provider guidance" }].map((item, i) => (
              <div key={i} className="text-center p-6 rounded-2xl" style={{ background: "#f9f8f6", border: "1px solid rgba(0,0,0,0.07)" }}>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "#2D6B7F", fontStyle: "italic", fontWeight: 400, marginBottom: "6px" }}>{item.stat}</p>
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURSES & SERVICES ── */}
      <section id="offerings" className="py-24 px-6" style={{ background: "#fff" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>Get Started</p>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(2.25rem, 6vw, 3.5rem)", color: "#1e2535", fontStyle: "italic", fontWeight: 400, lineHeight: 1.1 }}>Courses & Services</h2>
            <p className="mt-3 text-base" style={{ color: "rgba(30,37,53,0.6)" }}>Reserve Your Spot!</p>
          </div>
          <NoviOfferingsPortal>
            {({ courses, serviceTypes, isLoadingCourses, openCourseModal, openServiceModal, isCourseFullySoldOut }) => (
              <Tabs defaultValue="courses" className="w-full">
                <TabsList className="grid w-full max-w-sm mx-auto grid-cols-2 mb-10 p-1 rounded-xl" style={{ background: "rgba(45,107,127,0.08)" }}>
                  <TabsTrigger value="courses" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Training Courses</TabsTrigger>
                  <TabsTrigger value="services" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">MD Services</TabsTrigger>
                </TabsList>
                <TabsContent value="courses">
                  {isLoadingCourses && (
                    <div className="text-center py-14 rounded-2xl" style={{ color: "rgba(30,37,53,0.4)" }}>Loading courses…</div>
                  )}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {!isLoadingCourses && courses.map((course) => {
                      const soldOut = isCourseFullySoldOut(course);
                      const img = course.cover_image_url || DEFAULT_COURSE_IMAGE_URL;
                      return (
                        <div
                          key={course.id}
                          onClick={() => !soldOut && openCourseModal(course)}
                          className={`group rounded-2xl overflow-hidden transition-all duration-200 ${!soldOut ? "cursor-pointer hover:-translate-y-1 hover:shadow-md" : "cursor-not-allowed opacity-75"}`}
                          style={{ background: "#f9f8f6", border: "1px solid rgba(0,0,0,0.07)" }}
                        >
                          <div className="relative h-44 overflow-hidden">
                            <img src={img} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            {course.price != null && course.price !== "" && (
                              <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg font-bold text-white text-sm" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
                                ${Number(course.price).toLocaleString()}
                              </div>
                            )}
                          </div>
                          <div className="p-5">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(123,142,200,0.12)", color: "#2D6B7F" }}>{course.category?.replace(/_/g, " ")}</span>
                            <h3 className="font-bold text-base mt-3 mb-2 leading-tight" style={{ color: "#1e2535" }}>{course.title}</h3>
                            {course.description && <p className="text-sm line-clamp-2 mb-3" style={{ color: "rgba(30,37,53,0.6)" }}>{course.description}</p>}
                            <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                              {course.duration_hours && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{course.duration_hours}h</span>}
                              {course.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{course.location}</span>}
                            </div>
                            <div className="flex items-center justify-between mt-4 pt-4 text-sm font-semibold" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", color: soldOut ? "#e05555" : "#2D6B7F" }}>
                              {soldOut ? <span>Sold Out</span> : <><span>View & Reserve</span><ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {!isLoadingCourses && courses.length === 0 && (
                      <div className="col-span-3 text-center py-14 rounded-2xl" style={{ background: "rgba(0,0,0,0.02)" }}>
                        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p style={{ color: "rgba(30,37,53,0.4)" }}>Courses coming soon</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="services">
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {serviceTypes.map((service) => (
                      <div key={service.id} onClick={() => openServiceModal(service)} className="group cursor-pointer rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md" style={{ background: "#f9f8f6", border: "1px solid rgba(0,0,0,0.07)" }}>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(45,107,127,0.1)", color: "#2D6B7F" }}>{service.category?.replace(/_/g, " ")}</span>
                        <h3 className="font-bold text-base mt-3 mb-2 leading-tight" style={{ color: "#1e2535" }}>{service.name}</h3>
                        {service.description && <p className="text-sm line-clamp-3 mb-4" style={{ color: "rgba(30,37,53,0.6)" }}>{service.description}</p>}
                        {service.monthly_fee && <div className="flex items-baseline gap-1 mb-4"><span className="text-2xl font-bold" style={{ color: "#2D6B7F" }}>${service.monthly_fee}</span><span className="text-sm" style={{ color: "rgba(30,37,53,0.45)" }}>/month</span></div>}
                        <div className="flex items-center justify-between text-sm font-semibold" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "12px", color: "#2D6B7F" }}><span>Save Your Spot</span><ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></div>
                      </div>
                    ))}
                    {serviceTypes.length === 0 && <div className="col-span-3 text-center py-14 rounded-2xl" style={{ background: "rgba(0,0,0,0.02)" }}><Shield className="w-10 h-10 mx-auto mb-3 opacity-20" /><p style={{ color: "rgba(30,37,53,0.4)" }}>Services coming soon</p></div>}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </NoviOfferingsPortal>
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section className="py-20 px-6 text-center" style={{ background: "#1e2535" }}>
        <div className="max-w-2xl mx-auto">
          <img src="https://media.base44.com/images/public/699c9815c81b2b13b2643a48/632f46e8b_NOVI-WHITEGREEN.png" alt="NOVI Society" style={{ width: 280, maxWidth: "80vw", display: "block", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.1rem, 3vw, 1.5rem)", color: "rgba(255,255,255,0.6)", fontStyle: "italic", fontWeight: 300, marginBottom: "32px" }}>A New Way to Be Seen</p>
          <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>Limited founding memberships · Priority consideration for licensed professionals.</p>
          <Button size="lg" className="px-12 py-6 rounded-full text-base font-bold" style={{ background: "#C8E63C", color: "#1e2535", border: "none" }} onClick={() => document.getElementById("offerings").scrollIntoView({ behavior: "smooth" })}>Reserve Your Spot <ArrowRight className="ml-2 w-5 h-5" /></Button>
        </div>
      </section>

      <NoviFooter />
    </div>
  );
}
