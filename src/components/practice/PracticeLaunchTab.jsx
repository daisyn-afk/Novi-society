import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import EmbeddedPricingTool from "../launchpad/EmbeddedPricingTool";
import PricingResearchPanel from "./PricingResearchPanel";

import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, Rocket,
  Building2, DollarSign, Megaphone, Sparkles, ExternalLink, CheckCircle, RefreshCw
} from "lucide-react";

const DEFAULT_NOVI_SECTION = {
  id: "novi",
  label: "Set Up Your NOVI Profile",
  color: "#C8E63C",
  textColor: "#4a6b10",
  icon: Sparkles,
  intro: "Patients need to find you and book you. Fill out your profile, set your hours, add services, and start accepting bookings.",
  steps: [
    {
      id: "profile",
        label: "Photo, bio & hours",
        desc: "Your face, your story, when you're available. Patients decide in 10 seconds. Make it count.",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=profile",
    },
    {
      id: "availability",
        label: "Set your hours",
        desc: "Done right in the profile step above.",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=profile",
    },
    {
      id: "treatments",
        label: "Add your services & prices",
        desc: "What you do, what it costs. Toggle at least one service live — patients can't book without it.",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=treatments",
    },
    {
      id: "book_link",
        label: "Copy & share your booking link",
        desc: "Your NOVI profile IS your booking page. Grab the link from the Profile tab and drop it in your Instagram bio right now.",
      navigate_to: "ProviderProfile",
      navigate_params: "",
    },
  ],
};

const CHECKLIST = [
  {
    id: "business",
    label: "Build Your Business Foundation",
    color: "#7B8EC8",
    textColor: "#3a4e8c",
    icon: Building2,
    intro: "Protect yourself legally and financially. This section takes a few hours but saves you thousands down the road.",
    steps: [
      {
        id: "llc",
        label: "Form an LLC",
        desc: "$50–200 depending on your state. Keeps your personal money separate from your business. ZenBusiness does it in 10 minutes.",
        link: "https://www.zenbusiness.com",
        linkLabel: "Form your LLC with ZenBusiness →",
      },
      {
        id: "ein",
        label: "Get your EIN — it's free",
        desc: "5-minute IRS form. You need it to open a bank account and pay taxes correctly.",
        link: "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online",
        linkLabel: "Get your EIN from the IRS →",
      },
      {
        id: "banking",
        label: "Open a business bank account",
        desc: "Mercury and Relay are free and take 10 minutes. Mixing personal and business money is a tax nightmare.",
        link: "https://mercury.com",
        linkLabel: "Open a free business account with Mercury →",
      },
      {
        id: "accounting",
        label: "Track what's coming in and going out",
        desc: "Wave is free. QuickBooks is $15/month. You can't grow what you don't measure.",
        link: "https://www.waveapps.com",
        linkLabel: "Try Wave for free →",
      },
      {
        id: "insurance",
        label: "Get malpractice insurance",
        desc: "$30–50/month. Non-negotiable. One claim without it could cost six figures. Hiscox and CM&F Group specialize in aesthetics.",
        link: "https://www.hiscox.com",
        linkLabel: "Get a quote from Hiscox →",
      },
    ],
  },
  {
    id: "pricing",
    label: "Lock In Your Pricing",
    color: "#FA6F30",
    textColor: "#b84a10",
    icon: DollarSign,
    intro: "Price too low = burnout. Price too high = no bookings. Find the sweet spot where you're profitable and patients still say yes.",
    steps: [
      {
        id: "pricing_research",
        label: "Check what your competition charges",
        desc: "Search 'Botox near me [your city]' on Instagram. NOVI's ROI tab also pulls real market data for your area.",
      },
      {
        id: "cost_calc",
        label: "Run your numbers in the ROI Calculator",
        desc: "Plug in your product cost, time, and overhead. We'll tell you exactly what to charge. Use the ROI tab → then hit 'Use this price' to push it straight to your Treatments.",
        embedded_tool: "pricing_calculator",
      },
      {
        id: "deposit_policy",
        label: "Set your deposit & cancellation policy",
        desc: "A 20–30% deposit at booking kills no-shows. 24–48 hour cancellation window. Set both right in your Profile tab.",
        navigate_to: "ProviderPractice",
        navigate_params: "?tab=profile",
      },
      {
        id: "packages",
        label: "Create a bundle, package, or loyalty reward",
        desc: "'3 Botox sessions for $500' instead of $200 each. Add it in your Treatments tab — NOVI shows it on your profile so patients can see it when booking.",
        navigate_to: "ProviderPractice",
        navigate_params: "?tab=treatments",
      },
    ],
  },
  {
    id: "marketing",
    label: "Get Your Name Out There",
    color: "#DA6A63",
    textColor: "#a03030",
    icon: Megaphone,
    intro: "Best injector in the world doesn't matter if nobody knows you exist. Start simple: Instagram, Google, referrals.",
    steps: [
      {
        id: "instagram",
        label: "Post on Instagram 3x a week",
        desc: "Switch to a Professional account (free). Before/afters, quick tips, your face. That's literally the whole strategy.",
        link: "https://business.instagram.com",
        linkLabel: "Switch to a Professional Instagram account →",
      },
      {
        id: "google_biz",
        label: "Claim your Google Business Profile",
        desc: "Free. 10 minutes. Shows up when someone in your city searches 'Botox near me.' Essential.",
        link: "https://business.google.com",
        linkLabel: "Claim your free Google Business Profile →",
      },
      {
        id: "website",
        label: "Your NOVI profile = your website",
        desc: "Your NOVI link has your photo, services, pricing, and booking built in. Put it everywhere. No Squarespace needed.",
        navigate_to: "ProviderProfile",
        navigate_params: "",
      },
      {
        id: "referral",
        label: "Launch a referral program",
        desc: "'Refer a friend, you both save $25.' Text your NOVI link to past patients with that message. Word of mouth beats every ad.",
        navigate_to: "ProviderProfile",
        navigate_params: "",
      },
      {
        id: "first_ad",
        label: "Run a $5/day Instagram ad",
        desc: "Target women 25–50 in your city. Use a before/after photo. Goal isn't profit — it's figuring out what message lands.",
        link: "https://www.facebook.com/business/ads",
        linkLabel: "Create your first ad on Meta →",
      },
    ],
  },
];

