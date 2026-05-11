export const CERTIFICATE_EXPIRATION_DATE = "date";
export const CERTIFICATE_EXPIRATION_NEVER = "never";

export function getCourseCertificationName(course) {
  return String(course?.title || course?.certification_name || "Course Certification").trim();
}

export function resolveCertificateExpiration(issueForm = {}) {
  const expirationType = String(issueForm.expiration_type || "").trim();
  if (expirationType === CERTIFICATE_EXPIRATION_NEVER) return null;
  if (expirationType === CERTIFICATE_EXPIRATION_DATE) {
    const expiresAt = String(issueForm.expires_at || "").trim();
    return expiresAt || null;
  }
  return null;
}

export function validateCertificateIssueForm(issueForm = {}, options = {}) {
  const expirationType = String(issueForm.expiration_type || "").trim();
  if (!expirationType) {
    return "Choose whether the certificate expires on a date or never.";
  }
  if (expirationType === CERTIFICATE_EXPIRATION_DATE) {
    const expiresAt = String(issueForm.expires_at || "").trim();
    if (!expiresAt) {
      return "Enter an expiration date or choose Never.";
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(`${expiresAt}T00:00:00`);
    if (Number.isNaN(selected.getTime()) || selected < today) {
      return "Expiration date cannot be before today.";
    }
  }
  const hasSignature = Boolean(
    options.hasSignature || String(issueForm.issuer_signature_data || "").trim()
  );
  if (!hasSignature) {
    return "Add a NOVI Society signature before issuing.";
  }
  return "";
}

export function dataUrlToBlob(dataUrl) {
  const [header, base64] = String(dataUrl || "").split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}
