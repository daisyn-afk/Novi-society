import { query } from "../db.js";
import {
  APPOINTMENT_QUALIPHY_EXAM_IDS_SQL,
  APPOINTMENT_SERVICE_TYPE_JOINS,
  resolveTreatmentServiceType,
} from "../lib/treatmentServiceType.js";

export function normalizeQualiphyExamIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean);
}

export async function resolveQualiphyExamIdForAppointment({
  serviceTypeId,
  serviceName,
  qualiphyExamIds,
}) {
  const fromJoin = normalizeQualiphyExamIds(qualiphyExamIds);
  if (fromJoin.length > 0) return fromJoin[0];

  const stId = String(serviceTypeId || "").trim();
  const treatmentSvc = await resolveTreatmentServiceType(query, {
    serviceName,
    serviceTypeId: stId,
  });
  if (treatmentSvc) {
    const ids = normalizeQualiphyExamIds(treatmentSvc.qualiphy_exam_ids);
    if (ids.length > 0) return ids[0];
  }

  const service = String(serviceName || "").trim();
  if (service) {
    const { rows } = await query(
      `select qualiphy_exam_ids
         from public.service_type
        where lower(trim(name)) = lower(trim($1))
          and coalesce(is_membership, false) = false
          and requires_gfe = true
        limit 1`,
      [service]
    );
    const ids = normalizeQualiphyExamIds(rows[0]?.qualiphy_exam_ids);
    if (ids.length > 0) return ids[0];
  }

  return null;
}

export async function resolveQualiphyExamIdForAppointmentRecord(appt) {
  if (!appt || typeof appt !== "object") return null;

  const stored = String(appt.qualiphy_exam_id || "").trim();
  if (stored) return stored;

  const fromJoin = normalizeQualiphyExamIds(appt.qualiphy_exam_ids);
  if (fromJoin.length > 0) return fromJoin[0];

  return resolveQualiphyExamIdForAppointment({
    serviceTypeId: appt.service_type_id,
    serviceName: appt.service || appt.service_type_name,
    qualiphyExamIds: null,
  });
}

export async function loadQualiphyExamIdFromAppointmentId(appointmentId) {
  const id = String(appointmentId || "").trim();
  if (!id) return null;

  const { rows } = await query(
    `select a.id,
            a.service,
            a.service_type_id,
            a.qualiphy_exam_id,
            coalesce(
              case when coalesce(st.is_membership, false) = false then st.name else null end,
              st_svc.name
            ) as service_type_name,
            ${APPOINTMENT_QUALIPHY_EXAM_IDS_SQL} as qualiphy_exam_ids
       from public.appointments a
       ${APPOINTMENT_SERVICE_TYPE_JOINS}
      where a.id = $1
      limit 1`,
    [id]
  );

  return resolveQualiphyExamIdForAppointmentRecord(rows[0]);
}

export function gfeValidityLabel({ qualiphyExamId, serviceLabel } = {}) {
  const service = String(serviceLabel || "").trim();
  if (service) return service;
  const examId = String(qualiphyExamId || "").trim();
  if (examId) return `Qualiphy exam ${examId}`;
  return "this service";
}
