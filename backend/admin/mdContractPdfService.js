import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { query } from "./db.js";
import { getGlobalMdContractUrl, isUsableMdContractUrl } from "./lib/globalMdContract.js";
import {
  getLastPageSignaturePlacement,
  signatureBlockTopBaseline,
} from "./lib/mdContractPdfLayout.js";
import { locateProviderFieldPlacements } from "./lib/mdContractFieldFill.js";
import { uploadMdSignedContract } from "./supabaseStorage.js";

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

async function fetchPdfBytes(url) {
  const response = await fetch(String(url), { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Could not fetch contract PDF (${response.status}).`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  if (!buf.length) throw new Error("Contract PDF is empty.");
  return buf;
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
  let mdContractUrl = row.md_contract_url || null;
  if (!isUsableMdContractUrl(mdContractUrl)) {
    mdContractUrl = (await getGlobalMdContractUrl()) || null;
  }
  return {
    name: row.name || "",
    md_contract_url: mdContractUrl,
    md_agreement_text: row.md_agreement_text || "",
  };
}

function isUsableDocumentUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "/N/A" || raw.toUpperCase() === "N/A") return false;
  return /^https?:\/\//i.test(raw);
}

/**
 * Resolve the provider details used to fill placeholder fields on the contract.
 * `providerId` may be the Supabase auth user id (md_subscription.provider_id /
 * me.id) or the public.users id.
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

/** Map raw provider details to the logical field keys used by placeholders. */
function buildFieldValues(fields = {}, dateLabel = "", providerNameOverride = "") {
  const name = String(providerNameOverride || fields.full_name || "").trim();
  const practice = String(fields.practice_name || "").trim();
  return {
    date: String(dateLabel || "").trim(),
    providerName: name,
    practiceName: practice,
    // Only one practice/business name is captured for a provider, so the LLC
    // (Manager) and PLLC (Practice) tokens reuse it.
    businessName: practice,
    state: String(fields.state || "").trim(),
    address: composeProviderAddress(fields),
  };
}

/**
 * White out placeholder tokens on the contract and draw the provider's values
 * in their place. Coordinates from locateProviderFieldPlacements are already in
 * pdf-lib's user space.
 */
async function fillProviderFieldsOnDocument(pdfDoc, pdfBytes, fieldValues) {
  let placements;
  try {
    placements = await locateProviderFieldPlacements(pdfBytes);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[md-contract] placeholder scan failed:", err?.message || err);
    return;
  }
  if (!placements?.length) return;

  const font = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const pageCount = pdfDoc.getPageCount();

  for (const placement of placements) {
    const value = String(fieldValues?.[placement.field] || "").trim();
    if (!value) continue;
    if (placement.pageIndex < 0 || placement.pageIndex >= pageCount) continue;

    const page = pdfDoc.getPage(placement.pageIndex);
    const tokenWidth = Math.max(0, placement.rightX - placement.leftX);
    // Draw filled values slightly larger than the surrounding body text and in
    // bold so they stand out as the provider-supplied details.
    const sourceSize = Math.min(11, Math.max(8, placement.fontSize || 11));
    const baseSize = sourceSize + 1.5;

    page.drawRectangle({
      x: placement.leftX - 1,
      y: placement.baselineY - baseSize * 0.3,
      width: tokenWidth + 2,
      height: baseSize * 1.22,
      color: rgb(1, 1, 1),
    });

    // Fit the value into the available horizontal space. Prefer the gap up to
    // the next text on the line so values do not overlap following content;
    // fall back to a small overflow allowance when there is no following text.
    let maxWidth = tokenWidth + 48;
    if (Number.isFinite(placement.nextX)) {
      maxWidth = Math.max(tokenWidth, placement.nextX - placement.leftX - 2);
    }
    let size = baseSize;
    let width = font.widthOfTextAtSize(value, size);
    while (width > maxWidth && size > 8) {
      size -= 0.5;
      width = font.widthOfTextAtSize(value, size);
    }

    page.drawText(value, {
      x: placement.leftX,
      y: placement.baselineY,
      size,
      font,
      color: rgb(0.06, 0.08, 0.15),
    });
  }
}

function effectiveDateLabel(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function wrapTextLines(text, maxChars = 88) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function buildStandaloneAgreementPdf({ agreementText, serviceTypeName }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const title = serviceTypeName
    ? `${serviceTypeName} — MD Board Coverage Agreement`
    : "MD Board Coverage Agreement";

  page.drawText(title, { x: 54, y: 720, size: 14, font: bold, color: rgb(0.1, 0.12, 0.2) });

  const body =
    String(agreementText || "").trim() ||
    "The provider agrees to NOVI MD Board medical director supervision for this service, including applicable clinical scope, documentation, and compliance requirements.";
  const lines = wrapTextLines(body, 88);
  let y = 688;
  let contentEndY = 688;
  for (const line of lines) {
    if (y < 120) {
      break;
    }
    page.drawText(line, { x: 54, y, size: 10, font, color: rgb(0.15, 0.17, 0.22) });
    contentEndY = y;
    y -= 14;
  }
  return { pdfDoc, contentEndY };
}

async function buildContractPdfDocument({ contractPdfUrl }) {
  if (!isUsableDocumentUrl(contractPdfUrl)) {
    throw new Error("An MD contract PDF must be uploaded for this service before signing.");
  }
  const bytes = await fetchPdfBytes(contractPdfUrl);
  const pdfDoc = await PDFDocument.load(bytes);
  const placement = await getLastPageSignaturePlacement(bytes);
  return {
    pdfDoc,
    bytes,
    contentBottomY: placement.contentBottomY,
    pageHeight: placement.pageHeight,
  };
}

/** Draw provider signature on the last page, below all existing contract content. */
async function drawSignatureBelowContent(pdfDoc, {
  contentBottomY,
  pageHeight,
  providerName,
  serviceTypeName,
  contractName,
  dateLabel,
  signature,
}) {
  if (pdfDoc.getPageCount() < 1) {
    throw new Error("Contract PDF has no pages.");
  }

  const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
  const pageWidth = lastPage.getWidth();
  const pageH = pageHeight || lastPage.getHeight();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const embeddedImage =
    signature.format === "png"
      ? await pdfDoc.embedPng(signature.bytes)
      : await pdfDoc.embedJpg(signature.bytes);

  const marginX = Math.max(36, pageWidth * 0.08);
  const imgWidth = Math.min(220, pageWidth - marginX * 2);
  const imgHeight = Math.min(70, (embeddedImage.height / embeddedImage.width) * imgWidth);
  const blockHeight = imgHeight + 88;
  const placement = signatureBlockTopBaseline({
    contentBottomY,
    pageHeight: pageH,
    blockHeight,
    gapBelowContent: 28,
  });

  let sigPage = lastPage;
  let y;
  if (placement.needsNewPage) {
    sigPage = pdfDoc.addPage([pageWidth, pageH]);
    y = pageH - 48;
  } else {
    y = placement.topBaseline;
  }

  sigPage.drawText("Provider Signature", {
    x: marginX,
    y,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.12, 0.2),
  });
  y -= 14;

  sigPage.drawText(`Signed by: ${providerName || "Provider"}`, {
    x: marginX,
    y,
    size: 10,
    font,
    color: rgb(0.1, 0.12, 0.2),
  });
  y -= 13;

  sigPage.drawText(`Date: ${dateLabel}`, {
    x: marginX,
    y,
    size: 10,
    font,
    color: rgb(0.1, 0.12, 0.2),
  });
  y -= 13;

  sigPage.drawText(`Service: ${serviceTypeName || contractName || "MD Board Coverage"}`, {
    x: marginX,
    y,
    size: 10,
    font,
    color: rgb(0.1, 0.12, 0.2),
  });
  y -= 10;

  sigPage.drawImage(embeddedImage, {
    x: marginX,
    y: y - imgHeight,
    width: imgWidth,
    height: imgHeight,
  });
  y -= imgHeight + 8;

  sigPage.drawLine({
    start: { x: marginX, y },
    end: { x: marginX + imgWidth, y },
    thickness: 1,
    color: rgb(0.4, 0.42, 0.48),
  });
  y -= 10;

  sigPage.drawText("Electronic signature applied via NOVI Society", {
    x: marginX,
    y,
    size: 8,
    font,
    color: rgb(0.45, 0.48, 0.55),
  });
}

/**
 * Merge provider signature onto contract PDF and upload to storage.
 */
export async function generateAndUploadSignedMdContract({
  providerId,
  serviceTypeId,
  serviceTypeName,
  providerName,
  signedAtIso,
  signatureDataUrl,
  contractPdfUrl = null,
  agreementText = null,
  providerFields = null,
}) {
  const signature = parseSignatureDataUrl(signatureDataUrl);
  if (!signature) {
    throw new Error("A valid signature is required to generate the signed contract.");
  }

  const contractInfo = contractPdfUrl
    ? {
        md_contract_url: contractPdfUrl,
        name: serviceTypeName,
        md_agreement_text: agreementText || "",
      }
    : await getServiceTypeContractInfo(serviceTypeId);

  const templateUrl = contractPdfUrl || contractInfo.md_contract_url;
  const agreementBody = agreementText || contractInfo.md_agreement_text || "";

  const signedAt = signedAtIso ? new Date(signedAtIso) : new Date();
  const dateLabel = signedAt.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  let pdfDoc;
  let contentBottomY;
  let pageHeight;
  if (isUsableDocumentUrl(templateUrl)) {
    const built = await buildContractPdfDocument({ contractPdfUrl: templateUrl });
    pdfDoc = built.pdfDoc;
    contentBottomY = built.contentBottomY;
    pageHeight = built.pageHeight;

    const fields = providerFields || (await getProviderContractFields(providerId));
    const fieldValues = buildFieldValues(
      fields,
      effectiveDateLabel(signedAt),
      providerName
    );
    await fillProviderFieldsOnDocument(pdfDoc, built.bytes, fieldValues);
  } else {
    const built = await buildStandaloneAgreementPdf({
      agreementText: agreementBody,
      serviceTypeName: serviceTypeName || contractInfo.name,
    });
    pdfDoc = built.pdfDoc;
    contentBottomY = built.contentEndY - 14;
    pageHeight = pdfDoc.getPage(0).getHeight();
  }

  await drawSignatureBelowContent(pdfDoc, {
    contentBottomY,
    pageHeight,
    providerName,
    serviceTypeName,
    contractName: contractInfo.name,
    dateLabel,
    signature,
  });

  const pdfBytes = await pdfDoc.save();
  const safeProvider = String(providerId || "provider").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const safeService = String(serviceTypeId || "service").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const readableBase = [
    String(serviceTypeName || contractInfo.name || "MD Board Agreement").trim(),
    "signed by",
    String(providerName || "provider").trim(),
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
 * Build an unsigned contract PDF with the provider's details filled into the
 * placeholder fields. Used to preview what the contract will look like before
 * the provider signs (in the Apply modal and "Open full PDF").
 *
 * @returns {Promise<Uint8Array>} PDF bytes, or null when no template exists.
 */
export async function buildFilledContractPreviewBytes({
  serviceTypeId,
  providerId,
  providerName = "",
  contractPdfUrl = null,
}) {
  const templateUrl = contractPdfUrl || (await getServiceTypeContractInfo(serviceTypeId)).md_contract_url;
  if (!isUsableDocumentUrl(templateUrl)) return null;

  const bytes = await fetchPdfBytes(templateUrl);
  const pdfDoc = await PDFDocument.load(bytes);

  const fields = await getProviderContractFields(providerId);
  const fieldValues = buildFieldValues(fields, effectiveDateLabel(new Date()), providerName);
  await fillProviderFieldsOnDocument(pdfDoc, bytes, fieldValues);

  return pdfDoc.save();
}
