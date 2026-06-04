import { query } from "../db.js";

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeProtocolDocument(doc = {}) {
  return {
    name: asString(doc.name, "").trim(),
    url: asString(doc.url, "").trim(),
  };
}

function isUsableDocumentUrl(value) {
  const raw = String(value || "").trim();
  return /^https?:\/\//i.test(raw);
}

export function filterProtocolDocuments(docs) {
  return (Array.isArray(docs) ? docs : [])
    .map(normalizeProtocolDocument)
    .filter((doc) => doc.name && isUsableDocumentUrl(doc.url));
}

/** Protocol docs configured on a service type (tier-aware). */
export function resolveProtocolDocumentsFromServiceType(serviceTypeRow, coverageTier = 1) {
  const tiers = Array.isArray(serviceTypeRow?.coverage_tiers) ? serviceTypeRow.coverage_tiers : [];
  const tierNum = Number(coverageTier) || 1;
  if (tiers.length > 0) {
    const tierDef =
      tiers.find((t) => Number(t?.tier_number) === tierNum) ||
      tiers.find((t) => Number(t?.tier_number) === 1) ||
      tiers[0];
    return filterProtocolDocuments(tierDef?.protocol_document_urls);
  }
  return filterProtocolDocuments(serviceTypeRow?.protocol_document_urls);
}

export async function fetchServiceTypeProtocolSnapshot(serviceTypeId, coverageTier = 1) {
  const id = String(serviceTypeId || "").trim();
  if (!id) return [];
  const { rows } = await query(
    `select protocol_document_urls, coverage_tiers
       from public.service_type
      where id = $1
      limit 1`,
    [id]
  );
  return resolveProtocolDocumentsFromServiceType(rows[0], coverageTier);
}

export function resolveProtocolDocumentsForSubscription(subscriptionRow, serviceTypeRow) {
  const snapshot = filterProtocolDocuments(subscriptionRow?.protocol_document_urls);
  if (snapshot.length) return snapshot;
  return resolveProtocolDocumentsFromServiceType(
    serviceTypeRow,
    subscriptionRow?.coverage_tier || 1
  );
}

export async function snapshotProtocolDocumentsOnSubscription(subscriptionId, serviceTypeId, coverageTier = 1) {
  const id = String(subscriptionId || "").trim();
  const stId = String(serviceTypeId || "").trim();
  if (!id || !stId) return [];
  const docs = await fetchServiceTypeProtocolSnapshot(stId, coverageTier);
  if (!docs.length) return [];
  await query(
    `update public.md_subscription
        set protocol_document_urls = $2::jsonb,
            updated_at = now()
      where id = $1::uuid`,
    [id, JSON.stringify(docs)]
  );
  return docs;
}
