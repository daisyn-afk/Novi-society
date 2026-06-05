import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { query } from "./db.js";
import { getGlobalMdContractUrl, isUsableMdContractUrl } from "./lib/globalMdContract.js";
import {
  getLastPageSignaturePlacement,
  signatureBlockTopBaseline,
} from "./lib/mdContractPdfLayout.js";
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
  const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
  const placement = await getLastPageSignaturePlacement(bytes);
  return {
    pdfDoc,
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

  let pdfDoc;
  let contentBottomY;
  let pageHeight;
  if (isUsableDocumentUrl(templateUrl)) {
    const built = await buildContractPdfDocument({ contractPdfUrl: templateUrl });
    pdfDoc = built.pdfDoc;
    contentBottomY = built.contentBottomY;
    pageHeight = built.pageHeight;
  } else {
    const built = await buildStandaloneAgreementPdf({
      agreementText: agreementBody,
      serviceTypeName: serviceTypeName || contractInfo.name,
    });
    pdfDoc = built.pdfDoc;
    contentBottomY = built.contentEndY - 14;
    pageHeight = pdfDoc.getPage(0).getHeight();
  }

  const signedAt = signedAtIso ? new Date(signedAtIso) : new Date();
  const dateLabel = signedAt.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

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