export default function PracticeLaunchTab({ appointments, reviews }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState("novi");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  // Fetch admin-configured launch pad sections
  const { data: dbConfigs = [] } = useQuery({
    queryKey: ["launchpad-configs"],
    queryFn: () => base44.entities.LaunchPadConfig.list("+sort_order"),
  });

  // Section color/icon mapping by section_id
  const SECTION_META = {
    novi:     { color: "#C8E63C", textColor: "#4a6b10",  icon: Sparkles },
    business: { color: "#7B8EC8", textColor: "#3a4e8c",  icon: Building2 },
    pricing:  { color: "#FA6F30", textColor: "#b84a10",  icon: DollarSign },
    marketing:{ color: "#DA6A63", textColor: "#a03030",  icon: Megaphone },
  };

  // If DB has sections, use them all; otherwise fall back to hardcoded
  const fullChecklist = dbConfigs.length > 0
    ? dbConfigs
        .filter(c => c.is_active !== false)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(c => {
          const meta = SECTION_META[c.section_id] || { color: "#7B8EC8", textColor: "#3a4e8c", icon: Sparkles };
          return {
            id: c.section_id,
            label: c.label,
            color: meta.color,
            textColor: meta.textColor,
            icon: meta.icon,
            intro: c.intro,
            steps: (c.steps || []).filter(s => s.is_active !== false).map(s => ({
              id: s.step_id,
              label: s.label,
              desc: s.desc,
              navigate_to: s.navigate_to,
              navigate_params: s.navigate_params,
            })),
          };
        })
    : [DEFAULT_NOVI_SECTION, ...CHECKLIST.filter(s => s.id !== "novi")];

  const totalSteps = fullChecklist.reduce((s, c) => s + c.steps.length, 0);

  // Auto-detect completed steps based on real profile data
  const autoDetected = {
    profile: !!(me?.bio && me?.avatar_url && me?.city),
    treatments: !!(me?.service_offerings_v2 && Object.values(me.service_offerings_v2 || {}).some(v => v?.is_live)),
    book_link: !!(me?.practice_name || me?.bio), // they've filled out enough to have a real profile
  };

  const completed = { ...autoDetected, ...(me?.launch_checklist || {}) };
  const completedCount = Object.values(completed).filter(Boolean).length;
  const allDone = completedCount >= totalSteps;
  const pct = Math.round((completedCount / totalSteps) * 100);

  const toggleMutation = useMutation({
    mutationFn: (newChecklist) => base44.auth.updateMe({ launch_checklist: newChecklist }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  const toggle = (stepId) => {
    const updated = { ...completed, [stepId]: !completed[stepId] };
    toggleMutation.mutate(updated);
  };

  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1e2535 0%, #2D6B7F 60%, rgba(200,230,60,0.6) 100%)", boxShadow: "0 4px 24px rgba(30,37,53,0.15)" }}>
        <div className="px-6 py-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.2)" }}>
              <Rocket className="w-6 h-6" style={{ color: "#C8E63C" }} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(200,230,60,0.8)" }}>Provider Launch Pad</p>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#fff", lineHeight: 1.2 }}>
                Your ongoing guide to building a thriving practice.
              </h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                From day one setup to long-term growth — this is your living business playbook. Work through it at your own pace, come back as your practice evolves, and check things off as you go. Your progress saves automatically.
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
                {completedCount === 0
                  ? "You haven't started yet — let's fix that."
                  : completedCount < totalSteps
                  ? `${completedCount} of ${totalSteps} steps done — you're building something real.`
                  : "Every step complete. You're officially ready to build."}
              </p>
              <p className="text-xs font-bold" style={{ color: "#C8E63C" }}>{pct}%</p>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #C8E63C, #7B8EC8)" }} />
            </div>
            {allDone && (
              <p className="text-xs font-bold mt-2.5 flex items-center gap-1.5" style={{ color: "#C8E63C" }}>
                <CheckCircle className="w-3.5 h-3.5" /> All steps complete. You're officially ready to build.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* How to use this */}
      <div className="rounded-xl px-5 py-4 flex items-start gap-3" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(30,37,53,0.08)" }}>
        <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
        <div>
          <p className="text-sm font-bold" style={{ color: "#1e2535" }}>How to use this page</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
            Click any section below to expand it. Read the description for each step — we explain exactly what to do and why. When you've completed a step, click on it to check it off. Do these in any order, but we recommend starting with the NOVI setup steps first.
          </p>
        </div>
      </div>

      {/* Checklist sections */}
      {fullChecklist.map((section) => {
        const SectionIcon = section.icon;
        const sectionDone = section.steps.filter(s => completed[s.id]).length;
        const isOpen = expandedSection === section.id;
        const allSectionDone = sectionDone === section.steps.length;
        return (
          <div key={section.id} className="overflow-hidden" style={{ borderRadius: 16, background: "rgba(255,255,255,0.88)", border: `1.5px solid ${allSectionDone ? `${section.color}70` : "rgba(30,37,53,0.09)"}`, boxShadow: "0 2px 12px rgba(30,37,53,0.06)" }}>
            <button
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
              onClick={() => setExpandedSection(isOpen ? null : section.id)}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${section.color}20` }}>
                <SectionIcon className="w-5 h-5" style={{ color: section.textColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: "#1e2535" }}>{section.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                  {allSectionDone ? `All ${section.steps.length} steps complete` : `${sectionDone} of ${section.steps.length} complete`}
                </p>
              </div>
              {/* Mini step dots */}
              <div className="flex gap-1 mr-2 flex-shrink-0">
                {section.steps.map(s => (
                  <div key={s.id} className="w-1.5 h-4 rounded-full" style={{ background: completed[s.id] ? section.color : "rgba(30,37,53,0.1)" }} />
                ))}
              </div>
              {isOpen
                ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.3)" }} />
                : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.3)" }} />
              }
            </button>

            {isOpen && (
              <div style={{ borderTop: "1px solid rgba(30,37,53,0.07)" }}>
                {/* Section intro */}
                <div className="px-5 py-3.5" style={{ background: `${section.color}0D`, borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>{section.intro}</p>
                </div>

                {section.steps.map((step, idx) => {
                  const isDone = !!completed[step.id];
                  return (
                    <div key={step.id}>
                      <div
                        className="flex items-start gap-3.5 px-5 py-4 cursor-pointer transition-all hover:bg-slate-50/70"
                        style={{ borderBottom: idx < section.steps.length - 1 && !step.embedded_tool ? "1px solid rgba(30,37,53,0.05)" : "none" }}
                        onClick={() => toggle(step.id)}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {isDone
                            ? <CheckCircle2 className="w-5 h-5" style={{ color: section.textColor }} />
                            : <Circle className="w-5 h-5" style={{ color: "rgba(30,37,53,0.18)" }} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-snug" style={{ color: isDone ? "rgba(30,37,53,0.35)" : "#1e2535", textDecoration: isDone ? "line-through" : "none" }}>
                            {step.label}
                          </p>
                          {!isDone && (
                            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>{step.desc}</p>
                          )}
                          {step.link && !isDone && (
                            <a
                              href={step.link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-xs font-bold mt-2 hover:underline"
                              style={{ color: section.textColor }}
                            >
                              {step.linkLabel || "Get started"} <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {step.navigate_to && !isDone && (
                            <button
                              data-nav="true"
                              onClick={e => { e.stopPropagation(); navigate(createPageUrl(step.navigate_to) + (step.navigate_params || "")); }}
                              className="inline-flex items-center gap-1.5 text-xs font-bold mt-2 hover:underline"
                              style={{ color: section.textColor }}
                            >
                              Go there now <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {step.id === "pricing_research" && !isDone && (
                        <div className="px-5 pb-4" style={{ borderBottom: idx < section.steps.length - 1 ? "1px solid rgba(30,37,53,0.05)" : "none" }}>
                          <PricingResearchPanel />
                        </div>
                      )}
                      {step.embedded_tool === "pricing_calculator" && !isDone && (
                        <div className="px-5 pb-4" style={{ borderBottom: idx < section.steps.length - 1 ? "1px solid rgba(30,37,53,0.05)" : "none" }}>
                          <EmbeddedPricingTool />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}