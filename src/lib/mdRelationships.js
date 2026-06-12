/**
 * MD supervision rows are stored per service_type_id, so one provider can have
 * several active relationships. UI lists should show one row per provider.
 */
export function groupRelationshipsByProvider(relationships, { status } = {}) {
  const groups = new Map();
  const statusFilter = status ? String(status).toLowerCase() : "";

  for (const rel of relationships || []) {
    if (statusFilter && String(rel?.status || "").toLowerCase() !== statusFilter) continue;
    const providerId = String(rel?.provider_id || "").trim();
    if (!providerId) continue;

    if (!groups.has(providerId)) {
      groups.set(providerId, []);
    }
    groups.get(providerId).push(rel);
  }

  return Array.from(groups.values()).map((rels) => {
    const sorted = [...rels].sort((a, b) => {
      const aDate = new Date(a.start_date || a.created_at || 0).getTime();
      const bDate = new Date(b.start_date || b.created_at || 0).getTime();
      return aDate - bDate;
    });
    return {
      ...sorted[0],
      relationships: sorted,
      serviceCount: sorted.length,
    };
  });
}
