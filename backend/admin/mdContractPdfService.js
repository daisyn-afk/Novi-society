import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { query } from "./db.js";
import {
  buildMdAgreementValues,
  buildMdAgreementBlocks,
  buildMdSignatureBlocks,
  parseAgreementSegments,
  buildAgreementContextFromProfile,
  mergeAgreementContext,
} from "../../src/lib/mdAgreementTemplate.js";
import { uploadMdSignedContract } from "./supabaseStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCTOR_SIGNATURE_PATH = path.join(__dirname, "assets", "doctor-signature.png");

let doctorSignatureBytesCache;
function getDoctorSignatureBytes() {
  if (doctorSignatureBytesCache !== undefined) return doctorSignatureBytesCache;
  try {
    doctorSignatureBytesCache = fs.readFileSync(DOCTOR_SIGNATURE_PATH);
  } catch {
    doctorSignatureBytesCache = null;
  }
  return doctorSignatureBytesCache;
}

function parseSignatureDataUrl(dataUrl) {
  const raw = String(dataUrl || "").trim();
  const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(raw);
  if (!match) return null;
  try {
    return {
      format: match[1].toLowerCase(),
      bytes: Buffer.from(match[2], "base64"),
    };
  } catch {
    return null;
  }
}

export async function getServiceTypeContractInfo(serviceTypeId) {
  const id = String(serviceTypeId || "").trim();
  if (!id) return { name: "", md_contract_url: null, md_agreement_text: "" };
  const { rows } = await query(
    `select name, md_contract_url, md_agreement_text
       from public.service_type
      where id = $1
      limit 1`,
    [id]
  );
  const row = rows?.[0] || {};
  return {
    name: row.name || "",
    md_contract_url: row.md_contract_url || null,
    md_agreement_text: row.md_agreement_text || "",
  };
}

/**
 * Resolve the provider details used to fill the agreement tokens. `providerId`
 * may be the Supabase auth user id or the public.users id.
 */
export async function getProviderContractFields(providerId) {
  const id = String(providerId || "").trim();
  if (!id) return {};
  try {
    const { rows } = await query(
      `select u.full_name,
              p.address_line1, p.address_line2, p.city, p.state, p.zip,
              p.metadata
         from public.users u
         left join public.provider_profiles p on p.user_id = u.id
        where u.auth_user_id = $1 or u.id::text = $1
        limit 1`,
      [id]
    );
    const row = rows?.[0] || {};
    const metadata =
      row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    return {
      full_name: row.full_name || "",
      address_line1: row.address_line1 || "",
      address_line2: row.address_line2 || "",
      city: row.city || "",
      state: row.state || "",
      zip: row.zip || "",
      practice_name: metadata.practice_name || "",
    };
  } catch {
    return {};
  }
}

