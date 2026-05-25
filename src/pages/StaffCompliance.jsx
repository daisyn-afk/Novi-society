import { ShieldCheck } from "lucide-react";

export default function StaffCompliance() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.15 }}>Compliance Logs</h1>
        <p style={{ color: "rgba(30,37,53,0.55)", fontSize: 13, marginTop: 4 }}>View compliance activity and resolution status</p>
      </div>

      <div className="rounded-2xl p-12 flex flex-col items-center text-center" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(123,142,200,0.1)", border: "1px solid rgba(123,142,200,0.2)" }}>
          <ShieldCheck className="w-8 h-8" style={{ color: "#7B8EC8" }} />
        </div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#1e2535", marginBottom: 8 }}>
          Compliance Logs Coming Soon
        </h2>
        <p className="text-sm max-w-sm" style={{ color: "rgba(30,37,53,0.5)", lineHeight: 1.6 }}>
          This module will display compliance activity logs by provider — including type, date, and resolution status. It is currently being built and will appear here once ready.
        </p>
        <div className="mt-6 px-4 py-2 rounded-full text-xs font-semibold" style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.2)" }}>
          Read-only access · No actions available
        </div>
      </div>
    </div>
  );
}
