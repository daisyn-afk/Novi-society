import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Mail, Calendar, Send, CheckCircle } from "lucide-react";

const TEMPLATES = {
  order: {
    label: "Place Order Request",
    icon: Send,
    color: "#FA6F30",
    subject: (mfrName) => `Order Request — NOVI Provider`,
    body: (me, mfrName) =>
`Hi ${mfrName} Team,

I'd like to place a product order. My account details are below:

Provider: ${me?.full_name || ""}
Practice: ${me?.practice_name || ""}
Email: ${me?.email || ""}
Phone: ${me?.phone || ""}

Products I'm interested in ordering:
[Please list products and quantities here]

I'm a verified NOVI Society provider with active MD board oversight.

Thank you,
${me?.full_name || ""}`,
  },
  call: {
    label: "Schedule a Call",
    icon: Calendar,
    color: "#7B8EC8",
    subject: (mfrName) => `Schedule a Call — ${mfrName} Rep Request`,
    body: (me, mfrName) =>
`Hi,

I'd love to schedule a call to discuss my account, pricing, and available promotions.

Provider: ${me?.full_name || ""}
Practice: ${me?.practice_name || ""}
Best times for me: [Add your availability here]
Phone: ${me?.phone || ""}

I'm a NOVI Society verified provider — happy to share my credential summary if helpful.

Thanks,
${me?.full_name || ""}`,
  },
  message: {
    label: "Send a Message",
    icon: Mail,
    color: "#2D6B7F",
    subject: (mfrName) => `Provider Inquiry — ${mfrName}`,
    body: (me, mfrName) =>
`Hi ${mfrName} Team,

I have a question regarding my account:

[Write your message here]

Provider: ${me?.full_name || ""}
Practice: ${me?.practice_name || ""}
Email: ${me?.email || ""}

Thanks,
${me?.full_name || ""}`,
  },
};

export default function RepContactDialog({ open, onClose, manufacturer, me, initialType }) {
  const [type, setType] = useState(initialType || "order");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const mfrName = manufacturer?.name || "Supplier";
  const repEmail = manufacturer?.account_rep_email;
  const repName = manufacturer?.account_rep_name;

  const selectType = (t) => {
    setType(t);
    const tpl = TEMPLATES[t];
    setSubject(tpl.subject(mfrName));
    setBody(tpl.body(me, mfrName));
  };

  const handleOpen = (isOpen) => {
    if (isOpen && !subject) selectType(initialType || "order");
    if (!isOpen) { setSent(false); setSubject(""); setBody(""); }
    onClose(!isOpen);
  };

  const send = async () => {
    if (!repEmail || !subject || !body) return;
    setSending(true);
    await base44.functions.invoke("sendRepContactEmail", {
      manufacturer_id: manufacturer?.id,
      type,
      subject,
      message: body,
    });
    setSending(false);
    setSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}>
            Contact {repName || mfrName + " Rep"}
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(200,230,60,0.2)" }}>
              <CheckCircle className="w-7 h-7" style={{ color: "#4a6b10" }} />
            </div>
            <p className="font-bold text-lg" style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}>Message Sent!</p>
            <p className="text-sm mt-1 mb-5" style={{ color: "rgba(30,37,53,0.55)" }}>
              Sent to {repEmail}. A copy was sent to your email.
            </p>
            <Button onClick={() => { setSent(false); selectType("order"); }} style={{ background: "#1e2535", color: "#fff" }}>
              Send Another
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Rep info */}
            {repEmail && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)" }}>
                <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "#7B8EC8" }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "#1e2535" }}>{repName || "Account Rep"}</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{repEmail}</p>
                </div>
              </div>
            )}

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TEMPLATES).map(([key, tpl]) => {
                const Icon = tpl.icon;
                const active = type === key;
                return (
                  <button key={key} onClick={() => selectType(key)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: active ? `${tpl.color}18` : "rgba(30,37,53,0.04)", border: `1.5px solid ${active ? tpl.color + "50" : "rgba(30,37,53,0.1)"}`, color: active ? tpl.color : "rgba(30,37,53,0.5)" }}>
                    <Icon className="w-4 h-4" />
                    {tpl.label}
                  </button>
                );
              })}
            </div>

            {/* Compose */}
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Message</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none font-mono"
                style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535", fontSize: 12, lineHeight: 1.6 }} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onClose(false)}>Cancel</Button>
              <Button className="flex-1 gap-2 font-bold" disabled={!repEmail || sending}
                style={{ background: TEMPLATES[type].color, color: "#fff" }}
                onClick={send}>
                <Send className="w-3.5 h-3.5" />
                {sending ? "Sending..." : !repEmail ? "No rep email on file" : "Send Message"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}