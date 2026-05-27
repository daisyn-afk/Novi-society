import { useState } from "react";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";
import VendorDirectory from "./VendorDirectory";

export default function EmbeddedVendorDirectory() {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all"
        style={{ background: "rgba(200,230,60,0.12)", border: "1.5px solid rgba(200,230,60,0.35)" }}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: "#4a6b10" }} />
          <span className="text-sm font-semibold" style={{ color: "#1e2535" }}>
            Browse NOVI-vetted vendors
          </span>
        </div>
        <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
      </button>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "rgba(200,230,60,0.08)", border: "1.5px solid rgba(200,230,60,0.3)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ borderBottom: "1px solid rgba(200,230,60,0.2)" }}
      >
        <span className="text-sm font-bold" style={{ color: "#1e2535" }}>
          Trusted Vendor Directory
        </span>
        <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
      </button>
      <div className="p-3">
        <VendorDirectory embedded />
      </div>
    </div>
  );
}
