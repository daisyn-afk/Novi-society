import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles, Award, Shield, Users, Heart, ArrowRight, Check,
  BookOpen, Clock, MapPin, ChevronRight, Calendar, Zap, CheckCircle2, User, Upload, ImageIcon
} from "lucide-react";

const pillars = [
  {
    number: "01",
    icon: Award,
    title: "Certification",
    subtitle: "Where the journey begins.",
    description: "NOVI creates a direct pathway from education to active practice. Providers enter the NOVI ecosystem through certification, training, and mentorship designed to ensure they begin their careers with the proper knowledge, skill foundation, and professional support.",
    outcome: "Certification establishes the credibility and preparation required to safely enter the field of aesthetic medicine.",
    accent: "#C8E63C",
  },
  {
    number: "02",
    icon: Shield,
    title: "Compliance",
    subtitle: "The structure that protects providers and patients.",
    description: "Once certified, providers operate within NOVI's integrated compliance framework. This includes medical director oversight, scope-of-practice management, documentation, chart review, and regulatory safeguards.",
    outcome: "Compliance ensures that every provider within the NOVI Society practices within a safe, legally supported medical structure.",
    accent: "#7B8EC8",
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Connection",
    subtitle: "Where providers meet patients.",
    description: "Through advanced patient matching technology, treatment conversations, and facial analysis tools, NOVI connects patients with the providers best suited for their goals and treatment needs. Rather than patients searching blindly, NOVI intelligently guides them to trusted providers within the Society.",
    outcome: "Connection turns discovery into meaningful relationships.",
    accent: "#2D6B7F",
  },
  {
    number: "04",
    icon: Heart,
    title: "Community",
    subtitle: "The long-term growth engine.",
    description: "NOVI Society creates a collaborative environment where providers continue to grow through mentorship, shared knowledge, and professional support. Patients remain connected through ongoing care, education, and trusted provider relationships.",
    outcome: "Community transforms the platform from a service into a movement within the aesthetics industry.",
    accent: "#C8E63C",
  },
];

const differentiators = [
  {
    title: "The Only Platform with Built-In MD Coverage",
    description: "Every other platform leaves you to find your own Medical Director. NOVI integrates physician oversight directly — scope management, chart reviews, and compliance are handled within the platform.",
  },
  {
    title: "A Complete Career Pipeline, Not Just a Course",
    description: "Training → Credential Verification → Medical Oversight → Active Practice → Patient Growth. NOVI is structured to support your entire career, not just get you certified.",
  },
  {
    title: "Technology That Has Never Existed in This Industry",
    description: "Instant data-driven market intelligence shows you exactly where you stand competitively, what your strengths are, and what could differentiate you even further. NOVI's AI does what no consultant, coach, or tool has ever done for aesthetic providers before.",
  },
  {
    title: "A Living Patient Ecosystem, Not Just a Booking App",
    description: "NOVI tracks patient results in real daily time — feeding recovery data, satisfaction signals, and outcome trends directly back to you. Every check-in becomes insight. Every insight becomes retention.",
  },
  {
    title: "One System. Everything Included.",
    description: "Scheduling, documentation, compliance, payments, messaging, and analytics — all in one platform. No stitching together 6 different tools to run your practice.",
  },
];

const BLANK_FORM = { customer_name: "", customer_email: "", phone: "", notes: "", license_type: "RN", license_number: "", license_state: "", license_image_url: "" };

