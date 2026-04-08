import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, Copy, RefreshCw, Image, MessageSquare, Hash, Star, CheckCircle } from "lucide-react";

const GLASS = { background: "rgba(255,255,255,0.82)", border: "1px solid rgba(30,37,53,0.08)", borderRadius: 16 };

const TEMPLATES = [
  { id: "before_after", icon: Image, label: "Before & After Post", desc: "Engaging caption for a results photo" },
  { id: "promo", icon: Star, label: "Promotion Announcement", desc: "Announce a special offer or discount" },
  { id: "edu", icon: MessageSquare, label: "Educational Post", desc: "Teach followers about a service" },
  { id: "review", icon: CheckCircle, label: "Review Ask Script", desc: "DM script to request a patient review" },
  { id: "reactivation", icon: RefreshCw, label: "Patient Re-engagement", desc: "Win back a patient who hasn't booked" },
  { id: "hashtags", icon: Hash, label: "Hashtag Pack", desc: "Targeted hashtags for your niche" },
];

const SERVICES = ["Botox", "Lip Filler", "Cheek Filler", "Jawline Filler", "Microneedling", "Chemical Peel", "Kybella", "PRP", "Laser", "Other"];
const TONES = ["Warm & personal", "Professional & clinical", "Fun & playful", "Luxury & exclusive"];

export default function CreativeStudio({ me }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [service, setService] = useState("Botox");
  const [tone, setTone] = useState("Warm & personal");
  const [customNote, setCustomNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!selectedTemplate) return;
    setLoading(true);
    setResult(null);
    const t = TEMPLATES.find(t => t.id === selectedTemplate);
    const providerName = me?.full_name || "a provider";
    const city = me?.city || "your city";

    const prompts = {
      before_after: `Write an Instagram caption for a medical aesthetics provider named ${providerName} in ${city} sharing a before & after photo of a ${service} treatment. Tone: ${tone}. ${customNote ? `Extra context: ${customNote}` : ""} Include a strong hook first line, 2-3 sentences of value, a soft CTA to book. Keep it under 150 words. End with 5 relevant emojis on their own line.`,
      promo: `Write an Instagram post for ${providerName} in ${city} announcing a special promotion on ${service}. Tone: ${tone}. ${customNote ? `Details: ${customNote}` : "Create a compelling offer like a % off or bundle deal."} Hook + offer details + urgency + CTA. Under 120 words.`,
      edu: `Write an educational Instagram carousel caption for ${providerName} teaching followers about ${service}. Tone: ${tone}. ${customNote ? `Focus on: ${customNote}` : ""} Format: Hook line, 3 key facts/myths busted, CTA to DM for info. Under 150 words.`,
      review: `Write a friendly DM script for ${providerName} to send to a patient after a ${service} appointment asking for a Google or Instagram review. Tone: ${tone}. Should feel genuine, not salesy. Under 80 words.`,
      reactivation: `Write a short DM or text script for ${providerName} to re-engage a patient who received ${service} 3-6 months ago and hasn't rebooked. Tone: ${tone}. ${customNote ? `Extra: ${customNote}` : ""} Should feel personal. Under 80 words.`,
      hashtags: `Generate 25 highly targeted Instagram hashtags for a medical aesthetics provider in ${city} specializing in ${service}. Mix of: niche-specific (5), location-based (5), treatment-specific (8), community (7). Format as a single copy-paste block with # on each tag.`,
    };

    const result = await base44.integrations.Core.InvokeLLM({ prompt: prompts[selectedTemplate] });
    setResult(result);
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)", boxShadow: "0 4px 20px rgba(218,106,99,0.2)" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Creative Studio</p>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#fff", lineHeight: 1.2 }}>Content, written for you.</h2>
          </div>
        </div>
        <p className="text-sm text-white/60">Pick a template, set your vibe, and get ready-to-post copy in seconds.</p>
      </div>

      {/* Template picker */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>What do you need?</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TEMPLATES.map(t => {
            const Icon = t.icon;
            const isActive = selectedTemplate === t.id;
            return (
              <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                className="flex flex-col items-start gap-1.5 p-3 rounded-xl text-left transition-all"
                style={{ background: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)", border: isActive ? "2px solid rgba(218,106,99,0.5)" : "1.5px solid rgba(30,37,53,0.07)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: isActive ? "rgba(218,106,99,0.15)" : "rgba(30,37,53,0.05)" }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: isActive ? "#DA6A63" : "rgba(30,37,53,0.4)" }} />
                </div>
                <p className="text-xs font-bold leading-tight" style={{ color: "#1e2535" }}>{t.label}</p>
                <p className="text-[10px]" style={{ color: "rgba(30,37,53,0.45)" }}>{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {selectedTemplate && (
        <div className="rounded-2xl p-5 space-y-4" style={GLASS}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "#1e2535" }}>Service</label>
              <select value={service} onChange={e => setService(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.1)", color: "#1e2535" }}>
                {SERVICES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "#1e2535" }}>Tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.1)", color: "#1e2535" }}>
                {TONES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: "#1e2535" }}>Anything specific to include? (optional)</label>
            <textarea value={customNote} onChange={e => setCustomNote(e.target.value)} rows={2} placeholder="e.g. $50 off this weekend only, patient said they loved the natural look..."
              className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
              style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.1)", color: "#1e2535" }} />
          </div>
          <button onClick={generate} disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{ background: loading ? "rgba(218,106,99,0.4)" : "#DA6A63", color: "#fff" }}>
            {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Content</>}
          </button>
        </div>
      )}

      {result && (
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.95)", border: "1.5px solid rgba(218,106,99,0.3)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: "#1e2535" }}>Your content</p>
            <button onClick={copy} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: copied ? "rgba(200,230,60,0.2)" : "rgba(30,37,53,0.06)", color: copied ? "#4a6b10" : "#1e2535" }}>
              {copied ? <><CheckCircle className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(30,37,53,0.75)" }}>{result}</p>
          <button onClick={generate} className="mt-3 text-xs font-semibold flex items-center gap-1.5 hover:underline" style={{ color: "#DA6A63" }}>
            <RefreshCw className="w-3 h-3" /> Regenerate
          </button>
        </div>
      )}
    </div>
  );
}