/** True when a service-type document URL is a real uploaded http(s) link. */
export function isUsableDocumentUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "/N/A" || raw.toUpperCase() === "N/A") return false;
  return /^https?:\/\//i.test(raw);
}

/** True when a filename looks like a storage key (timestamp/uuid), not a human title. */
function looksLikeStorageObjectKey(name) {
  const base = String(name || "").trim();
  if (!base) return true;
  if (/^md-coverage-/i.test(base)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)) return true;
  if (/^[0-9]{10,}-[0-9a-f-]{8,}$/i.test(base)) return true;
  return false;
}

export function getMdContractUrl(serviceType) {
  const url = String(serviceType?.md_contract_url || "").trim();
  return isUsableDocumentUrl(url) ? url : null;
}

/** Human-readable label for the admin-uploaded MD contract PDF. */
export function getMdContractDisplayName(serviceType, fallback = "MD Board Agreement") {
  const serviceName = String(serviceType?.name || serviceType?.service_type_name || "").trim();
  if (serviceName) return `${serviceName} MD Board Agreement`;

  const url = getMdContractUrl(serviceType);
  if (url) {
    try {
      const file = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
      const base = file.replace(/\.pdf$/i, "").trim();
      if (base && !looksLikeStorageObjectKey(base)) return base;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

/** Safe filename for downloading a signed MD contract. */
export function getSignedMdContractFileName(serviceType, signedByName) {
  const label = getMdContractDisplayName(serviceType);
  const signer = String(signedByName || "provider").trim() || "provider";
  const safe = `${label} - signed by ${signer}`
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${safe || "MD Board Agreement"}.pdf`;
}

export function filterProtocolDocuments(docs) {
  return (Array.isArray(docs) ? docs : []).filter((doc) => {
    const name = String(doc?.name || "").trim();
    return name && isUsableDocumentUrl(doc?.url);
  });
}