export default function NoviLanding() {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  // Course modal steps: "dates" | "info" | "submitted"
  const [courseStep, setCourseStep] = useState("dates");
  const [selectedCourseDate, setSelectedCourseDate] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);

  const { data: courses = [] } = useQuery({
    queryKey: ["landing-courses"],
    queryFn: () => base44.entities.Course.filter({ type: "scheduled", is_active: true }),
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["landing-services"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const submitMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke("submitPreOrderRequest", payload),
    onSuccess: () => setCourseStep("submitted"),
  });

  const openCourseModal = (course) => {
    setSelectedCourse(course);
    setCourseStep("dates");
    setSelectedCourseDate(null);
    setForm(BLANK_FORM);
  };

  const closeCourseModal = () => {
    setSelectedCourse(null);
    setCourseStep("dates");
    setSelectedCourseDate(null);
    setForm(BLANK_FORM);
  };

  const [licenseUploading, setLicenseUploading] = useState(false);

  const handleLicenseUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLicenseUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, license_image_url: file_url }));
    setLicenseUploading(false);
  };

  const handleSubmitApplication = () => {
    if (!form.customer_name || !form.customer_email || !form.license_number || !form.license_image_url) return;
    submitMutation.mutate({
      customer_name: form.customer_name,
      customer_email: form.customer_email,
      phone: form.phone || null,
      notes: form.notes || null,
      order_type: "course",
      course_id: selectedCourse.id,
      course_date: selectedCourseDate,
      license_type: form.license_type,
      license_number: form.license_number,
      license_state: form.license_state || null,
      license_image_url: form.license_image_url || null,
    });
  };

  const handleServicePreOrder = (service) => {
    const params = new URLSearchParams();
    params.set("type", "service");
    params.set("id", service.id);
    window.location.href = `/PreOrderCheckout?${params.toString()}`;
  };

  return (
    <div className="min-h-screen" style={{ background: "#f5f3ef" }}>

      {/* ── HERO ── */}
      <section style={{
        background: "linear-gradient(135deg, #2D6B7F 0%, #7B8EC8 55%, #C8E63C 100%)",
        minHeight: "85vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
      }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full mb-10" style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.25)",
          }}>
            <Sparkles className="w-4 h-4" style={{ color: "#C8E63C" }} />
            <span className="text-sm font-semibold text-white tracking-wide">Pre-Launch · Reservations Open</span>
          </div>

          <h1 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(4rem, 14vw, 8rem)",
            color: "#fff",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: 0.9,
            marginBottom: "24px",
          }}>
            NOVI
          </h1>

          <p style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
            color: "rgba(255,255,255,0.9)",
            fontStyle: "italic",
            fontWeight: 300,
            lineHeight: 1.3,
            marginBottom: "24px",
          }}>
            A New Way to Be Seen
          </p>

          <p style={{
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            color: "rgba(255,255,255,0.88)",
            lineHeight: 1.75,
            maxWidth: "680px",
            margin: "0 auto 16px",
          }}>
            NOVI is a next-generation aesthetics ecosystem designed to elevate both providers and patients through technology, compliance infrastructure, and community.
          </p>
          <p style={{
            fontSize: "clamp(0.9rem, 2vw, 1.05rem)",
            color: "rgba(255,255,255,0.65)",
            lineHeight: 1.75,
            maxWidth: "600px",
            margin: "0 auto 48px",
            fontStyle: "italic",
          }}>
            More than a platform, NOVI is a <strong style={{ color: "#C8E63C", fontWeight: 600, fontStyle: "normal" }}>Society</strong> — a trusted environment where providers build thriving practices and patients find the right care with confidence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="px-10 py-6 rounded-full text-base font-bold"
              style={{ background: "#C8E63C", color: "#1e2535", border: "none" }}
              onClick={() => document.getElementById("offerings").scrollIntoView({ behavior: "smooth" })}
            >
              Reserve Your Spot <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-10 py-6 rounded-full text-base font-medium"
              style={{ background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.3)", color: "#fff" }}
              onClick={() => document.getElementById("pillars").scrollIntoView({ behavior: "smooth" })}
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* ── 4 PILLARS ── */}
      <section id="pillars" className="py-24 px-6" style={{ background: "#fff" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>The NOVI Ecosystem</p>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(2.25rem, 6vw, 3.5rem)",
              color: "#1e2535",
              fontStyle: "italic",
              fontWeight: 400,
              lineHeight: 1.1,
              marginBottom: "16px",
            }}>
              Four Pillars of NOVI Society
            </h2>
            <p className="max-w-2xl mx-auto text-base leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
              The NOVI ecosystem is built around four core pillars that guide every step of the journey — in the order of the provider and patient experience.
            </p>
          </div>

          {/* Flow indicator */}
          <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
            {["Certification", "Compliance", "Connection", "Community"].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="px-4 py-1.5 rounded-full text-sm font-semibold" style={{ background: "rgba(200,230,60,0.15)", color: "#3d5a0a", border: "1px solid rgba(200,230,60,0.3)" }}>
                  {label}
                </span>
                {i < 3 && <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.25)" }} />}
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div key={idx} className="p-8 rounded-2xl" style={{
                  background: "#f9f8f6",
                  border: "1px solid rgba(0,0,0,0.07)",
                }}>
                  <div className="flex items-start gap-4 mb-5">
                    <span style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontSize: "2.5rem",
                      color: "#C8E63C",
                      fontStyle: "italic",
                      lineHeight: 1,
                      flexShrink: 0,
                      fontWeight: 400,
                    }}>{pillar.number}</span>
                    <div>
                      <h3 style={{
                        fontFamily: "'DM Serif Display', serif",
                        fontSize: "1.4rem",
                        color: "#1e2535",
                        fontStyle: "italic",
                        fontWeight: 400,
                        marginBottom: "4px",
                      }}>
                        {pillar.title}
                      </h3>
                      <p className="text-sm font-medium" style={{ color: "#2D6B7F" }}>{pillar.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.75 }}>
                    {pillar.description}
                  </p>
                  <p className="text-sm font-medium italic" style={{ color: "#2D6B7F", borderLeft: "2px solid #C8E63C", paddingLeft: "12px" }}>
                    {pillar.outcome}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── IMAGE BREAK 1 ── */}
      <div className="grid md:grid-cols-2" style={{ minHeight: 340 }}>
        <div className="relative overflow-hidden" style={{ minHeight: 280 }}>
          <img
            src="https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&q=80"
            alt="Skincare"
            className="w-full h-full object-cover"
            style={{ minHeight: 280 }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(45,107,127,0.45) 0%, transparent 60%)" }} />
        </div>
        <div className="flex flex-col justify-center px-10 py-12" style={{ background: "#f0ede8" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>Built Different</p>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "#1e2535", fontStyle: "italic", fontWeight: 400, lineHeight: 1.2, marginBottom: 16 }}>
            Certification is where the journey begins.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.65)", lineHeight: 1.8 }}>
            Every provider in NOVI Society enters through a structured credentialing pathway — ensuring the industry's highest standard of care from day one.
          </p>
        </div>
      </div>

      {/* ── INDUSTRY PROBLEM ── */}
      <section className="py-24 px-6" style={{ background: "#1e2535" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>The Problem</p>
          <h2 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            color: "#fff",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: 1.15,
            marginBottom: "28px",
          }}>
            The Aesthetics Industry Has a<br />Trust Problem.
          </h2>
          <p className="text-base leading-relaxed mb-6 max-w-3xl mx-auto" style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.8 }}>
            Unlicensed platforms and unstructured training pipelines have saturated the market — making it increasingly difficult to distinguish qualified practitioners from those operating without proper oversight, education, or compliance infrastructure.
          </p>
          <p className="text-base leading-relaxed mb-10 max-w-3xl mx-auto" style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.8 }}>
            The result? Medical Directors face liability exposure. Providers operate in legal grey zones. Patients have no reliable way to verify credentials or safety standards. The entire industry suffers when there is no standard to uphold.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mb-12">
            {[
              { label: "Medical Directors", issue: "Exposed to liability without proper oversight infrastructure" },
              { label: "Providers", issue: "Left to navigate compliance, training, and oversight alone" },
              { label: "Patients", issue: "No reliable way to verify credentials or safety standards" },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#C8E63C" }}>{item.label}</p>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{item.issue}</p>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "40px" }}>
            <p style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(1.35rem, 3.5vw, 2rem)",
              color: "#fff",
              fontStyle: "italic",
              fontWeight: 400,
              lineHeight: 1.4,
              marginBottom: "16px",
            }}>
              Qualified providers deserve better than this.
            </p>
            <p className="text-base max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.75 }}>
              NOVI was built to give serious, licensed aesthetic professionals the platform, structure, and community they have always deserved — and the industry has always needed.
            </p>
          </div>
        </div>
      </section>

      {/* ── IMAGE BREAK 2 ── */}
      <div className="grid md:grid-cols-2" style={{ minHeight: 340 }}>
        <div className="flex flex-col justify-center px-10 py-12 order-2 md:order-1" style={{ background: "#1e2535" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>NOVI Society</p>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "#fff", fontStyle: "italic", fontWeight: 400, lineHeight: 1.2, marginBottom: 16 }}>
            A platform built for the professionals who deserve better.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
            NOVI gives providers the structure, oversight, and community infrastructure that the aesthetics industry has never had — until now.
          </p>
        </div>
        <div className="relative overflow-hidden order-1 md:order-2" style={{ minHeight: 280 }}>
          <img
            src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=900&q=80"
            alt="Aesthetic treatment"
            className="w-full h-full object-cover"
            style={{ minHeight: 280 }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(225deg, rgba(200,230,60,0.25) 0%, transparent 50%)" }} />
        </div>
      </div>

      {/* ── WHY DIFFERENT ── */}
      <section className="py-24 px-6" style={{ background: "#f5f3ef" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>Why NOVI</p>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(2.25rem, 6vw, 3.5rem)",
              color: "#1e2535",
              fontStyle: "italic",
              fontWeight: 400,
              lineHeight: 1.1,
            }}>
              Nothing Else Like It
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-base leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>
              NOVI isn't a marketplace, a course catalog, or a scheduling tool. It's the infrastructure layer that connects all of them.
            </p>
          </div>

          <div className="space-y-4">
            {differentiators.map((item, idx) => (
              <div key={idx} className="flex gap-6 p-7 rounded-2xl" style={{
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.07)",
              }}>
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{
                  background: "rgba(200,230,60,0.2)",
                }}>
                  <Check className="w-4 h-4" style={{ color: "#5a7a20" }} />
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1.5" style={{ color: "#1e2535" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.68)", lineHeight: 1.7 }}>{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pull quote */}
          <div className="mt-12 text-center p-10 rounded-3xl" style={{
            background: "linear-gradient(135deg, #2D6B7F, #7B8EC8)",
          }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(200,230,60,0.8)", letterSpacing: "0.2em" }}>The NOVI Ecosystem Flow</p>
            <p style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
              color: "#fff",
              fontStyle: "italic",
              fontWeight: 400,
              lineHeight: 1.4,
              marginBottom: "16px",
            }}>
              Certification → Compliance → Connection → Community
            </p>
            <p className="text-sm max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
              This structure supports providers from the moment they enter the industry through the entire lifecycle of building a successful aesthetic practice.
            </p>
          </div>
        </div>
      </section>

      {/* ── IMAGE BREAK 3 ── */}
      <div className="grid md:grid-cols-3" style={{ minHeight: 260 }}>
        <div className="relative overflow-hidden" style={{ minHeight: 220 }}>
          <img src="https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&q=80" alt="Skincare" className="w-full h-full object-cover" style={{ minHeight: 220 }} />
        </div>
        <div className="relative overflow-hidden" style={{ minHeight: 220 }}>
          <img src="https://images.unsplash.com/photo-1526758097130-bab247274f58?w=600&q=80" alt="Beauty" className="w-full h-full object-cover" style={{ minHeight: 220 }} />
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(45,107,127,0.55)" }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(2rem, 5vw, 3rem)", color: "#fff", fontStyle: "italic", fontWeight: 400 }}>novi</p>
          </div>
        </div>
        <div className="relative overflow-hidden" style={{ minHeight: 220 }}>
          <img src="https://images.unsplash.com/photo-1617897903246-719242758050?w=600&q=80" alt="Aesthetic" className="w-full h-full object-cover" style={{ minHeight: 220 }} />
        </div>
      </div>

      {/* ── TECHNOLOGY ── */}
      <section className="py-24 px-6" style={{ background: "#fff" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>The NOVI Intelligence Layer</p>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(2.25rem, 6vw, 3.5rem)",
              color: "#1e2535",
              fontStyle: "italic",
              fontWeight: 400,
              lineHeight: 1.1,
              marginBottom: "16px",
            }}>
              Technology Like You've<br />Never Seen Before
            </h2>
            <p className="max-w-2xl mx-auto text-base leading-relaxed" style={{ color: "rgba(30,37,53,0.62)" }}>
              NOVI isn't powered by a scheduling engine. It's powered by intelligence — built specifically for the aesthetics industry, with capabilities no other platform has ever brought to market.
            </p>
          </div>

          {/* Two-column tech cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Card 1: Market Intelligence */}
            <div className="p-8 rounded-2xl" style={{ background: "linear-gradient(145deg, #1e2535, #2D4060)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}>
                  <Zap className="w-5 h-5" style={{ color: "#C8E63C" }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#C8E63C" }}>Market Intelligence</p>
              </div>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.5rem", color: "#fff", fontStyle: "italic", fontWeight: 400, marginBottom: "14px" }}>
                Know Exactly Where You Stand — Instantly
              </h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
                The moment you join NOVI, you get access to real-time, data-driven market analysis of your competitive landscape. See what services are in demand in your area, where gaps exist, and what your unique strengths are as a provider.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
                NOVI's guidance doesn't just describe the market — it tells you specifically what could set <em>you</em> apart, based on your credentials, location, and the data it sees across the entire Society.
              </p>
              <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs font-semibold italic" style={{ color: "#C8E63C" }}>
                  "No consultant, coach, or tool has ever offered this to aesthetic providers. Until now."
                </p>
              </div>
            </div>

            {/* Card 2: Living Patient Ecosystem */}
            <div className="p-8 rounded-2xl" style={{ background: "linear-gradient(145deg, #1e3530, #2D6B60)", border: "1px solid rgba(200,230,60,0.12)" }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}>
                  <Heart className="w-5 h-5" style={{ color: "#C8E63C" }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#C8E63C" }}>Living Patient Ecosystem</p>
              </div>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.5rem", color: "#fff", fontStyle: "italic", fontWeight: 400, marginBottom: "14px" }}>
                Real Daily Results. Delivered Back to You.
              </h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
                NOVI's patient marketplace doesn't end at booking. Every patient tracks their recovery and results in real time through daily check-ins — photos, symptoms, comfort levels, and progress milestones — all fed directly back to you.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
                This continuous data loop lets you personalize follow-ups, create deeply loyal patient relationships, and generate retention like you've never experienced. Patients will love NOVI for more than just you and their treatment.
              </p>
              <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(200,230,60,0.15)" }}>
                <p className="text-xs font-semibold italic" style={{ color: "#C8E63C" }}>
                  "Every check-in is an insight. Every insight is a reason to come back."
                </p>
              </div>
            </div>
          </div>

          {/* Bottom stat strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { stat: "Real-time", label: "Daily patient result tracking" },
              { stat: "Instant", label: "Competitive market intelligence" },
              { stat: "AI-driven", label: "Personalized provider guidance" },
            ].map((item, i) => (
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
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(2.25rem, 6vw, 3.5rem)",
              color: "#1e2535",
              fontStyle: "italic",
              fontWeight: 400,
              lineHeight: 1.1,
            }}>
              Courses & Services
            </h2>
            <p className="mt-3 text-base" style={{ color: "rgba(30,37,53,0.6)" }}>Reserve your spot before launch — Q2 2026</p>
          </div>

          <Tabs defaultValue="courses" className="w-full">
            <TabsList className="grid w-full max-w-sm mx-auto grid-cols-2 mb-10 p-1 rounded-xl" style={{ background: "rgba(45,107,127,0.08)" }}>
              <TabsTrigger value="courses" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Training Courses</TabsTrigger>
              <TabsTrigger value="services" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">MD Services</TabsTrigger>
            </TabsList>

            <TabsContent value="courses">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {courses.map(course => (
                  <div key={course.id}
                    onClick={() => openCourseModal(course)}
                    className="group cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                    style={{ background: "#f9f8f6", border: "1px solid rgba(0,0,0,0.07)" }}>
                    {course.cover_image_url && (
                      <div className="relative h-44 overflow-hidden">
                        <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        {course.price && (
                          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg font-bold text-white text-sm" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
                            ${Number(course.price).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-5">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(123,142,200,0.12)", color: "#2D6B7F" }}>
                        {course.category?.replace(/_/g, " ")}
                      </span>
                      <h3 className="font-bold text-base mt-3 mb-2 leading-tight" style={{ color: "#1e2535" }}>{course.title}</h3>
                      {course.description && (
                        <p className="text-sm line-clamp-2 mb-3" style={{ color: "rgba(30,37,53,0.6)" }}>{course.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                        {course.duration_hours && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{course.duration_hours}h</span>}
                        {course.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{course.location}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 text-sm font-semibold" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", color: "#2D6B7F" }}>
                        <span>View & Reserve</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                ))}
                {courses.length === 0 && (
                  <div className="col-span-3 text-center py-14 rounded-2xl" style={{ background: "rgba(0,0,0,0.02)" }}>
                    <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p style={{ color: "rgba(30,37,53,0.4)" }}>Courses coming soon</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="services">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {serviceTypes.map(service => (
                  <div key={service.id}
                    onClick={() => setSelectedService(service)}
                    className="group cursor-pointer rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                    style={{ background: "#f9f8f6", border: "1px solid rgba(0,0,0,0.07)" }}>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(45,107,127,0.1)", color: "#2D6B7F" }}>
                      {service.category?.replace(/_/g, " ")}
                    </span>
                    <h3 className="font-bold text-base mt-3 mb-2 leading-tight" style={{ color: "#1e2535" }}>{service.name}</h3>
                    {service.description && (
                      <p className="text-sm line-clamp-3 mb-4" style={{ color: "rgba(30,37,53,0.6)" }}>{service.description}</p>
                    )}
                    {service.monthly_fee && (
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-2xl font-bold" style={{ color: "#2D6B7F" }}>${service.monthly_fee}</span>
                        <span className="text-sm" style={{ color: "rgba(30,37,53,0.45)" }}>/month</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm font-semibold" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "12px", color: "#2D6B7F" }}>
                      <span>Reserve Service</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
                {serviceTypes.length === 0 && (
                  <div className="col-span-3 text-center py-14 rounded-2xl" style={{ background: "rgba(0,0,0,0.02)" }}>
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p style={{ color: "rgba(30,37,53,0.4)" }}>Services coming soon</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section className="py-20 px-6 text-center" style={{ background: "#1e2535" }}>
        <div className="max-w-2xl mx-auto">
          <h2 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(2.5rem, 8vw, 4rem)",
            color: "#fff",
            fontStyle: "italic",
            fontWeight: 400,
            marginBottom: "8px",
          }}>
            NOVI Society
          </h2>
          <p style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
            color: "rgba(255,255,255,0.6)",
            fontStyle: "italic",
            fontWeight: 300,
            marginBottom: "32px",
          }}>
            A New Way to Be Seen
          </p>
          <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            Launching Q2 2026 · Limited founding memberships · Priority consideration for licensed professionals.
          </p>
          <Button
            size="lg"
            className="px-12 py-6 rounded-full text-base font-bold"
            style={{ background: "#C8E63C", color: "#1e2535", border: "none" }}
            onClick={() => document.getElementById("offerings").scrollIntoView({ behavior: "smooth" })}
          >
            Reserve Your Spot <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* ── COURSE DIALOG ── */}
      <Dialog open={!!selectedCourse} onOpenChange={closeCourseModal}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          {selectedCourse && courseStep !== "submitted" && (
            <DialogHeader className="pb-2">
              <div className="flex items-center gap-3 mb-1">
                {/* Step indicator */}
                {["dates", "info"].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{
                      background: courseStep === step ? "#C8E63C" : i < ["dates","info"].indexOf(courseStep) ? "rgba(200,230,60,0.3)" : "rgba(0,0,0,0.08)",
                      color: courseStep === step ? "#1a2540" : "rgba(30,37,53,0.4)",
                    }}>
                      {i + 1}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: courseStep === step ? "#1e2535" : "rgba(30,37,53,0.4)" }}>
                      {step === "dates" ? "Select Date" : "Your Details"}
                    </span>
                    {i < 1 && <span style={{ color: "rgba(30,37,53,0.2)", marginLeft: 4, marginRight: 4 }}>→</span>}
                  </div>
                ))}
              </div>
              <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "#1e2535", fontSize: "1.6rem", marginTop: 8 }}>
                {selectedCourse.title}
              </DialogTitle>
              <div className="flex flex-wrap gap-3 text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                {selectedCourse.price && <span className="font-bold" style={{ color: "#2D6B7F" }}>${Number(selectedCourse.price).toLocaleString()}</span>}
                {selectedCourse.duration_hours && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedCourse.duration_hours}h</span>}
                {selectedCourse.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedCourse.location}</span>}
              </div>
            </DialogHeader>
          )}

          {selectedCourse && courseStep === "dates" && (
            <div className="space-y-4 pt-2">
              {selectedCourse.description && (
                <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>{selectedCourse.description}</p>
              )}

              {selectedCourse.instructor_name && (
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                  <span className="font-semibold">Instructor:</span> {selectedCourse.instructor_name}
                </p>
              )}

              <div>
                <h4 className="font-bold mb-3 text-sm uppercase tracking-wide" style={{ color: "rgba(30,37,53,0.5)" }}>
                  {(() => { const t = new Date(); t.setHours(0,0,0,0); return selectedCourse.session_dates?.filter(s => s.date && new Date(s.date.split('T')[0] + 'T12:00:00') >= t).length > 0; })()
                    ? "Select an Available Date"
                    : "Available Dates"}
                </h4>

                {(() => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const upcomingDates = (selectedCourse.session_dates || [])
                    .filter(s => s.date && new Date(s.date.split('T')[0] + 'T12:00:00') >= today)
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                  if (upcomingDates.length === 0) {
                    return (
                      <div className="text-center py-8 rounded-xl" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}>
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm" style={{ color: "rgba(30,37,53,0.4)" }}>No upcoming dates scheduled yet.</p>
                        <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.3)" }}>Check back soon or continue to submit your interest.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {upcomingDates.map((session, idx) => (
                        <div key={idx}
                          onClick={() => setSelectedCourseDate(session.date)}
                          className="p-4 rounded-xl cursor-pointer transition-all"
                          style={{
                            background: selectedCourseDate === session.date ? "rgba(200,230,60,0.1)" : "rgba(0,0,0,0.02)",
                            border: selectedCourseDate === session.date ? "2px solid #C8E63C" : "1px solid rgba(0,0,0,0.07)",
                          }}>
                          <div className="flex items-center justify-between">
                            <div>
                              {session.label && <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: "#2D6B7F" }}>{session.label}</p>}
                              <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>
                                {new Date(session.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                              </p>
                              {(session.start_time || session.end_time) && (
                                <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                                  {session.start_time}{session.end_time ? ` – ${session.end_time}` : ""}
                                  {session.location ? ` · ${session.location}` : ""}
                                </p>
                              )}
                            </div>
                            {selectedCourseDate === session.date
                              ? <Check className="w-5 h-5 flex-shrink-0" style={{ color: "#5a7a20" }} />
                              : <div className="w-5 h-5 rounded-full border-2 flex-shrink-0" style={{ borderColor: "rgba(0,0,0,0.15)" }} />
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <Button
                className="w-full py-5 text-base font-bold rounded-xl"
                style={{ background: "#C8E63C", color: "#1a2540" }}
                onClick={() => setCourseStep("info")}
                disabled={(() => { const t = new Date(); t.setHours(0,0,0,0); return selectedCourse.session_dates?.filter(s => s.date && new Date(s.date.split('T')[0] + 'T12:00:00') >= t).length > 0 && !selectedCourseDate; })()}
              >
                Continue <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              {(() => { const t = new Date(); t.setHours(0,0,0,0); return selectedCourse.session_dates?.filter(s => s.date && new Date(s.date.split('T')[0] + 'T12:00:00') >= t).length > 0 && !selectedCourseDate; })() && (
                <p className="text-center text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Please select a date to continue</p>
              )}
            </div>
          )}

          {selectedCourse && courseStep === "info" && (
            <div className="space-y-5 pt-2">
              {selectedCourseDate && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
                  <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "#5a7a20" }} />
                  <p className="text-sm font-semibold" style={{ color: "#3d5a0a" }}>
                    {new Date(selectedCourseDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </p>
                  <button onClick={() => setCourseStep("dates")} className="ml-auto text-xs underline" style={{ color: "rgba(30,37,53,0.45)" }}>Change</button>
                </div>
              )}

              {/* Personal info */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#2D6B7F" }}>
                  <User className="w-3.5 h-3.5" /> Personal Information
                </p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Full Name *</Label>
                    <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Jane Smith" className="h-11 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Email *</Label>
                      <Input type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} placeholder="jane@example.com" className="h-11 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Phone</Label>
                      <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 123-4567" className="h-11 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* License */}
              <div className="pt-4 border-t" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#2D6B7F" }}>
                  <Shield className="w-3.5 h-3.5" /> Professional License *
                </p>
                <div className="p-3 rounded-xl mb-3" style={{ background: "rgba(200,230,60,0.07)", border: "1px solid rgba(200,230,60,0.2)" }}>
                  <p className="text-xs" style={{ color: "#5a7a20" }}>NOVI courses are available to licensed healthcare professionals only. Your license will be verified before enrollment is confirmed.</p>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>License Type *</Label>
                      <Select value={form.license_type} onValueChange={v => setForm(f => ({ ...f, license_type: v }))}>
                        <SelectTrigger className="h-11 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RN">RN – Registered Nurse</SelectItem>
                          <SelectItem value="NP">NP – Nurse Practitioner</SelectItem>
                          <SelectItem value="PA">PA – Physician Assistant</SelectItem>
                          <SelectItem value="MD">MD – Medical Doctor</SelectItem>
                          <SelectItem value="DO">DO – Doctor of Osteopathy</SelectItem>
                          <SelectItem value="esthetician">Licensed Esthetician</SelectItem>
                          <SelectItem value="other">Other Healthcare Professional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>License Number *</Label>
                      <Input value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} placeholder="e.g. RN-123456" className="h-11 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Issuing State</Label>
                    <Input value={form.license_state} onChange={e => setForm(f => ({ ...f, license_state: e.target.value.toUpperCase() }))} placeholder="e.g. TX" maxLength={2} className="h-11 rounded-xl uppercase w-28" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
                  </div>
                </div>

                {/* License photo upload */}
                <div>
                  <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>License Photo *</Label>
                  {form.license_image_url ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.3)" }}>
                      <ImageIcon className="w-5 h-5 flex-shrink-0" style={{ color: "#5a7a20" }} />
                      <span className="text-sm font-medium flex-1" style={{ color: "#3d5a0a" }}>License uploaded ✓</span>
                      <button onClick={() => setForm(f => ({ ...f, license_image_url: "" }))} className="text-xs underline" style={{ color: "rgba(30,37,53,0.4)" }}>Remove</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 p-5 rounded-xl cursor-pointer transition-all" style={{ background: "rgba(0,0,0,0.02)", border: "1.5px dashed rgba(0,0,0,0.15)" }}>
                      {licenseUploading ? (
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "#2D6B7F" }} />
                      ) : (
                        <Upload className="w-5 h-5" style={{ color: "#2D6B7F" }} />
                      )}
                      <span className="text-sm font-medium" style={{ color: "#2D6B7F" }}>
                        {licenseUploading ? "Uploading..." : "Click to upload license photo"}
                      </span>
                      <span className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>JPG, PNG or PDF</span>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleLicenseUpload} disabled={licenseUploading} />
                    </label>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Questions or Special Requests</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything you'd like us to know..." rows={3} className="rounded-xl resize-none text-sm" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
              </div>

              {submitMutation.error && (
                <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.25)" }}>
                  <p className="text-sm font-semibold" style={{ color: "#DA6A63" }}>{submitMutation.error.message}</p>
                </div>
              )}

              {(!form.customer_name || !form.customer_email || !form.license_number || !form.license_image_url) && (
                <div className="px-4 py-3 rounded-xl flex flex-col gap-1" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.2)" }}>
                  <p className="text-xs font-bold" style={{ color: "#FA6F30" }}>Please complete the following required fields:</p>
                  {!form.customer_name && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>• Full Name</p>}
                  {!form.customer_email && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>• Email Address</p>}
                  {!form.license_number && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>• License Number</p>}
                  {!form.license_image_url && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>• License Photo</p>}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setCourseStep("dates")} className="px-4" style={{ color: "rgba(30,37,53,0.5)" }}>
                  Back
                </Button>
                <Button
                  className="flex-1 py-5 text-base font-bold rounded-xl"
                  style={{ background: "#C8E63C", color: "#1a2540" }}
                  disabled={!form.customer_name || !form.customer_email || !form.license_number || !form.license_image_url || submitMutation.isPending || licenseUploading}
                  onClick={handleSubmitApplication}
                >
                  {submitMutation.isPending ? (
                    <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />Submitting...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />Submit Application</>
                  )}
                </Button>
              </div>
              <p className="text-center text-xs" style={{ color: "rgba(30,37,53,0.35)" }}>Admin reviews your license · Payment link sent upon approval</p>
            </div>
          )}

          {selectedCourse && courseStep === "submitted" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(200,230,60,0.15)" }}>
                <CheckCircle2 className="w-8 h-8" style={{ color: "#5a7a20" }} />
              </div>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.75rem", color: "#1e2535", fontStyle: "italic" }}>
                Application Submitted!
              </h3>
              <p className="text-base leading-relaxed max-w-sm mx-auto" style={{ color: "rgba(30,37,53,0.65)" }}>
                Your application for <strong>{selectedCourse.title}</strong> is now under review. We'll verify your license and send your payment link within 1–2 business days.
              </p>
              {selectedCourseDate && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.25)" }}>
                  <Calendar className="w-4 h-4" style={{ color: "#5a7a20" }} />
                  <span className="text-sm font-semibold" style={{ color: "#3d5a0a" }}>
                    {new Date(selectedCourseDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.45)" }}>
                Check <strong>{form.customer_email}</strong> for a confirmation email.
              </p>
              <Button onClick={closeCourseModal} className="mt-2 px-8 py-3 rounded-full font-bold" style={{ background: "#C8E63C", color: "#1a2540" }}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── SERVICE DIALOG ── */}
      <Dialog open={!!selectedService} onOpenChange={() => setSelectedService(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "#1e2535", fontSize: "1.5rem" }}>
              {selectedService?.name}
            </DialogTitle>
            <DialogDescription className="text-base">{selectedService?.description}</DialogDescription>
          </DialogHeader>
          {selectedService && (
            <div className="space-y-5 pt-2">
              {selectedService.monthly_fee && (
                <div className="p-5 rounded-xl" style={{ background: "rgba(45,107,127,0.06)", border: "1px solid rgba(45,107,127,0.15)" }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "rgba(30,37,53,0.5)" }}>Monthly Coverage Fee</p>
                  <p className="text-4xl font-bold" style={{ color: "#2D6B7F" }}>${selectedService.monthly_fee}<span className="text-lg font-normal">/mo</span></p>
                </div>
              )}
              {selectedService.protocol_notes && (
                <div>
                  <h4 className="font-bold mb-2" style={{ color: "#1e2535" }}>Clinical Guidelines</h4>
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "rgba(30,37,53,0.75)" }}>{selectedService.protocol_notes}</p>
                </div>
              )}
              {selectedService.allowed_areas?.length > 0 && (
                <div>
                  <h4 className="font-bold mb-2" style={{ color: "#1e2535" }}>Approved Treatment Areas</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedService.allowed_areas.map(area => (
                      <span key={area} className="px-3 py-1 rounded-lg text-sm font-medium" style={{ background: "rgba(123,142,200,0.1)", color: "#2D6B7F" }}>{area}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedService.scope_rules?.length > 0 && (
                <div>
                  <h4 className="font-bold mb-2" style={{ color: "#1e2535" }}>Scope of Practice</h4>
                  <div className="space-y-2">
                    {selectedService.scope_rules.map((rule, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm p-3 rounded-lg" style={{ background: "rgba(200,230,60,0.05)" }}>
                        <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#5a7a20" }} />
                        <span style={{ color: "rgba(30,37,53,0.8)" }}>
                          <strong style={{ color: "#2D6B7F" }}>{rule.rule_name}:</strong> {rule.rule_value} {rule.unit} {rule.description && `— ${rule.description}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button
                className="w-full py-6 text-base font-bold rounded-xl"
                style={{ background: "linear-gradient(135deg, #2D6B7F, #7B8EC8)", color: "#fff" }}
                onClick={() => handleServicePreOrder(selectedService)}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Reserve This Service
              </Button>
              <p className="text-center text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>No payment required now · We'll contact you before launch</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}