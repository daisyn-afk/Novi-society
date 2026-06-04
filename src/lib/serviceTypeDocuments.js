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

/** First usable MD contract URL across service types (shared global contract). */
export function pickGlobalMdContractUrl(serviceTypes) {
  for (const st of serviceTypes || []) {
    const url = String(st?.md_contract_url || "").trim();
    if (isUsableDocumentUrl(url)) return url;
  }
  return null;
}

export function getMdContractUrl(serviceType, options = {}) {
  const url = String(serviceType?.md_contract_url || "").trim();
  if (isUsableDocumentUrl(url)) return url;
  const globalUrl =
    options.globalContractUrl ||
    pickGlobalMdContractUrl(options.allServiceTypes);
  return isUsableDocumentUrl(globalUrl) ? globalUrl : null;
}

/** Protocol docs for a provider MD subscription (snapshot first, then live service config). */
export function getProtocolDocumentsForSubscription(subscription, serviceType) {
  const snapshot = filterProtocolDocuments(subscription?.protocol_document_urls);
  if (snapshot.length) return snapshot;
  const tiers = serviceType?.coverage_tiers || [];
  const tierNum = subscription?.coverage_tier || 1;
  if (tiers.length > 0) {
    const tierDef =
      tiers.find((t) => t.tier_number === tierNum) ||
      tiers.find((t) => t.tier_number === 1) ||
      tiers[0];
    return filterProtocolDocuments(tierDef?.protocol_document_urls);
  }
  return filterProtocolDocuments(serviceType?.protocol_document_urls);
}

export function subscriptionHasMdAgreement(subscription) {
  if (!subscription) return false;
  if (String(subscription.status || "").toLowerCase() === "active") return true;
  return Boolean(
    subscription.signed_at &&
      (isUsableDocumentUrl(subscription.signed_contract_url) || subscription.signature_data)
  );
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
