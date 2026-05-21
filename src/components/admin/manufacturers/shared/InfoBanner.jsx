export default function InfoBanner({ tone = "info", icon, children }) {
  const tones = {
    info: {
      bg: "#eff6ff",
      border: "#bfdbfe",
      text: "#1e40af",
    },
    warning: {
      bg: "rgba(250,111,48,0.08)",
      border: "rgba(250,111,48,0.25)",
      text: "#9a3412",
    },
    success: {
      bg: "rgba(200,230,60,0.12)",
      border: "rgba(200,230,60,0.35)",
      text: "#4a6b10",
    },
    neutral: {
      bg: "#f8fafc",
      border: "#e2e8f0",
      text: "#475569",
    },
  }[tone];

  return (
    <div
      className="rounded-lg px-3 py-2.5 text-xs leading-relaxed flex gap-2"
      style={{
        background: tones.bg,
        border: `1px solid ${tones.border}`,
        color: tones.text,
      }}
    >
      {icon ? <span className="flex-shrink-0 mt-0.5">{icon}</span> : null}
      <div>{children}</div>
    </div>
  );
}
