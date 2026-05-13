import { jsPDF } from "jspdf";
import { format } from "date-fns";

const NOVI_EMAIL_LOGO_PATH = "/novi-email-logo.png";

const COLORS = {
  ink: [30, 37, 53],
  teal: [45, 107, 127],
  periwinkle: [123, 142, 200],
  lime: [200, 230, 60],
  gold: [201, 169, 110],
  cream: [245, 243, 239],
  paper: [255, 255, 255],
  muted: [96, 106, 124],
  line: [223, 228, 236],
};

function setFill(doc, color) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setStroke(doc, color) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function setText(doc, color) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function blendColor(start, end, amount) {
  return start.map((value, index) => Math.round(value + (end[index] - value) * amount));
}

function drawHorizontalGradient(doc, x, y, width, height, startColor, endColor) {
  const steps = Math.max(24, Math.ceil(width / 8));
  const sliceWidth = width / steps;
  for (let step = 0; step < steps; step += 1) {
    const amount = step / Math.max(steps - 1, 1);
    setFill(doc, blendColor(startColor, endColor, amount));
    doc.rect(x + sliceWidth * step, y, sliceWidth + 0.75, height, "F");
  }
}

function detectImageFormat(dataUrl) {
  if (String(dataUrl || "").includes("image/jpeg")) return "JPEG";
  if (String(dataUrl || "").includes("image/webp")) return "WEBP";
  return "PNG";
}

async function loadImageDataUrl(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error("Unable to load image for certificate.");
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to load image for certificate."));
    reader.readAsDataURL(blob);
  });
}

async function resolveNoviLogoDataUrl() {
  const configuredLogoUrl = String(import.meta.env.VITE_NOVI_EMAIL_LOGO_URL || "").trim();
  const candidates = [
    configuredLogoUrl,
    new URL(NOVI_EMAIL_LOGO_PATH, window.location.origin).href,
  ].filter(Boolean);

  let lastError = null;
  for (const candidate of candidates) {
    try {
      return await loadImageDataUrl(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to load NOVI logo for certificate.");
}

async function resolveSignatureDataUrl(signatureDataUrl, signatureImageUrl) {
  const inline = String(signatureDataUrl || "").trim();
  if (inline.startsWith("data:image/")) return inline;
  const remote = String(signatureImageUrl || "").trim();
  if (!remote) return "";
  return loadImageDataUrl(remote);
}

function drawImage(doc, dataUrl, x, y, width, height) {
  const format = detectImageFormat(dataUrl);
  doc.addImage(dataUrl, format, x, y, width, height, undefined, "FAST");
}

function measureDataUrlImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    });
    image.onerror = () => reject(new Error("Unable to measure certificate logo."));
    image.src = dataUrl;
  });
}

function fitContainedRect(sourceWidth, sourceHeight, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = sourceWidth * ratio;
  const height = sourceHeight * ratio;
  return { width, height };
}

function fitFontSize(doc, text, maxWidth, startSize, minSize) {
  let size = startSize;
  while (size > minSize) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxWidth) return size;
    size -= 0.5;
  }
  return minSize;
}

function drawCenteredLines(doc, lines, centerX, startY, lineHeight) {
  let y = startY;
  lines.forEach((line) => {
    doc.text(line, centerX, y, { align: "center" });
    y += lineHeight;
  });
  return y;
}

function drawWrappedCenteredText(doc, text, centerX, startY, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(String(text || "").trim(), maxWidth);
  return drawCenteredLines(doc, lines, centerX, startY, lineHeight);
}

function drawHeaderLogo(doc, logoDataUrl, logoDimensions, frameX, frameY, frameWidth) {
  const innerPad = 6;
  const bandX = frameX + innerPad;
  const bandY = frameY + innerPad;
  const bandWidth = frameWidth - innerPad * 2;
  const headerHeight = 112;

  drawHorizontalGradient(doc, bandX, bandY, bandWidth, headerHeight, COLORS.ink, COLORS.teal);

  if (logoDataUrl && logoDimensions) {
    const maxLogoWidth = bandWidth - 72;
    const maxLogoHeight = headerHeight - 24;
    const { width, height } = fitContainedRect(
      logoDimensions.width,
      logoDimensions.height,
      maxLogoWidth,
      maxLogoHeight
    );
    const logoX = bandX + (bandWidth - width) / 2;
    const logoY = bandY + (headerHeight - height) / 2;
    drawImage(doc, logoDataUrl, logoX, logoY, width, height);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    setText(doc, COLORS.paper);
    doc.text("NOVI SOCIETY", bandX + bandWidth / 2, bandY + 62, { align: "center" });
  }

  return bandY + headerHeight + 24;
}

function drawSignatureBlock(doc, { frameX, frameY, frameWidth, frameHeight, signatureDataUrl, signerName }) {
  const blockWidth = 228;
  const blockHeight = 98;
  const blockX = frameX + frameWidth - blockWidth - 24;
  const blockY = frameY + frameHeight - blockHeight - 24;

  setFill(doc, COLORS.paper);
  setStroke(doc, COLORS.gold);
  doc.setLineWidth(0.8);
  doc.roundedRect(blockX, blockY, blockWidth, blockHeight, 8, 8, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, COLORS.muted);
  doc.text("Authorized signature", blockX + blockWidth / 2, blockY + 14, { align: "center" });

  if (signatureDataUrl) {
    drawImage(doc, signatureDataUrl, blockX + 18, blockY + 20, blockWidth - 36, 42);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setText(doc, COLORS.muted);
    doc.text("Signature on file", blockX + blockWidth / 2, blockY + 44, { align: "center" });
  }

  setStroke(doc, COLORS.ink);
  doc.setLineWidth(0.6);
  doc.line(blockX + 20, blockY + 68, blockX + blockWidth - 20, blockY + 68);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setText(doc, COLORS.ink);
  doc.text("NOVI Society", blockX + blockWidth / 2, blockY + 82, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, COLORS.muted);
  const signerLines = doc.splitTextToSize(String(signerName || "Authorized Representative").trim(), blockWidth - 28);
  doc.text(signerLines[0] || "", blockX + blockWidth / 2, blockY + 92, { align: "center" });
}

