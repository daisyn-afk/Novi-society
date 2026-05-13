import { generateCourseCertificatePdf } from "@/lib/generateCourseCertificatePdf";
import { isNoviIssuedCert } from "@/lib/certificationBuckets";

export function resolveCertDocumentUrl(cert) {
  const directUrl = String(cert?.certificate_url || "").trim();
  if (directUrl && directUrl !== "/N/A" && directUrl.toUpperCase() !== "N/A") return directUrl;

  const fallbackFields = [
    cert?.certification_url,
    cert?.certification_file_url,
    cert?.document_url,
    cert?.file_url,
    cert?.attachment_url,
  ];
  for (const value of fallbackFields) {
    const url = String(value || "").trim();
    if (url && url !== "/N/A" && url.toUpperCase() !== "N/A") return url;
  }

  const notes = String(cert?.notes || "");
  const taggedUrl = notes.match(/(?:Certificate|License)\s+document:\s*(https?:\/\/\S+)/i)?.[1];
  if (taggedUrl) return taggedUrl.trim();
  const firstUrl = notes.match(/https?:\/\/\S+/i)?.[0];
  return firstUrl ? firstUrl.trim() : null;
}

export function canRenderNoviCertificate(cert) {
  return isNoviIssuedCert(cert);
}

export function hasCertificateDocument(cert) {
  return canRenderNoviCertificate(cert) || Boolean(resolveCertDocumentUrl(cert));
}

export async function buildCertificateDocumentBlob(cert) {
  if (!canRenderNoviCertificate(cert)) {
    const url = resolveCertDocumentUrl(cert);
    if (!url) {
      throw new Error("Certificate file is not available.");
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Unable to load certificate.");
    }
    return response.blob();
  }

  return generateCourseCertificatePdf({
    providerName: cert?.provider_name,
    certificationName: cert?.certification_name,
    courseTitle: cert?.certification_name,
    certificateNumber: cert?.certificate_number || cert?.cert_number,
    issuedAt: cert?.issued_at,
    expiresAt: cert?.expires_at,
    signatureDataUrl: "",
    signatureImageUrl: cert?.issuer_signature_url,
    signerName: cert?.issued_by,
  });
}

export async function openCertificateDocument(cert) {
  const blob = await buildCertificateDocumentBlob(cert);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function downloadCertificateDocument(certOrUrl, filename = "certificate.pdf") {
  if (typeof certOrUrl === "string") {
    const response = await fetch(certOrUrl);
    if (!response.ok) {
      throw new Error("Unable to download certificate.");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return;
  }

  const blob = await buildCertificateDocumentBlob(certOrUrl);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
