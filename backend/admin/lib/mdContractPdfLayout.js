import path from "path";
import { fileURLToPath } from "url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDFJS_STANDARD_FONTS = path.join(__dirname, "../node_modules/pdfjs-dist/standard_fonts/");
const PDFJS_WORKER = path.join(__dirname, "../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");

const EXHIBIT_TEXT = /\bexhibit\s+[a-z0-9]/i;
const SIGNING_HINT =
  /\b(by|name|title|manager|signed|signature|provider)\b|^\(.*name|llc\)/i;

let pdfJsConfigured = false;

function configurePdfJs() {
  if (pdfJsConfigured) return;
  pdfJsConfigured = true;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${PDFJS_WORKER.replace(/\\/g, "/")}`;
}

function collectLastPageTextItems(page, viewport) {
  return page.getTextContent().then((textContent) => {
    const items = [];
    for (const item of textContent.items) {
      if (!item?.str?.trim()) continue;
      const height = Number(item.height) > 0 ? Number(item.height) : 12;
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const bottom = tx[5] - height;
      const top = tx[5];
      if (!Number.isFinite(bottom)) continue;
      items.push({
        text: String(item.str).trim(),
        bottom,
        top,
      });
    }
    return items;
  });
}

/**
 * Find where to place the provider signature on the last page.
 * Keeps the block below signing lines and above exhibit sections when possible.
 */
export async function getLastPageSignaturePlacement(pdfBytes) {
  configurePdfJs();
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes),
    standardFontDataUrl: PDFJS_STANDARD_FONTS,
    disableFontFace: true,
  }).promise;

  try {
    const page = await doc.getPage(doc.numPages);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const items = await collectLastPageTextItems(page, viewport);

    const exhibitItems = items.filter((i) => EXHIBIT_TEXT.test(i.text));
    const firstExhibitY = exhibitItems.length
      ? Math.min(...exhibitItems.map((i) => i.bottom))
      : null;

    const exhibitBandTop = firstExhibitY != null ? firstExhibitY + 28 : null;
    const aboveExhibit = exhibitBandTop != null
      ? items.filter((i) => i.bottom > exhibitBandTop)
      : items;

    const signingItems = aboveExhibit.filter((i) => SIGNING_HINT.test(i.text));
    const anchorItems = signingItems.length ? signingItems : aboveExhibit;

    let contentBottomY = null;
    if (anchorItems.length) {
      contentBottomY = Math.min(...anchorItems.map((i) => i.bottom));
    } else if (aboveExhibit.length) {
      contentBottomY = Math.min(...aboveExhibit.map((i) => i.bottom));
    } else if (items.length) {
      contentBottomY = Math.min(...items.map((i) => i.bottom));
    }

    return {
      pageHeight,
      contentBottomY,
      firstExhibitY,
      exhibitBandTop,
    };
  } finally {
    await doc.destroy();
  }
}

/** @deprecated Use getLastPageSignaturePlacement */
export async function getLastPageContentBottomY(pdfBytes) {
  const placement = await getLastPageSignaturePlacement(pdfBytes);
  return placement.contentBottomY;
}

/** Baseline Y for the top line of the provider signature block. */
export function signatureBlockTopBaseline({
  contentBottomY,
  pageHeight,
  blockHeight,
  firstExhibitY = null,
  exhibitBandTop = null,
  marginBottom = 36,
  gapBelowContent = 56,
}) {
  const pageH = Number(pageHeight) || 792;
  const blockH = Number(blockHeight) || 140;
  const margin = Number(marginBottom) || 36;
  const gap = Number(gapBelowContent) || 56;

  let anchorY = Number(contentBottomY);
  if (!Number.isFinite(anchorY)) {
    anchorY = pageH * 0.35;
  }

  // Place block below signing lines (smaller Y than anchor in PDF coordinates).
  let topBaseline = anchorY - gap;

  const exhibitFloor = Number.isFinite(exhibitBandTop)
    ? exhibitBandTop
    : Number.isFinite(firstExhibitY)
      ? firstExhibitY + 24
      : null;

  // If the block would overlap exhibit headings, place it entirely above that band.
  if (exhibitFloor != null && topBaseline - blockH < exhibitFloor + 16) {
    topBaseline = exhibitFloor + blockH + 40;
  }

  const maxTop = pageH - 48;
  if (topBaseline > maxTop) {
    topBaseline = maxTop;
  }

  if (topBaseline - blockH < margin) {
    topBaseline = margin + blockH;
  }

  return topBaseline;
}