function drawMetaBlock(doc, { frameX, frameY, frameWidth, frameHeight, issuedLabel, expirationLabel, certificateLabel }) {
  const metaX = frameX + 24;
  const metaMaxWidth = Math.min(280, frameWidth - 280);
  const metaY = frameY + frameHeight - 78;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setText(doc, COLORS.muted);

  const lines = [
    `Issued at ${issuedLabel}`,
    `Expiration ${expirationLabel}`,
    `Certificate No. ${certificateLabel}`,
  ];

  let y = metaY;
  lines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, metaMaxWidth);
    wrapped.forEach((segment) => {
      doc.text(segment, metaX, y);
      y += 13;
    });
  });
}

export async function generateCourseCertificatePdf({
  providerName,
  certificationName,
  courseTitle,
  certificateNumber,
  issuedAt,
  expiresAt,
  signatureDataUrl,
  signatureImageUrl,
  signerName,
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 34;
  const centerX = pageWidth / 2;
  const frameX = margin + 10;
  const frameY = margin + 10;
  const frameWidth = pageWidth - margin * 2 - 20;
  const frameHeight = pageHeight - margin * 2 - 20;
  const contentWidth = frameWidth - 72;

  const issuedLabel = issuedAt ? format(new Date(issuedAt), "MMMM d, yyyy") : format(new Date(), "MMMM d, yyyy");
  const courseLabel = String(certificationName || courseTitle || "Course Certification").trim();
  const recipientName = String(providerName || "Provider").trim();
  const expirationLabel = expiresAt
    ? format(new Date(expiresAt), "MMMM d, yyyy")
    : "Never expires";
  const certificateLabel = String(certificateNumber || "NOVI").trim();
  const resolvedSignatureDataUrl = await resolveSignatureDataUrl(signatureDataUrl, signatureImageUrl);

  drawHorizontalGradient(doc, 0, 0, pageWidth, pageHeight, COLORS.cream, blendColor(COLORS.cream, COLORS.periwinkle, 0.18));

  setFill(doc, COLORS.paper);
  setStroke(doc, COLORS.gold);
  doc.setLineWidth(1.4);
  doc.roundedRect(frameX, frameY, frameWidth, frameHeight, 12, 12, "FD");

  setStroke(doc, COLORS.teal);
  doc.setLineWidth(0.6);
  doc.roundedRect(frameX + 6, frameY + 6, frameWidth - 12, frameHeight - 12, 10, 10, "S");

  let logoDataUrl = null;
  let logoDimensions = null;
  try {
    logoDataUrl = await resolveNoviLogoDataUrl();
    logoDimensions = await measureDataUrlImage(logoDataUrl);
  } catch {
    logoDataUrl = null;
    logoDimensions = null;
  }

  let cursorY = drawHeaderLogo(doc, logoDataUrl, logoDimensions, frameX, frameY, frameWidth);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(doc, COLORS.teal);
  doc.text("CERTIFICATE OF COMPLETION", centerX, cursorY, { align: "center" });
  cursorY += 18;

  setStroke(doc, COLORS.gold);
  doc.setLineWidth(0.8);
  doc.line(centerX - 120, cursorY, centerX + 120, cursorY);
  cursorY += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setText(doc, COLORS.muted);
  doc.text("This certifies that", centerX, cursorY, { align: "center" });
  cursorY += 38;

  doc.setFont("times", "bolditalic");
  const recipientSize = fitFontSize(doc, recipientName, contentWidth, 30, 20);
  doc.setFontSize(recipientSize);
  setText(doc, COLORS.ink);
  cursorY = drawWrappedCenteredText(doc, recipientName, centerX, cursorY, contentWidth, recipientSize + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setText(doc, COLORS.muted);
  const completedY = cursorY + 8;
  doc.text("has successfully completed", centerX, completedY, { align: "center" });
  cursorY = completedY + 28;

  const courseMaxWidth = contentWidth - 48;
  doc.setFont("helvetica", "bold");
  const courseSize = fitFontSize(doc, courseLabel, courseMaxWidth, 36, 22);
  doc.setFontSize(courseSize);
  const courseLines = doc.splitTextToSize(courseLabel, courseMaxWidth);
  const courseLineHeight = courseSize + 10;
  const courseBlockHeight = courseLines.length * courseLineHeight;
  const awardedY = frameY + frameHeight - 132;
  const courseStartY = cursorY + Math.max(16, (awardedY - cursorY - courseBlockHeight) / 2);
  setText(doc, COLORS.teal);
  cursorY = drawCenteredLines(doc, courseLines, centerX, courseStartY, courseLineHeight);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setText(doc, COLORS.muted);
  const recognitionY = Math.max(cursorY + 12, awardedY - 18);
  cursorY = drawWrappedCenteredText(
    doc,
    "Awarded in recognition of completion of NOVI Society provider training requirements.",
    centerX,
    recognitionY,
    contentWidth,
    13
  );

  const maxBodyY = frameY + frameHeight - 118;
  if (cursorY > maxBodyY) {
    cursorY = maxBodyY;
  }

  drawMetaBlock(doc, {
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    issuedLabel,
    expirationLabel,
    certificateLabel,
  });

  drawSignatureBlock(doc, {
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    signatureDataUrl: resolvedSignatureDataUrl,
    signerName,
  });

  return doc.output("blob");
}