function composeProviderAddress(fields = {}) {
  const cityStateZip = [
    String(fields.city || "").trim(),
    [String(fields.state || "").trim(), String(fields.zip || "").trim()]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return [
    String(fields.address_line1 || "").trim(),
    String(fields.address_line2 || "").trim(),
    cityStateZip,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Logical token context (providerName/practiceName/state/address) for the agreement. */
export async function getProviderAgreementContext(
  providerId,
  { providerNameOverride = "", profileSnapshot = null } = {}
) {
  const fromProfile = profileSnapshot ? buildAgreementContextFromProfile(profileSnapshot) : {};
  const fields = await getProviderContractFields(providerId);
  const fromDb = buildAgreementContextFromProfile({
    full_name: fields.full_name,
    practice_name: fields.practice_name,
    state: fields.state,
    address_line1: fields.address_line1,
    address_line2: fields.address_line2,
    city: fields.city,
    zip: fields.zip,
  });
  return mergeAgreementContext(fromProfile, { providerName: providerNameOverride }, fromDb);
}

// ─── PDF layout helpers ──────────────────────────────────────────────────────

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 56;
const MARGIN_TOP = 58;
const MARGIN_BOTTOM = 56;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const INK = rgb(0.1, 0.12, 0.2);
const BODY = rgb(0.16, 0.18, 0.24);
const MUTED = rgb(0.42, 0.45, 0.52);

function createRenderer(pdfDoc, fonts) {
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_TOP;

  function ensure(space) {
    if (y - space < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN_TOP;
    }
  }

  /**
   * Greedy word-wrap across mixed-font tokens. Whitespace (including across
   * token boundaries) is collapsed into a single inter-word space, while
   * adjacent runs with no whitespace between them (e.g. punctuation) stay glued
   * — so "(Name)" and "2026," do not gain stray spaces.
   */
  function layout(tokens, size, maxWidth) {
    const words = [];
    let pendingSpace = false;
    for (const tok of tokens) {
      let buf = "";
      let spaceBefore = pendingSpace;
      const str = String(tok.text || "");
      for (let i = 0; i < str.length; i += 1) {
        const ch = str[i];
        if (/\s/.test(ch)) {
          if (buf) {
            words.push({ text: buf, font: tok.font, color: tok.color, space: spaceBefore });
            buf = "";
          }
          pendingSpace = true;
        } else {
          if (!buf) {
            spaceBefore = pendingSpace;
            pendingSpace = false;
          }
          buf += ch;
        }
      }
      if (buf) words.push({ text: buf, font: tok.font, color: tok.color, space: spaceBefore });
    }

    const lines = [];
    let line = [];
    let lineWidth = 0;
    const spaceW = fonts.regular.widthOfTextAtSize(" ", size);
    for (const word of words) {
      const wWidth = word.font.widthOfTextAtSize(word.text, size);
      const lead = line.length && word.space ? spaceW : 0;
      if (line.length && lineWidth + lead + wWidth > maxWidth) {
        lines.push(line);
        line = [{ ...word, space: false }];
        lineWidth = wWidth;
      } else {
        line.push(word);
        lineWidth += lead + wWidth;
      }
    }
    if (line.length) lines.push(line);
    return { lines, spaceW };
  }

  function drawTokens(tokens, { size = 10.5, gapAfter = 8, lineGap = 3, x = MARGIN_X, maxWidth = CONTENT_W } = {}) {
    const { lines, spaceW } = layout(tokens, size, maxWidth);
    const lineH = size + lineGap;
    for (const line of lines) {
      ensure(lineH);
      let cursorX = x;
      for (let i = 0; i < line.length; i += 1) {
        const word = line[i];
        if (i > 0 && word.space) cursorX += spaceW;
        page.drawText(word.text, { x: cursorX, y, size, font: word.font, color: word.color || BODY });
        cursorX += word.font.widthOfTextAtSize(word.text, size);
      }
      y -= lineH;
    }
    y -= gapAfter;
  }

  function drawCentered(text, { size = 11, font = fonts.bold, color = INK, gapAfter = 8 } = {}) {
    ensure(size + 4);
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (PAGE_W - w) / 2, y, size, font, color });
    y -= size + gapAfter;
  }

  return {
    get page() {
      return page;
    },
    get y() {
      return y;
    },
    set y(v) {
      y = v;
    },
    ensure,
    drawTokens,
    drawCentered,
    newPage() {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN_TOP;
    },
  };
}

function drawSignatureColumn(page, fonts, x, topY, colW, block, sigImage, dynamic = false) {
  let yy = topY;
  page.drawText(String(block.role || "").toUpperCase(), {
    x, y: yy, size: 9, font: fonts.bold, color: INK,
  });
  yy -= 16;
  page.drawText(block.entity || "", { x, y: yy, size: 11, font: fonts.bold, color: INK });
  yy -= 13;
  page.drawText(block.entityType || "", { x, y: yy, size: 9, font: fonts.italic, color: MUTED });

  const lineY = yy - 44;
  if (sigImage) {
    const imgW = Math.min(colW - 4, (sigImage.width / sigImage.height) * 32);
    const imgH = Math.min(32, (sigImage.height / sigImage.width) * imgW);
    page.drawImage(sigImage, { x, y: lineY + 3, width: imgW, height: imgH });
  }
  page.drawLine({ start: { x, y: lineY }, end: { x: x + colW, y: lineY }, thickness: 1, color: rgb(0.4, 0.42, 0.48) });

  let ty = lineY - 13;
  const namePrefix = "Name: ";
  page.drawText(namePrefix, { x, y: ty, size: 9.5, font: fonts.regular, color: BODY });
  page.drawText(block.name || "", {
    x: x + fonts.regular.widthOfTextAtSize(namePrefix, 9.5),
    y: ty,
    size: 9.5,
    font: dynamic ? fonts.bold : fonts.regular,
    color: dynamic ? INK : BODY,
  });
  ty -= 12;
  page.drawText(`Title: ${block.title || ""}`, { x, y: ty, size: 9.5, font: fonts.regular, color: BODY });
  return ty - 8;
}

/**
 * Render the full code-defined agreement to a PDF.
 * @param {object} opts
 * @param {object} opts.context  provider token context
 * @param {string} opts.serviceTypeName
 * @param {Date}   opts.effectiveDate
 * @param {{format:string,bytes:Buffer}|null} opts.providerSignature drawn signature
 * @returns {Promise<Uint8Array>}
 */
async function renderAgreementPdf({ context, serviceTypeName, effectiveDate, providerSignature }) {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
  };

  const values = buildMdAgreementValues({
    providerName: context?.providerName || "",
    practiceName: context?.practiceName || "",
    state: context?.state || "",
    address: context?.address || "",
    serviceName: serviceTypeName || "",
    effectiveDate: effectiveDate || new Date(),
  });
  const blocks = buildMdAgreementBlocks(values);
  const sig = buildMdSignatureBlocks(values);

  const r = createRenderer(pdfDoc, fonts);

  // Convert marked block text into tokens, bolding dynamic (filled-in) values.
  const toTokens = (text) =>
    parseAgreementSegments(text).map((seg) =>
      seg.dynamic
        ? { text: seg.text, font: fonts.bold, color: INK }
        : { text: seg.text, font: fonts.regular, color: BODY }
    );

  for (const block of blocks) {
    if (block.type === "title") {
      r.drawCentered(String(block.text).toUpperCase(), { size: 13.5, gapAfter: 14 });
    } else if (block.type === "heading") {
      r.y -= 6;
      r.drawTokens([{ text: String(block.text).toUpperCase(), font: fonts.bold, color: INK }], { size: 11, gapAfter: 5 });
    } else if (block.type === "clause") {
      r.drawTokens(
        [{ text: `${block.label} `, font: fonts.bold, color: INK }, ...toTokens(block.text)],
        { size: 10.5, gapAfter: 8 }
      );
    } else {
      r.drawTokens(toTokens(block.text), { size: 10.5, gapAfter: 8 });
    }
  }

  // ─── Signature page ───
  const blockHeight = 150;
  if (r.y - blockHeight < MARGIN_BOTTOM) r.newPage();
  else r.y -= 10;

  r.drawCentered("SIGNATURE PAGE", { size: 12, gapAfter: 10 });
  r.drawTokens(toTokens(sig.intro), { size: 10.5, gapAfter: 18 });

  // Embed signatures.
  let providerImg = null;
  if (providerSignature) {
    try {
      providerImg = providerSignature.format === "png"
        ? await pdfDoc.embedPng(providerSignature.bytes)
        : await pdfDoc.embedJpg(providerSignature.bytes);
    } catch { providerImg = null; }
  }
  let doctorImg = null;
  const doctorBytes = getDoctorSignatureBytes();
  if (doctorBytes) {
    try { doctorImg = await pdfDoc.embedPng(doctorBytes); } catch { doctorImg = null; }
  }

  const colW = (CONTENT_W - 28) / 2;
  const rightX = MARGIN_X + colW + 28;
  const topY = r.y;
  const leftBottom = drawSignatureColumn(r.page, fonts, MARGIN_X, topY, colW, sig.left, providerImg, true);
  const rightBottom = drawSignatureColumn(r.page, fonts, rightX, topY, colW, sig.right, doctorImg, false);
  r.y = Math.min(leftBottom, rightBottom) - 14;

  r.drawTokens(
    [{ text: "Electronic signature applied via NOVI Society.", font: fonts.italic, color: MUTED }],
    { size: 8, gapAfter: 0 }
  );

  return pdfDoc.save();
}

