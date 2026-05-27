import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";

const ARTICLES = [
  {
    title: "Pricing Your First Botox Menu",
    category: "Business",
    readTime: "6 min",
  },
  {
    title: "Building Patient Trust on Social Media",
    category: "Marketing",
    readTime: "5 min",
  },
  {
    title: "Scope of Practice Basics for Aesthetic Providers",
    category: "Clinical",
    readTime: "8 min",
  },
  {
    title: "How to Handle a Dissatisfied Patient",
    category: "Business",
    readTime: "4 min",
  },
];

export default function EmbeddedEducationHub() {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all"
        style={{ background: "rgba(218,106,99,0.08)", border: "1.5px solid rgba(218,106,99,0.25)" }}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" style={{ color: "#DA6A63" }} />
          <span className="text-sm font-semibold" style={{ color: "#1e2535" }}>
            Browse clinical + business articles
          </span>
        </div>
        <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
      </button>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "rgba(218,106,99,0.06)", border: "1.5px solid rgba(218,106,99,0.25)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ borderBottom: "1px solid rgba(218,106,99,0.15)" }}
      >
        <span className="text-sm font-bold" style={{ color: "#1e2535" }}>
          Education Hub
        </span>
        <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
      </button>
      <div className="p-3 space-y-2">
        {ARTICLES.map((article) => (
          <div
            key={article.title}
            className="px-3 py-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.08)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>
              {article.title}
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.45)" }}>
              {article.category} · {article.readTime}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
