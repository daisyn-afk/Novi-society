import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import vendorCategories from "@/data/vendorDirectory.json";
import {
  Shield, Briefcase, Landmark, Calculator, Megaphone, GraduationCap,
  ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";

const CATEGORY_ICONS = {
  briefcase: Briefcase,
  landmark: Landmark,
  calculator: Calculator,
  shield: Shield,
  megaphone: Megaphone,
  graduationCap: GraduationCap,
};

const VENDOR_CATEGORIES = vendorCategories.map((section) => ({
  ...section,
  icon: CATEGORY_ICONS[section.icon] || Briefcase,
}));

function noviPickCount(tools) {
  return tools.filter((t) => t.isNoviPick).length;
}

export default function VendorDirectory({ embedded = false }) {
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState("legal");

  return (
    <div className={embedded ? "space-y-3" : "max-w-3xl space-y-6"}>
      {!embedded && (
        <>
          {/* Hero */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #1e2535 0%, #2D6B7F 60%, rgba(200,230,60,0.6) 100%)",
              boxShadow: "0 4px 24px rgba(30,37,53,0.15)",
            }}
          >
            <div className="px-6 py-6">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(200,230,60,0.2)" }}
                >
                  <Shield className="w-6 h-6" style={{ color: "#C8E63C" }} />
                </div>
                <div className="flex-1">
                  <p
                    className="text-xs font-bold uppercase tracking-widest mb-1"
                    style={{ color: "rgba(200,230,60,0.8)" }}
                  >
                    Trusted Vendor Network
                  </p>
                  <h2
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontSize: 22,
                      color: "#fff",
                      lineHeight: 1.2,
                    }}
                  >
                    Every tool you need to launch & grow.
                  </h2>
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                    NOVI-vetted tools our top providers use — tap any section to expand.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Category accordions */}
      {VENDOR_CATEGORIES.map((section) => {
        const SectionIcon = section.icon;
        const picks = noviPickCount(section.tools);
        const isOpen = expandedSection === section.id;

        return (
          <div
            key={section.id}
            className="overflow-hidden"
            style={{
              borderRadius: 16,
              background: "rgba(255,255,255,0.88)",
              border: "1.5px solid rgba(30,37,53,0.09)",
              boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
            }}
          >
            <button
              type="button"
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
              onClick={() => setExpandedSection(isOpen ? null : section.id)}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${section.color}20` }}
              >
                <SectionIcon className="w-5 h-5" style={{ color: section.textColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: "#1e2535" }}>
                  {section.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                  {section.tools.length} tool{section.tools.length !== 1 ? "s" : ""}
                  {picks > 0 && ` · ${picks} NOVI pick${picks !== 1 ? "s" : ""}`}
                </p>
              </div>
              {picks > 0 && (
                <span
                  className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    background: "rgba(200,230,60,0.25)",
                    color: "#4a6b10",
                    border: "1px solid rgba(200,230,60,0.5)",
                  }}
                >
                  NOVI Picks
                </span>
              )}
              {isOpen ? (
                <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.3)" }} />
              ) : (
                <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.3)" }} />
              )}
            </button>

            {isOpen && (
              <div style={{ borderTop: "1px solid rgba(30,37,53,0.07)" }}>
                {section.tools.map((tool, idx) => (
                  <div
                    key={tool.name}
                    className="px-5 py-4"
                    style={{
                      borderBottom:
                        idx < section.tools.length - 1 ? "1px solid rgba(30,37,53,0.05)" : "none",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {tool.isNoviPick && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: "#7B8EC8" }}
                              title="NOVI pick"
                            />
                          )}
                          <p className="text-sm font-bold" style={{ color: "#1e2535" }}>
                            {tool.name}
                          </p>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: "rgba(30,37,53,0.06)",
                              color: "rgba(30,37,53,0.55)",
                            }}
                          >
                            {tool.tag}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>
                          {tool.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {tool.internalPage ? (
                          <button
                            type="button"
                            onClick={() => navigate(createPageUrl(tool.internalPage))}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                            style={{
                              background: "#1e2535",
                              color: "#C8E63C",
                            }}
                          >
                            On NOVI
                          </button>
                        ) : (
                          <a
                            href={tool.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:bg-slate-50"
                            style={{
                              border: "1.5px solid rgba(30,37,53,0.12)",
                              color: "#1e2535",
                            }}
                          >
                            Visit <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
