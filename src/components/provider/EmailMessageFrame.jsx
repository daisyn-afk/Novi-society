import DOMPurify from "dompurify";
import { useEffect, useMemo, useRef, useState } from "react";

// Email body renderer. We treat the message body as untrusted HTML:
//
// - DOMPurify removes scripts, iframes, on*-handlers, and javascript:/data:
//   URIs before the HTML ever touches the page.
// - The rendered output lives inside a sandboxed <iframe srcDoc>. The sandbox
//   deliberately omits `allow-same-origin`, so even a sanitizer bypass would
//   only own the iframe's opaque origin — it cannot reach NOVI's cookies,
//   localStorage, or DOM.
// - `allow-scripts` is enabled solely so the inline ResizeObserver below can
//   postMessage its content height back to us. The iframe has no network
//   credentials, no API access, and no parent reference.
//
// Plaintext-only messages render inside the same iframe as a <pre> block, so
// the layout stays consistent regardless of body MIME type.

const SANITIZE_CONFIG = {
  FORBID_TAGS: [
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "style",
    "link",
    "meta",
    "base",
  ],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onfocus",
    "onblur",
    "onsubmit",
    "onchange",
    "onkeydown",
    "onkeyup",
  ],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpeg|gif|webp))/i,
};

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function EmailMessageFrame({ html = "", plain = "" }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(60);

  const srcDoc = useMemo(() => {
    const body = html
      ? DOMPurify.sanitize(html, SANITIZE_CONFIG)
      : `<pre>${escapeHtml(plain)}</pre>`;

    return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<base target="_blank">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: #1e2535;
    padding: 4px 2px;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  img { max-width: 100%; height: auto; }
  a { color: #2D6B7F; }
  blockquote {
    margin: 8px 0 8px 8px;
    padding-left: 10px;
    border-left: 2px solid rgba(30,37,53,0.18);
    color: rgba(30,37,53,0.7);
  }
  pre {
    white-space: pre-wrap;
    font-family: inherit;
    margin: 0;
  }
  table { max-width: 100%; }
</style>
</head><body>
${body}
<script>
  (function () {
    var send = function () {
      try {
        var h = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );
        parent.postMessage({ t: "novi-mail-height", h: h }, "*");
      } catch (_) {}
    };
    new ResizeObserver(send).observe(document.documentElement);
    window.addEventListener("load", send);
    document.querySelectorAll("img").forEach(function (img) {
      img.addEventListener("load", send);
      img.addEventListener("error", send);
      img.setAttribute("referrerpolicy", "no-referrer");
    });
    document.querySelectorAll("a").forEach(function (a) {
      a.setAttribute("rel", "noopener noreferrer");
    });
    send();
  })();
</script>
</body></html>`;
  }, [html, plain]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== ref.current?.contentWindow) return;
      if (event.data?.t !== "novi-mail-height") return;
      const next = Number(event.data.h) || 60;
      setHeight(Math.min(2000, Math.max(60, next + 4)));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={ref}
      title="email-body"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts"
      srcDoc={srcDoc}
      style={{
        width: "100%",
        border: 0,
        height,
        background: "transparent",
        display: "block",
      }}
    />
  );
}
