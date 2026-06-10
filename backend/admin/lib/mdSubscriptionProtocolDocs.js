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

/** Protocol docs for a membership (merged from included services) or a single service. */
export function resolveProtocolDocumentsFromServiceType(serviceTypeRow, childRows = []) {
  const includedIds = Array.isArray(serviceTypeRow?.included_service_ids)
    ? serviceTypeRow.included_service_ids.filter((x) => typeof x === "string")
    : [];

  if (serviceTypeRow?.is_membership && includedIds.length > 0) {
    const merged = [];
    const seen = new Set();
    for (const child of childRows) {
      for (const doc of filterProtocolDocuments(child?.protocol_document_urls)) {
        const key = `${doc.name}::${doc.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(doc);
      }
    }
    if (merged.length) return merged;
  }

  return filterProtocolDocuments(serviceTypeRow?.protocol_document_urls);
}

export async function fetchServiceTypeProtocolSnapshot(serviceTypeId) {
  const id = String(serviceTypeId || "").trim();
  if (!id) return [];

  const { rows } = await query(
    `select id, is_membership, protocol_document_urls, included_service_ids
       from public.service_type
      where id = $1
      limit 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return [];

  const includedIds = Array.isArray(row.included_service_ids)
    ? row.included_service_ids.filter((x) => typeof x === "string")
    : [];

  let childRows = [];
  if (row.is_membership && includedIds.length > 0) {
    const { rows: children } = await query(
      `select protocol_document_urls
         from public.service_type
        where id = any($1::text[])`,
      [includedIds]
    );
    childRows = children;
  }

  return resolveProtocolDocumentsFromServiceType(row, childRows);
}

/** Signed protocol list only — frozen on md_subscription at MD agreement sign-up. */
export function resolveProtocolDocumentsForSubscription(subscriptionRow) {
  return filterProtocolDocuments(subscriptionRow?.protocol_document_urls);
}

export async function snapshotProtocolDocumentsOnSubscription(subscriptionId, serviceTypeId) {
  const id = String(subscriptionId || "").trim();
  const stId = String(serviceTypeId || "").trim();
  if (!id || !stId) return [];

  const docs = await fetchServiceTypeProtocolSnapshot(stId);
  await query(
    `update public.md_subscription
        set protocol_document_urls = $2::jsonb
      where id = $1::uuid`,
    [id, JSON.stringify(docs)]
  );
  return docs;
}
