import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function EmbeddedComingSoonTool({ label, teaser, accent = "#FA6F30" }) {
  const [expanded, setExpanded] = useState(false);
  const bg = `${accent}14`;
  const border = `${accent}40`;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all"
        style={{ background: bg, border: `1.5px solid ${border}` }}
      >
        <span className="text-sm font-semibold" style={{ color: "#1e2535" }}>
          {teaser}
        </span>
        <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
      </button>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: bg, border: `1.5px solid ${border}` }}
    >
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <span className="text-sm font-bold" style={{ color: "#1e2535" }}>
          {label}
        </span>
        <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
      </button>
      <div className="px-4 py-5 text-center">
        <span
          className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3"
          style={{ background: "rgba(250,111,48,0.15)", color: "#b84a10" }}
        >
          Soon
        </span>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>
          This interactive tool is on the way. Check back soon.
        </p>
      </div>
    </div>
  );
}