/**
 * Generate the signed agreement PDF (provider drawn signature + doctor default)
 * and upload it to storage. Returns the public URL.
 */
export async function generateAndUploadSignedMdContract({
  providerId,
  serviceTypeId,
  serviceTypeName,
  providerName,
  signedAtIso,
  signatureDataUrl,
  // legacy args (contractPdfUrl / agreementText / providerFields) accepted but unused
  providerFields = null,
}) {
  const providerSignature = parseSignatureDataUrl(signatureDataUrl);
  if (!providerSignature) {
    throw new Error("A valid signature is required to generate the signed contract.");
  }

  const signedAt = signedAtIso ? new Date(signedAtIso) : new Date();
  const resolvedName =
    serviceTypeName || (serviceTypeId ? (await getServiceTypeContractInfo(serviceTypeId)).name : "");

  const context = providerFields
    ? {
        providerName: String(providerName || providerFields.full_name || "").trim(),
        practiceName: String(providerFields.practice_name || "").trim(),
        state: String(providerFields.state || "").trim(),
        address: composeProviderAddress(providerFields),
      }
    : await getProviderAgreementContext(providerId, { providerNameOverride: providerName });

  const pdfBytes = await renderAgreementPdf({
    context,
    serviceTypeName: resolvedName,
    effectiveDate: signedAt,
    providerSignature,
  });

  const safeProvider = String(providerId || "provider").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const safeService = String(serviceTypeId || "service").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const readableBase =
    [
      String(resolvedName || "MD Board Agreement").trim(),
      "signed by",
      String(providerName || context.providerName || "provider").trim(),
    ]
      .filter(Boolean)
      .join(" - ")
      .replace(/[^\w\s.-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "MD Board Agreement";

  const uploaded = await uploadMdSignedContract({
    buffer: Buffer.from(pdfBytes),
    mimeType: "application/pdf",
    extension: "pdf",
    providerId: safeProvider,
    serviceTypeId: safeService,
    fileName: `md-signed-contracts/${safeProvider}/${safeService}/${readableBase}-${Date.now()}.pdf`,
  });

  return uploaded.url;
}

export async function attachSignedContractToSubscription(subscriptionId, options) {
  const id = String(subscriptionId || "").trim();
  if (!id) return null;
  const url = await generateAndUploadSignedMdContract(options);
  await query(
    `update public.md_subscription
        set signed_contract_url = $2,
            updated_at = now()
      where id = $1::uuid`,
    [id, url]
  );
  return url;
}

/**
 * Build an UNSIGNED preview of the agreement with the provider's details filled
 * in (doctor's default signature shown, provider signature line blank). Used by
 * the "Open full PDF" download in the apply modal.
 *
 * @returns {Promise<Uint8Array>} PDF bytes.
 */
export async function buildFilledContractPreviewBytes({
  serviceTypeId,
  providerId,
  providerName = "",
  serviceTypeName = "",
}) {
  const resolvedName =
    serviceTypeName || (serviceTypeId ? (await getServiceTypeContractInfo(serviceTypeId)).name : "");
  const context = await getProviderAgreementContext(providerId, { providerNameOverride: providerName });
  return renderAgreementPdf({
    context,
    serviceTypeName: resolvedName,
    effectiveDate: new Date(),
    providerSignature: null,
  });
}
