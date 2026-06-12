import {
  isMembershipPlan,
  serviceDisplayName,
  servicesInMembership,
} from "@/lib/serviceTypeMembershipModel";

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

/** Match subscription row to catalog service type (id, then name). */
export function findServiceTypeForSubscription(subscription, serviceTypes = []) {
  const id = String(subscription?.service_type_id || "").trim();
  if (id) {
    const byId = (serviceTypes || []).find((s) => String(s.id) === id);
    if (byId) return byId;
  }
  const name = String(subscription?.service_type_name || "").trim().toLowerCase();
  if (!name) return null;
  return (
    (serviceTypes || []).find((s) => String(s.name || "").trim().toLowerCase() === name) || null
  );
}

function tagProtocolDocument(doc, serviceType, allServiceTypes = []) {
  if (!doc) return null;
  const serviceId = String(serviceType?.id || doc?.service_type_id || "").trim();
  const serviceName = String(
    doc?.service_name || serviceDisplayName(serviceType, allServiceTypes) || serviceType?.name || ""
  ).trim();
  return {
    ...doc,
    ...(serviceId ? { service_type_id: serviceId } : {}),
    ...(serviceName ? { service_name: serviceName } : {}),
  };
}

/** Protocol docs for a membership (merged from included services) or a single service row. */
export function resolveProtocolDocumentsFromServiceType(serviceType, allServiceTypes = []) {
  if (!serviceType) return [];

  const includedIds = serviceType.included_service_ids || [];
  if (serviceType.is_membership && includedIds.length > 0) {
    const merged = [];
    const seen = new Set();
    for (const id of includedIds) {
      const child = (allServiceTypes || []).find((st) => String(st.id) === String(id));
      if (!child) continue;
      for (const doc of filterProtocolDocuments(child?.protocol_document_urls)) {
        const key = `${child.id}::${doc.name}::${doc.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(tagProtocolDocument(doc, child, allServiceTypes));
      }
    }
    if (merged.length) return merged;
  }

  return filterProtocolDocuments(serviceType.protocol_document_urls).map((doc) =>
    tagProtocolDocument(doc, serviceType, allServiceTypes)
  );
}

/**
 * Per-service MD contract + protocol docs for a membership subscription.
 * Membership IV → IV Therapy, IV Inject each with their own admin uploads.
 */
export function buildServiceWiseDocumentBundles(subscription, allServiceTypes = [], options = {}) {
  const membership = findServiceTypeForSubscription(subscription, allServiceTypes);
  if (!membership) return [];

  const globalContractUrl =
    options.globalContractUrl || pickGlobalMdContractUrl(allServiceTypes);
  const frozenProtocols = getProtocolDocumentsForSubscription(subscription);
  const protocolsByServiceId = new Map();
  for (const doc of frozenProtocols) {
    const serviceId = String(doc?.service_type_id || "").trim() || "__ungrouped__";
    if (!protocolsByServiceId.has(serviceId)) protocolsByServiceId.set(serviceId, []);
    protocolsByServiceId.get(serviceId).push(doc);
  }

  const includedServices = servicesInMembership(membership, allServiceTypes);
  const servicesToShow =
    includedServices.length > 0
      ? includedServices
      : isMembershipPlan(membership)
        ? []
        : [membership];

  return servicesToShow
    .map((service) => {
      const serviceId = String(service.id);
      let protocols = protocolsByServiceId.get(serviceId) || [];
      if (protocols.length === 0) {
        protocols = filterProtocolDocuments(service.protocol_document_urls).map((doc) =>
          tagProtocolDocument(doc, service, allServiceTypes)
        );
      }
      const mdContractUrl = getMdContractUrl(service, {
        allServiceTypes,
        globalContractUrl,
      });
      if (!mdContractUrl && protocols.length === 0) return null;
      return {
        serviceId,
        serviceName: serviceDisplayName(service, allServiceTypes),
        mdContractUrl,
        mdContractLabel: getMdContractDisplayName(service),
        protocols,
      };
    })
    .filter(Boolean);
}

/**
 * Protocol docs frozen on the MD subscription at sign-up.
 * Providers only see documents that were configured when they signed — not later admin uploads.
 */
export function getProtocolDocumentsForSubscription(subscription) {
  return filterProtocolDocuments(subscription?.protocol_document_urls);
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

/** Safe filename for downloading an unsigned MD agreement preview. */
export function getMdContractPreviewFileName(serviceType, providerName) {
  const label = getMdContractDisplayName(serviceType);
  const signer = String(providerName || "provider").trim() || "provider";
  const safe = `${label} - ${signer}`
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
