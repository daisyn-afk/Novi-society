import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

/**
 * Areas treated: quick-select chips + add custom areas (not limited to menu list).
 */
export default function AreasTreatedField({
  areas = [],
  onChange,
  suggestions = [],
  optional = false,
}) {
  const [customInput, setCustomInput] = useState("");

  const toggle = (area) => {
    const trimmed = String(area || "").trim();
    if (!trimmed) return;
    onChange(
      areas.includes(trimmed) ? areas.filter((a) => a !== trimmed) : [...areas, trimmed]
    );
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!areas.includes(trimmed)) onChange([...areas, trimmed]);
    setCustomInput("");
  };

  const chipSuggestions = [
    ...new Set([
      ...suggestions.filter(Boolean),
      ...areas.filter((a) => !suggestions.includes(a)),
    ]),
  ];

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>
        Areas treated {optional ? "(optional)" : ""}
      </Label>
      {chipSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chipSuggestions.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => toggle(area)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={
                areas.includes(area)
                  ? { background: "#FA6F30", color: "#fff" }
                  : { background: "rgba(198,190,168,0.3)", color: "#6B7DB3" }
              }
            >
              {area}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px]" style={{ color: "#9a8f7e" }}>
          Add each area you treated below (you can also set defaults on Practice → Treatment Menu).
        </p>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Type an area and add…"
          className="text-sm h-9 flex-1"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button
          type="button"
          onClick={addCustom}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold shrink-0"
          style={{ background: "rgba(250,111,48,0.12)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.3)" }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
      {areas.length > 0 && (
        <p className="text-[10px]" style={{ color: "#9a8f7e" }}>
          {areas.length} area{areas.length !== 1 ? "s" : ""} selected
          {areas.length > 0 ? `: ${areas.join(", ")}` : ""}
        </p>
      )}
    </div>
  );
}
