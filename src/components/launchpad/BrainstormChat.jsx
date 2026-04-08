import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Lightbulb, Brain, RefreshCw } from "lucide-react";

const STARTERS = [
  "How do I attract more filler patients?",
  "What add-ons can I offer to increase revenue per visit?",
  "How do I handle a patient unhappy with their results?",
  "What's the best way to market myself on Instagram?",
  "How do I price my services competitively?",
  "How can I get more 5-star reviews?",
  "What should I post on social media this week?",
  "How do I build a loyal patient base from scratch?",
];

export default function BrainstormChat({ me }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    const context = `You are a sharp, experienced business mentor for medical aesthetics providers. The provider's name is ${me?.full_name || "the provider"}${me?.city ? ` based in ${me.city}` : ""}. They specialize in aesthetic treatments like Botox, fillers, and skincare. Be direct, practical, and encouraging. Give specific actionable advice — not generic platitudes. When relevant, give specific numbers, scripts, or step-by-step instructions. Keep responses concise (under 200 words) but impactful.`;
    const history = newMessages.map(m => `${m.role === "user" ? "Provider" : "Mentor"}: ${m.content}`).join("\n");

    const reply = await base44.integrations.Core.InvokeLLM({
      prompt: `${context}\n\nConversation so far:\n${history}\n\nMentor:`,
    });

    setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    setLoading(false);
  };

  const reset = () => setMessages([]);

  return (
    <div className="flex flex-col max-w-2xl" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
      {/* Header */}
      <div className="rounded-2xl p-5 mb-4 flex-shrink-0" style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)", boxShadow: "0 4px 20px rgba(123,142,200,0.25)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Your Mentor</p>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#fff", lineHeight: 1.2 }}>Ask me anything.</h2>
            </div>
          </div>
          {messages.length > 0 && (
            <button onClick={reset} className="text-xs font-semibold flex items-center gap-1.5 text-white/60 hover:text-white/90 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> New chat
            </button>
          )}
        </div>
        <p className="text-sm mt-2 text-white/55">Business strategy, marketing, pricing, patient handling — no question is off limits.</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4">
        {messages.length === 0 ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(30,37,53,0.35)" }}>Common questions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STARTERS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-left px-3.5 py-3 rounded-xl text-sm transition-all hover:shadow-sm"
                  style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(30,37,53,0.08)", color: "rgba(30,37,53,0.7)" }}>
                  <Lightbulb className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" style={{ color: "#FA6F30" }} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: "rgba(123,142,200,0.2)" }}>
                  <Brain className="w-3.5 h-3.5" style={{ color: "#7B8EC8" }} />
                </div>
              )}
              <div className="max-w-[85%] rounded-2xl px-4 py-3"
                style={{
                  background: m.role === "user" ? "rgba(200,230,60,0.18)" : "rgba(255,255,255,0.9)",
                  border: m.role === "user" ? "1px solid rgba(200,230,60,0.35)" : "1px solid rgba(30,37,53,0.08)",
                  borderRadius: m.role === "user" ? "20px 20px 6px 20px" : "6px 20px 20px 20px",
                }}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#1e2535" }}>{m.content}</p>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: "rgba(123,142,200,0.2)" }}>
              <Brain className="w-3.5 h-3.5" style={{ color: "#7B8EC8" }} />
            </div>
            <div className="px-4 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(30,37,53,0.08)", borderRadius: "6px 20px 20px 20px" }}>
              <div className="flex gap-1.5 items-center h-5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#7B8EC8", animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 flex gap-2" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(30,37,53,0.1)", borderRadius: 16, padding: "10px 12px" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask your mentor anything..."
          className="flex-1 text-sm outline-none bg-transparent"
          style={{ color: "#1e2535" }}
          disabled={loading}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: input.trim() && !loading ? "#7B8EC8" : "rgba(30,37,53,0.08)" }}>
          <Send className="w-4 h-4" style={{ color: input.trim() && !loading ? "#fff" : "rgba(30,37,53,0.3)" }} />
        </button>
      </div>
    </div>
  );
}