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

/**
 * Placeholder tokens used in the uploaded MD management-services agreement.
 * Patterns are evaluated against a whitespace-stripped reconstruction of each
 * text line, so they must be written without spaces. Each maps to a logical
 * provider field that is resolved in mdContractPdfService.
 *
 * Order matters: longer/more specific tokens are listed first so they win when
 * two patterns could match overlapping ranges.
 */
const PLACEHOLDER_RULES = [
  { field: "address", re: /\(ADDRESSNURSEISUSING-?HOMEORBUSINESS\)/gi },
  { field: "address", re: /\(NURSESADDRESS\)/gi },
  { field: "providerName", re: /\(NAMEOFNURSE\)/gi },
  { field: "providerName", re: /\(NURSE['’]SNAME\)/gi },
  { field: "providerName", re: /\(NURSESNAME\)/gi },
  { field: "practiceName", re: /\(NAMEOFPLLC\)/gi },
  { field: "practiceName", re: /\(PLLCNAME\)/gi },
  { field: "practiceName", re: /\(PLLC\)/gi },
  { field: "businessName", re: /\(BUSINESSNAME\)/gi },
  { field: "businessName", re: /\(NAMEOFLLC\)/gi },
  { field: "businessName", re: /\(LLCNAME\)/gi },
  { field: "state", re: /\(STATE\)/gi },
  { field: "date", re: /\(DATE\)/gi },
];

const LINE_BASELINE_TOLERANCE = 3;

/** Group text items that share (approximately) the same baseline into lines. */
function groupItemsIntoLines(items) {
  const lines = [];
  for (const item of items) {
    let line = lines.find((l) => Math.abs(l.baselineY - item.baselineY) <= LINE_BASELINE_TOLERANCE);
    if (!line) {
      line = { baselineY: item.baselineY, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
  }
  return lines;
}

/**
 * Build a whitespace-free string for a line plus a map from each compact
 * character back to its source text item and the character offset within it.
 */
function buildCompactLine(line) {
  let compact = "";
  const map = [];
  line.items.forEach((item) => {
    const str = String(item.str || "");
    for (let ci = 0; ci < str.length; ci += 1) {
      if (/\s/.test(str[ci])) continue;
      compact += str[ci];
      map.push({ item, charIndex: ci });
    }
  });
  return { compact, map };
}

/** Estimated left x of a character, assuming proportional spacing within the item. */
function charLeftX(item, charIndex) {
  const len = String(item.str || "").length || 1;
  return item.x + (item.width || 0) * (charIndex / len);
}

/** Estimated right x of a character. */
function charRightX(item, charIndex) {
  const len = String(item.str || "").length || 1;
  return item.x + (item.width || 0) * ((charIndex + 1) / len);
}

/**
 * Locate every fillable placeholder in the contract PDF.
 *
 * Returns geometry in PDF user space (origin bottom-left, y up) which matches
 * pdf-lib's coordinate system, so callers can draw directly onto the same page.
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @returns {Promise<Array<{pageIndex:number, leftX:number, rightX:number, baselineY:number, fontSize:number, field:string}>>}
 */
export async function locateProviderFieldPlacements(pdfBytes) {
  configurePdfJs();
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes),
    standardFontDataUrl: PDFJS_STANDARD_FONTS,
    disableFontFace: true,
  }).promise;

  const placements = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const items = [];
      for (const raw of textContent.items) {
        if (!raw?.str) continue;
        const transform = raw.transform || [];
        items.push({
          str: raw.str,
          x: Number(transform[4]) || 0,
          baselineY: Number(transform[5]) || 0,
          width: Number(raw.width) || 0,
          height: Number(raw.height) > 0 ? Number(raw.height) : 11,
        });
      }
      if (!items.length) continue;

      const lines = groupItemsIntoLines(items);
      for (const line of lines) {
        const { compact, map } = buildCompactLine(line);
        if (!compact) continue;

        const matches = [];
        for (const rule of PLACEHOLDER_RULES) {
          rule.re.lastIndex = 0;
          let m;
          while ((m = rule.re.exec(compact)) !== null) {
            matches.push({ start: m.index, end: m.index + m[0].length, field: rule.field });
            if (m.index === rule.re.lastIndex) rule.re.lastIndex += 1;
          }
        }
        if (!matches.length) continue;

        matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
        let consumedUntil = -1;
        for (const match of matches) {
          if (match.start < consumedUntil) continue;
          consumedUntil = match.end;
          const startMap = map[match.start];
          const endMap = map[match.end - 1];
          if (!startMap || !endMap) continue;
          const leftX = charLeftX(startMap.item, startMap.charIndex);
          const rightX = charRightX(endMap.item, endMap.charIndex);
          // x of the next visible content to the right on this line, so the
          // filled value can be kept from overlapping following text.
          let nextX = null;
          for (const item of line.items) {
            if (item.x > rightX + 0.5) {
              nextX = nextX === null ? item.x : Math.min(nextX, item.x);
            }
          }
          placements.push({
            pageIndex: pageNumber - 1,
            leftX,
            rightX,
            nextX,
            baselineY: line.baselineY,
            fontSize: startMap.item.height || 11,
            field: match.field,
          });
        }
      }
    }
  } finally {
    await doc.destroy();
  }
  return placements;
}
