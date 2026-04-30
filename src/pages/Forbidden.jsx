import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif" }}
    >
      <div
        className="w-full max-w-lg rounded-3xl overflow-hidden text-center"
        style={{
          background: "#fff",
          boxShadow: "0 14px 40px rgba(30,37,53,0.12)",
          border: "1px solid rgba(30,37,53,0.08)",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%)",
            padding: "24px 24px",
          }}
        >
          <h1 style={{ margin: 0, color: "#fff", fontSize: 28, fontWeight: 700 }}>403</h1>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.9)", fontSize: 14 }}>
            You are not authorized to view this page.
          </p>
        </div>
        <div style={{ padding: 24 }}>
          <p style={{ margin: "0 0 18px", color: "#475569", fontSize: 14 }}>
            This route is restricted based on your account role.
          </p>
          <Link
            to="/"
            style={{
              display: "inline-block",
              borderRadius: 12,
              padding: "10px 16px",
              background: "linear-gradient(135deg,#2D6B7F,#7B8EC8)",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
