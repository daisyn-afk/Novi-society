import path from "path";
import { fileURLToPath } from "url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDFJS_STANDARD_FONTS = path.join(__dirname, "../node_modules/pdfjs-dist/standard_fonts/");
const PDFJS_WORKER = path.join(__dirname, "../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");

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
      if (!Number.isFinite(bottom)) continue;
      items.push({
        text: String(item.str).trim(),
        bottom,
      });
    }
    return items;
  });
}

/**
 * Find the lowest text on the last page so the signature can sit below all content.
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

    const contentBottomY = items.length
      ? Math.min(...items.map((i) => i.bottom))
      : null;

    return {
      pageHeight,
      contentBottomY,
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

/**
 * Baseline Y for the top line of the provider signature block.
 * Returns needsNewPage when the last page has no room below existing text.
 */
export function signatureBlockTopBaseline({
  contentBottomY,
  pageHeight,
  blockHeight,
  marginBottom = 36,
  gapBelowContent = 28,
}) {
  const pageH = Number(pageHeight) || 792;
  const blockH = Number(blockHeight) || 140;
  const margin = Number(marginBottom) || 36;
  const gap = Number(gapBelowContent) || 28;

  let anchorY = Number(contentBottomY);
  if (!Number.isFinite(anchorY)) {
    anchorY = pageH * 0.55;
  }

  // PDF origin is bottom-left: place signature below the lowest text (smaller Y).
  const topBaseline = anchorY - gap;
  const blockBottomY = topBaseline - blockH;

  if (blockBottomY < margin) {
    return { topBaseline: null, needsNewPage: true };
  }

  return { topBaseline, needsNewPage: false };
}
