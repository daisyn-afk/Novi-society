/** One before/after row in the provider profile form. */
export function emptyGalleryPair() {
  return { before_url: "", after_url: "", caption: "" };
}

/**
 * Build form rows from saved metadata (supports pair objects and legacy `{ url }` / strings).
 */
export function pairsFromGalleryMetadata(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [emptyGalleryPair()];
  }
  const first = raw[0];
  if (first && typeof first === "object" && ("before_url" in first || "after_url" in first)) {
    return raw.map((p) => ({
      before_url: String(p.before_url || "").trim(),
      after_url: String(p.after_url || "").trim(),
      caption: String(p.caption || "").trim(),
    }));
  }
  const rows = [];
  for (const item of raw) {
    const url =
      typeof item === "string"
        ? item.trim()
        : String(item?.url || item?.image_url || item?.src || "").trim();
    if (!url) continue;
    rows.push({
      before_url: url,
      after_url: "",
      caption: String(item?.caption || "").trim(),
    });
  }
  return rows.length ? rows : [emptyGalleryPair()];
}

/** Persist only non-empty pairs. */
export function pairsToGalleryMetadata(pairs) {
  if (!Array.isArray(pairs)) return [];
  return pairs
    .map((p) => ({
      before_url: String(p.before_url || "").trim(),
      after_url: String(p.after_url || "").trim(),
      caption: String(p.caption || "").trim(),
    }))
    .filter((p) => p.before_url || p.after_url);
}

/**
 * Flatten saved gallery for patient marketplace / thumbnails.
 * Pair rows become two display items when both sides have URLs.
 */
export function flattenGalleryPhotos(raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (!item) continue;
    if (typeof item === "string") {
      const u = item.trim();
      if (u) out.push({ url: u, caption: "" });
      continue;
    }
    if (item.before_url != null || item.after_url != null) {
      const cap = String(item.caption || "").trim();
      const b = String(item.before_url || "").trim();
      const a = String(item.after_url || "").trim();
      if (b) out.push({ url: b, caption: cap ? `${cap} — before` : "Before" });
      if (a) out.push({ url: a, caption: cap ? `${cap} — after` : "After" });
      continue;
    }
    const url = String(item.url || item.image_url || item.src || "").trim();
    if (url) out.push({ url, caption: String(item.caption || "").trim() });
  }
  return out;
}

/**
 * Build display pairs for patient UI.
 * - Pair metadata keeps before/after together.
 * - Legacy flat photos are grouped 2-by-2 as before/after.
 */
export function galleryPairsForDisplay(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const hasPairShape = raw.some(
    (item) => item && typeof item === "object" && (item.before_url != null || item.after_url != null)
  );
  if (hasPairShape) {
    return raw
      .map((item) => ({
        before_url: String(item?.before_url || "").trim(),
        after_url: String(item?.after_url || "").trim(),
        caption: String(item?.caption || "").trim(),
      }))
      .filter((pair) => pair.before_url || pair.after_url);
  }

  const flat = flattenGalleryPhotos(raw);
  const out = [];
  for (let i = 0; i < flat.length; i += 2) {
    out.push({
      before_url: flat[i]?.url || "",
      after_url: flat[i + 1]?.url || "",
      caption: "",
    });
  }
  return out;
}

/** Patient marketplace: only complete before+after sets (no empty slots or whitespace). */
export function galleryPairsForPatientDisplay(raw) {
  return galleryPairsForDisplay(raw).filter((p) => p.before_url && p.after_url);
}

/** @deprecated Use flattenGalleryPhotos */
export const normalizeGalleryPhotos = flattenGalleryPhotos;
