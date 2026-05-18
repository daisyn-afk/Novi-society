export function resolveCertificationDocumentUrl(cert) {
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

export function isExternalSubmittedCert(cert) {
  if (String(cert?.status || "").toLowerCase() !== "pending") return false;
  return Boolean(resolveCertificationDocumentUrl(cert));
}

export function isNoviIssuedCert(cert) {
  const status = String(cert?.status || "").toLowerCase();
  if (status !== "active") return false;
  if (cert?.enrollment_id) return true;
  const certificateNumber = String(cert?.certificate_number || cert?.cert_number || "");
  if (certificateNumber.startsWith("NOVI-EXT-")) return false;
  return certificateNumber.startsWith("NOVI-") && Boolean(resolveCertificationDocumentUrl(cert));
}

export function isExternalUploadedCert(cert) {
  if (isNoviIssuedCert(cert)) return false;
  if (cert?.enrollment_id) return false;
  const hasDocument = Boolean(resolveCertificationDocumentUrl(cert));
  const status = String(cert?.status || "").toLowerCase();
  if (status === "pending" && hasDocument) return true;
  return hasDocument || Boolean(cert?.service_type_id || cert?.issued_by);
}

export function getCertificationDateMeta(cert) {
  const status = String(cert?.status || "").toLowerCase();
  const noviIssued = isNoviIssuedCert(cert);
  const issuedAt = cert?.issued_at || null;
  const submittedAt = cert?.submitted_at || cert?.created_date || cert?.created_at || null;
  const displayAt = noviIssued ? issuedAt : (status === "pending" ? submittedAt : (issuedAt || submittedAt));
  const label = noviIssued || status === "active" ? "Issued at" : "Submitted";
  return { label, displayAt };
}

export function minExpirationDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
