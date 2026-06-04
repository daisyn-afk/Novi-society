import { getAdminApiBaseUrl, toApiPath } from "@/api/adminApiRequest";

export const VIEWABLE_DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "png",
  "jpg",
  "jpeg",
  "webp",
]);

/** Extension from a storage or public document URL. */
export function getFileExtensionFromUrl(url) {
  try {
    const path = new URL(String(url || "")).pathname;
    return path.split(".").pop()?.toLowerCase().split("?")[0] || "";
  } catch {
    return "";
  }
}

/** Inline document URL (PDF opens in browser tab via admin proxy). */
export function getDocumentViewUrl(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;

  const ext = getFileExtensionFromUrl(url);
  if (!VIEWABLE_DOCUMENT_EXTENSIONS.has(ext)) return url;

  const base = getAdminApiBaseUrl();
  const path = toApiPath(`/admin/uploads/view?url=${encodeURIComponent(url)}`);
  return `${base}${path}`;
}

/** Open uploaded document in a new browser tab. */
export function openDocumentInNewTab(rawUrl) {
  const url = getDocumentViewUrl(rawUrl) || String(rawUrl || "").trim();
  if (!url) return;

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    throw new Error("Pop-up blocked. Allow pop-ups to view this document.");
  }
}
