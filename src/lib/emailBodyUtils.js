/**
 * Helpers to turn raw Gmail message bodies into clean chat-style text.
 * Strips quoted reply history, signatures, and email boilerplate so each
 * bubble shows only what that person actually wrote in that message.
 */

export function parseEmailAddress(header) {
  const raw = String(header || "").trim();
  if (!raw) return { name: "", email: "" };

  const angle = raw.match(/^\s*(.+?)\s*<([^>]+)>\s*$/);
  if (angle) {
    const name = angle[1].replace(/^["']|["']$/g, "").trim();
    return { name, email: angle[2].trim().toLowerCase() };
  }

  const bare = raw.match(/([^\s<>]+@[^\s<>]+)/);
  if (bare) return { name: "", email: bare[1].trim().toLowerCase() };

  return { name: raw, email: "" };
}

function stripHtmlTags(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Remove quoted reply chains, forwarded blocks, and trailing signatures.
 */
export function stripQuotedReplyContent(text) {
  let body = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!body) return "";

  // Gmail / Outlook: "On Mon, May 25, 2026 at 10:00 AM Name <email> wrote:"
  const onWrote = body.search(
    /\nOn .+ wrote:\s*\n/i
  );
  if (onWrote > 0) body = body.slice(0, onWrote).trim();

  // Apple Mail style
  const originalMessage = body.search(/\n-{2,}\s*Original Message\s*-{2,}/i);
  if (originalMessage > 0) body = body.slice(0, originalMessage).trim();

  // Forwarded
  const forwarded = body.search(/\n-{5,}\s*Forwarded message\s*-{5,}/i);
  if (forwarded > 0) body = body.slice(0, forwarded).trim();

  // Lines starting with ">" (quoted text block at end)
  const lines = body.split("\n");
  const cleaned = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    cleaned.push(line);
  }
  body = cleaned.join("\n").trim();

  // Signature delimiter "-- " on its own line (keep content above it)
  const sigMatch = body.match(/\n-- \n[\s\S]*$/);
  if (sigMatch) {
    body = body.slice(0, sigMatch.index).trim();
  }

  return body.replace(/\n{3,}/g, "\n\n").trim();
}

export function getMessageDisplayBody(message) {
  const plain = message?.body_text?.trim();
  const fromPlain = plain ? stripQuotedReplyContent(plain) : "";
  if (fromPlain) return fromPlain;

  const fromHtml = message?.body_html
    ? stripQuotedReplyContent(stripHtmlTags(message.body_html))
    : "";
  if (fromHtml) return fromHtml;

  return String(message?.snippet || "").trim();
}

export function isMessageFromProvider(message, providerEmail) {
  const me = String(providerEmail || "").trim().toLowerCase();
  if (!me) return false;
  const from = parseEmailAddress(message?.from);
  return from.email === me;
}

export function formatMessageTime(dateValue, internalDateMs) {
  let d = null;
  if (dateValue) {
    d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) d = null;
  }
  if (!d && internalDateMs) {
    d = new Date(Number(internalDateMs));
    if (Number.isNaN(d.getTime())) d = null;
  }
  if (!d) return "";

  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
