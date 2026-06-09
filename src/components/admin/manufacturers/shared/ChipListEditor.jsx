import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ChipListEditor({
  items = [],
  onChange,
  placeholder = "",
  emptyHint = "Defaults will show if empty",
  chipTone = "slate",
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...(items || []), v]);
    setDraft("");
  };

  const remove = (idx) => {
    const next = (items || []).filter((_, i) => i !== idx);
    onChange(next);
  };

  const tone = {
    slate: {
      bg: "#f8fafc",
      text: "#334155",
      border: "#e2e8f0",
    },
    lime: {
      bg: "rgba(200,230,60,0.14)",
      text: "#4a6b10",
      border: "rgba(200,230,60,0.35)",
    },
    blue: {
      bg: "#eff6ff",
      text: "#1d4ed8",
      border: "#bfdbfe",
    },
  }[chipTone] || { bg: "#f8fafc", text: "#334155", border: "#e2e8f0" };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={add}>
          Add
        </Button>
      </div>

      {items?.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
              style={{
                background: tone.bg,
                color: tone.text,
                border: `1px solid ${tone.border}`,
              }}
            >
              {item}
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-slate-400 hover:text-red-500 ml-0.5"
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">{emptyHint}</p>
      )}
    </div>
  );
}
