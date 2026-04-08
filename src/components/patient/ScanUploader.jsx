import { useState } from "react";
import { Camera, Loader2, CheckCircle, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function ScanUploader({ onScanComplete, label = "Upload New Scan" }) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPreviewUrl(file_url);
    setUploading(false);
    setAnalyzing(true);

    // AI facial analysis
    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an aesthetic AI assistant performing a high-level facial wellness analysis for a patient. 
      Analyze this facial image and provide a JSON report with these fields:
      - overall_skin_health: string (Excellent/Good/Fair/Needs Attention)
      - concern_summary: string (2-3 sentence overview)
      - detected_concerns: array of strings (list observable concerns - be gentle and professional)
      - educational_suggestions: array of strings (3-5 general treatment categories that could help)
      - treatment_areas: array of strings (facial areas that may benefit from attention)
      - confidence_score: number 0-100 (how confident you are in this analysis)
      Be empathetic, professional, and educational. Do not make medical claims.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          overall_skin_health: { type: "string" },
          concern_summary: { type: "string" },
          detected_concerns: { type: "array", items: { type: "string" } },
          educational_suggestions: { type: "array", items: { type: "string" } },
          treatment_areas: { type: "array", items: { type: "string" } },
          confidence_score: { type: "number" }
        }
      }
    });

    setAnalyzing(false);
    onScanComplete({ scan_url: file_url, scanned_at: new Date().toISOString(), ai_analysis: analysis, label });
  };

  if (analyzing) {
    return (
      <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-8 text-center">
        <div className="w-10 h-10 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderWidth: 3 }} />
        <p className="font-semibold text-indigo-700">Analyzing your scan...</p>
        <p className="text-sm text-indigo-500 mt-1">Our AI is mapping your facial features</p>
      </div>
    );
  }

  return (
    <label className="block cursor-pointer">
      <div className="rounded-2xl border-2 border-dashed p-6 text-center transition-colors hover:border-indigo-300"
        style={{ borderColor: previewUrl ? "#7B8EC8" : "#d1d5db", background: previewUrl ? "#f0f3fc" : "#fafafa" }}>
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-sm text-gray-500">Uploading...</p>
          </div>
        ) : previewUrl ? (
          <div className="flex flex-col items-center gap-2">
            <img src={previewUrl} alt="Scan" className="w-24 h-24 object-cover rounded-xl mx-auto" />
            <p className="text-sm text-indigo-600 font-semibold flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Uploaded</p>
            <p className="text-xs text-gray-400">Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Camera className="w-10 h-10 text-gray-300" />
            <p className="text-sm font-semibold text-gray-600">{label}</p>
            <p className="text-xs text-gray-400">Clear, well-lit selfie · JPEG or PNG</p>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </label>
  );
}