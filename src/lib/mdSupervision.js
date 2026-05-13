export const NOVI_BOARD_MD = {
  id: "699c9815c81b2b13b2643a49",
  name: "ashlan.brookes.lane",
  email: "ashlan.brookes.lane@gmail.com",
};

export async function ensurePendingBoardMdSupervision({
  base44,
  provider,
  serviceTypeId,
  serviceTypeName,
}) {
  if (!provider?.id) return null;

  const existing = await base44.entities.MedicalDirectorRelationship.filter({
    provider_id: provider.id,
    medical_director_id: NOVI_BOARD_MD.id,
  });
  const active = existing.find((rel) => rel.status === "active");
  if (active) return active;

  const pending = existing.find((rel) => rel.status === "pending");
  if (pending) {
    if (serviceTypeId && pending.service_type_id && pending.service_type_id !== serviceTypeId) {
      await base44.entities.MedicalDirectorRelationship.update(pending.id, {
        service_type_id: serviceTypeId,
        service_type_name: serviceTypeName || pending.service_type_name || null,
        supervision_notes: `Requested MD supervision for ${serviceTypeName || "clinical services"}.`,
      });
    }
    return pending;
  }

  const relationship = await base44.entities.MedicalDirectorRelationship.create({
    provider_id: provider.id,
    provider_email: provider.email,
    provider_name: provider.full_name,
    medical_director_id: NOVI_BOARD_MD.id,
    medical_director_email: NOVI_BOARD_MD.email,
    medical_director_name: NOVI_BOARD_MD.name,
    status: "pending",
    service_type_id: serviceTypeId || null,
    service_type_name: serviceTypeName || null,
    supervision_notes: `Requested MD supervision for ${serviceTypeName || "clinical services"}.`,
  });

  const providerLabel = provider.full_name || provider.email || "A provider";
  const serviceLabel = serviceTypeName || "clinical services";

  await base44.entities.Notification.create({
    user_id: NOVI_BOARD_MD.id,
    user_email: NOVI_BOARD_MD.email,
    type: "md_relationship_pending",
    message: `${providerLabel} requested supervision for ${serviceLabel}.`,
    link_page: "MDProviderRelationships",
  });

  await base44.entities.Notification.create({
    user_id: provider.id,
    user_email: provider.email,
    type: "md_relationship_pending",
    message: `Your MD Board supervision request for ${serviceLabel} is awaiting medical director approval.`,
    link_page: "ProviderCredentialsCoverage?tab=coverage",
  });

  return relationship;
}
