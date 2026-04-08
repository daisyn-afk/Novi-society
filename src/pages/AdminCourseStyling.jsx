import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Palette, Image as ImageIcon, Save, RotateCcw } from "lucide-react";

const categoryMeta = {
  botox: "Botox & Neurotoxins",
  fillers: "Dermal Fillers",
  laser: "Laser Treatments",
  prp: "PRP Therapy",
  chemical_peel: "Chemical Peels",
  microneedling: "Microneedling",
  kybella: "Kybella",
  skincare: "Skincare",
  other: "Other",
};

function GlassCard({ children }) {
  return (
    <div className="rounded-2xl p-5" style={{
      background: "rgba(255,255,255,0.45)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.75)",
      boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
    }}>
      {children}
    </div>
  );
}

export default function AdminCourseStyling() {
  const [selectedCategory, setSelectedCategory] = useState("botox");
  const [formData, setFormData] = useState({});
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();

  const { data: config = {} } = useQuery({
    queryKey: ["course-card-config", selectedCategory],
    queryFn: async () => {
      const configs = await base44.entities.LaunchPadConfig.filter({ key: `course_card_${selectedCategory}` });
      return configs[0] ? JSON.parse(configs[0].value || "{}") : {};
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existing = await base44.entities.LaunchPadConfig.filter({ key: `course_card_${selectedCategory}` });
      const configData = {
        key: `course_card_${selectedCategory}`,
        label: `Course Card - ${categoryMeta[selectedCategory]}`,
        category: "course_styling",
        value: JSON.stringify(formData),
        is_active: true,
      };

      if (existing[0]) {
        await base44.entities.LaunchPadConfig.update(existing[0].id, configData);
      } else {
        await base44.entities.LaunchPadConfig.create(configData);
      }
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries(["course-card-config"]);
    },
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Initialize form when config loads
  if (!formData.course_image_url && config.course_image_url) {
    setFormData(config);
  }

  return (
    <div className="max-w-4xl space-y-6 p-5" style={{
      background: "linear-gradient(150deg, #ede9fb 0%, #f5f2ff 40%, #eaf5c8 75%, #C8E63C 100%)",
      backgroundAttachment: "fixed",
      minHeight: "100vh",
    }}>
      <div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#1e2535", marginBottom: 8, fontStyle: "italic" }}>
          Course Card Styling
        </h1>
        <p style={{ color: "rgba(30,37,53,0.55)", marginBottom: 20 }}>Customize the hero image and styling for each course category</p>
      </div>

      {/* Category Selector */}
      <GlassCard>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Select Category</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(categoryMeta).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedCategory(key);
                setFormData({});
              }}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: selectedCategory === key ? "#1e2535" : "rgba(255,255,255,0.5)",
                color: selectedCategory === key ? "#fff" : "#1e2535",
                border: selectedCategory === key ? "none" : "1px solid rgba(30,37,53,0.1)",
              }}
            >
              {label.split(" ")[0]}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Configuration Form */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5" style={{ color: "#7B8EC8" }} />
          <p className="text-sm font-bold" style={{ color: "#1e2535" }}>Configure {categoryMeta[selectedCategory]}</p>
        </div>

        <div className="space-y-4">
          {/* Hero Image URL */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "rgba(30,37,53,0.55)" }}>
              <ImageIcon className="w-3.5 h-3.5 inline mr-1" /> Hero Image URL
            </label>
            <Input
              value={formData.course_image_url || ""}
              onChange={e => handleInputChange("course_image_url", e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="text-xs"
              style={{
                background: "rgba(255,255,255,0.8)",
                border: "1px solid rgba(30,37,53,0.1)",
                borderRadius: "8px",
              }}
            />
            <p className="text-xs mt-2" style={{ color: "rgba(30,37,53,0.4)" }}>Use Unsplash, Pexels, or your own image URL</p>
          </div>

          {/* Preview */}
          {formData.course_image_url && (
            <div className="relative overflow-hidden rounded-lg h-40">
              <img
                src={formData.course_image_url}
                alt="Preview"
                className="w-full h-full object-cover"
                style={{ filter: "brightness(0.8)" }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-semibold">
                Image Preview
              </div>
            </div>
          )}

          {/* Advanced Settings (optional) */}
          <div className="pt-4 border-t" style={{ borderColor: "rgba(30,37,53,0.1)" }}>
            <p className="text-xs font-bold mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>OPTIONAL OVERRIDES</p>
            
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
                Custom Button Text
              </label>
              <Input
                value={formData.button_text || ""}
                onChange={e => handleInputChange("button_text", e.target.value)}
                placeholder="E.g., 'Join Now' (default: 'Enroll Now')"
                className="text-xs"
              />
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
                Description Length
              </label>
              <Input
                type="number"
                value={formData.description_chars || 100}
                onChange={e => handleInputChange("description_chars", parseInt(e.target.value))}
                min="50"
                max="200"
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-5 pt-4 border-t" style={{ borderColor: "rgba(30,37,53,0.1)" }}>
          <Button
            onClick={() => {
              setFormData({});
            }}
            variant="outline"
            className="gap-2"
            style={{ color: "rgba(30,37,53,0.55)" }}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !formData.course_image_url}
            className="gap-2 flex-1"
            style={{
              background: saved ? "#4a6b10" : "#1e2535",
              color: "#fff",
              opacity: saveMutation.isPending ? 0.6 : 1,
            }}
          >
            <Save className="w-3.5 h-3.5" /> {saved ? "✓ Saved!" : "Save Config"}
          </Button>
        </div>
      </GlassCard>

      {/* Info Box */}
      <GlassCard>
        <p className="text-xs font-semibold mb-2" style={{ color: "#7B8EC8" }}>💡 Tips for Best Results</p>
        <ul className="text-xs space-y-1" style={{ color: "rgba(30,37,53,0.65)" }}>
          <li>• Use high-quality images (1200x800px recommended)</li>
          <li>• Ensure images are relevant to the course topic</li>
          <li>• The hero image will be darkened (80% brightness) for text overlay</li>
          <li>• Images must be publicly accessible URLs</li>
          <li>• Changes apply to all new course cards in that category</li>
        </ul>
      </GlassCard>
    </div>
  );
}