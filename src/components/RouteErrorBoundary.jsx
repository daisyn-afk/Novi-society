import React from "react";

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[RouteErrorBoundary] route render failed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            margin: "24px",
            padding: "16px",
            borderRadius: "12px",
            background: "rgba(218,106,99,0.12)",
            border: "1px solid rgba(218,106,99,0.35)",
            color: "#8a2f28",
            fontFamily: "sans-serif"
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "8px" }}>Page crashed while rendering.</div>
          <div style={{ fontSize: "13px", whiteSpace: "pre-wrap" }}>
            {this.state.error?.message || String(this.state.error || "Unknown runtime error")}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

