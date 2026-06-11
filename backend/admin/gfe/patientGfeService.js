import { query } from "../db.js";
import {
  getConnectGfePlatformFeeCents,
  PAYMENT_TYPE_APPOINTMENT_TREATMENT,
} from "../stripe-connect/config.js";
import { computeTreatmentPaymentBreakdown } from "../stripe-connect/gfePlatformFee.js";
import { isGfeSimulationEnabled } from "../qualiphy/gfeSimulation.js";
import { isQualiphyTestMode } from "../qualiphy/inviteConfig.js";
import {
  APPOINTMENT_QUALIPHY_EXAM_IDS_SQL,
  APPOINTMENT_REQUIRES_GFE_SQL,
  APPOINTMENT_SERVICE_TYPE_JOINS,
} from "../lib/treatmentServiceType.js";
import {
  gfeValidityLabel,
  resolveQualiphyExamIdForAppointment,
  resolveQualiphyExamIdForAppointmentRecord,
} from "./qualiphyExamId.js";

export const GFE_VALIDITY_DAYS = 365;
export const GFE_EXPIRING_SOON_DAYS = 30;

const CATEGORY_LABELS = {
  injectables: "Injectables",
  fillers: "Fillers",
  laser: "Laser",
  skincare: "Skincare",
  body_contouring: "Body Contouring",
  prp: "PRP",
  other: "Other",
};

export function isGfeCategoryValidityEnabled() {
  return String(process.env.GFE_CATEGORY_VALIDITY_ENABLED || "true").trim().toLowerCase() !== "false";
}

export function resolveGfeCategory(category) {
  const cat = String(category || "").trim().toLowerCase();
  return cat || null;
}

export function gfeCategoryLabel(category) {
  const key = resolveGfeCategory(category);
  if (!key) return "this treatment category";
  return CATEGORY_LABELS[key] || key.replace(/_/g, " ");
}

function addValidityDays(isoDate) {
  const base = new Date(isoDate);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + GFE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

function isWithinValidity(completedAt) {
  const expires = addValidityDays(completedAt);
  return Boolean(expires && expires.getTime() > Date.now());
}

function mapValidationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    patient_id: row.patient_id,
    gfe_category: row.gfe_category,
    qualiphy_exam_id: row.qualiphy_exam_id,
    status: row.status,
    completed_at: row.completed_at,
    expires_at: row.expires_at,
    source_appointment_id: row.source_appointment_id,
    qualiphy_patient_exam_id: row.qualiphy_patient_exam_id,
    platform_fee_collected_at: row.platform_fee_collected_at,
    fee_appointment_id: row.fee_appointment_id,
  };
}

export async function loadServiceTypeCategory(serviceTypeId) {
  const id = String(serviceTypeId || "").trim();
  if (!id) return null;
  const { rows } = await query(
    `select category from public.service_type where id = $1 limit 1`,
    [id]
  );
  return resolveGfeCategory(rows[0]?.category);
}

async function getValidPatientGfeByExamId(patientId, qualiphyExamId) {
  const pid = String(patientId || "").trim();
  const examId = String(qualiphyExamId || "").trim();
  if (!pid || !examId) return null;

  const { rows } = await query(
    `select *
       from public.patient_gfe_validations
      where patient_id = $1
        and qualiphy_exam_id = $2
        and status = 'approved'
        and expires_at > now()
      order by completed_at desc
      limit 1`,
    [pid, examId]
  );
  return mapValidationRow(rows[0]);
}

async function getLatestPatientGfeByExamId(patientId, qualiphyExamId) {
  const pid = String(patientId || "").trim();
  const examId = String(qualiphyExamId || "").trim();
  if (!pid || !examId) return null;

  const { rows } = await query(
    `select *
       from public.patient_gfe_validations
      where patient_id = $1
        and qualiphy_exam_id = $2
      order by completed_at desc
      limit 1`,
    [pid, examId]
  );
  return mapValidationRow(rows[0]);
}

/** Legacy fallback when exam id is unavailable on older rows. */
async function getValidPatientGfeByCategory(patientId, gfeCategory) {
  const pid = String(patientId || "").trim();
  const cat = resolveGfeCategory(gfeCategory);
  if (!pid || !cat) return null;

  const { rows } = await query(
    `select *
       from public.patient_gfe_validations
      where patient_id = $1
        and gfe_category = $2
        and qualiphy_exam_id is null
        and status = 'approved'
        and expires_at > now()
      order by completed_at desc
      limit 1`,
    [pid, cat]
  );
  return mapValidationRow(rows[0]);
}

async function getLatestPatientGfeByCategory(patientId, gfeCategory) {
  const pid = String(patientId || "").trim();
  const cat = resolveGfeCategory(gfeCategory);
  if (!pid || !cat) return null;

  const { rows } = await query(
    `select *
       from public.patient_gfe_validations
      where patient_id = $1
        and gfe_category = $2
        and qualiphy_exam_id is null
      order by completed_at desc
      limit 1`,
    [pid, cat]
  );
  return mapValidationRow(rows[0]);
}

async function getValidPatientGfe(patientId, { qualiphyExamId, gfeCategory } = {}) {
  const byExam = await getValidPatientGfeByExamId(patientId, qualiphyExamId);
  if (byExam) return byExam;
  if (!qualiphyExamId) {
    return getValidPatientGfeByCategory(patientId, gfeCategory);
  }
  return null;
}

async function getLatestPatientGfe(patientId, { qualiphyExamId, gfeCategory } = {}) {
  const byExam = await getLatestPatientGfeByExamId(patientId, qualiphyExamId);
  if (byExam) return byExam;
  if (!qualiphyExamId) {
    return getLatestPatientGfeByCategory(patientId, gfeCategory);
  }
  return null;
}

export async function upsertPatientGfeValidation({
  patientId,
  gfeCategory,
  qualiphyExamId,
  status,
  completedAt,
  sourceAppointmentId,
  qualiphyPatientExamId,
}) {
  const pid = String(patientId || "").trim();
  const examId = String(qualiphyExamId || "").trim();
  const cat = resolveGfeCategory(gfeCategory);
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!pid || !normalizedStatus) return null;
  if (!examId && !cat) return null;

  const completed = completedAt ? new Date(completedAt) : new Date();
  if (Number.isNaN(completed.getTime())) return null;
  const expires = addValidityDays(completed);
  if (!expires) return null;

  const { rows: existingRows } = examId
    ? await query(
        `select id, status, completed_at, expires_at
           from public.patient_gfe_validations
          where patient_id = $1
            and qualiphy_exam_id = $2
          order by completed_at desc
          limit 1`,
        [pid, examId]
      )
    : await query(
        `select id, status, completed_at, expires_at
           from public.patient_gfe_validations
          where patient_id = $1
            and gfe_category = $2
            and qualiphy_exam_id is null
          order by completed_at desc
          limit 1`,
        [pid, cat]
      );
  const existing = existingRows[0];

  if (!existing) {
    const { rows } = await query(
      `insert into public.patient_gfe_validations (
         patient_id,
         gfe_category,
         qualiphy_exam_id,
         status,
         completed_at,
         expires_at,
         source_appointment_id,
         qualiphy_patient_exam_id
       ) values ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8)
       returning *`,
      [
        pid,
        cat || "other",
        examId || null,
        normalizedStatus,
        completed.toISOString(),
        expires.toISOString(),
        sourceAppointmentId || null,
        qualiphyPatientExamId || null,
      ]
    );
    return mapValidationRow(rows[0]);
  }

  const existingCompletedAt = existing.completed_at ? new Date(existing.completed_at).getTime() : 0;
  const resetFee =
    normalizedStatus === "approved" &&
    (String(existing.status || "").toLowerCase() !== "approved" ||
      completed.getTime() > existingCompletedAt);
  const { rows } = await query(
    `update public.patient_gfe_validations
        set status = $2,
            gfe_category = coalesce($3, gfe_category),
            qualiphy_exam_id = coalesce($4, qualiphy_exam_id),
            completed_at = $5::timestamptz,
            expires_at = $6::timestamptz,
            source_appointment_id = coalesce($7, source_appointment_id),
            qualiphy_patient_exam_id = coalesce($8, qualiphy_patient_exam_id),
            platform_fee_collected_at = case when $9 then null else platform_fee_collected_at end,
            fee_appointment_id = case when $9 then null else fee_appointment_id end,
            updated_at = now()
      where id = $1
      returning *`,
    [
      existing.id,
      normalizedStatus,
      cat || null,
      examId || null,
      completed.toISOString(),
      expires.toISOString(),
      sourceAppointmentId || null,
      qualiphyPatientExamId || null,
      resetFee,
    ]
  );
  return mapValidationRow(rows[0]);
}

function appointmentLevelGfeValid(appt, qualiphyExamId) {
  if (String(appt?.gfe_status || "").toLowerCase() !== "approved") return false;
  if (!appt?.gfe_completed_at) return false;
  if (!isWithinValidity(appt.gfe_completed_at)) return false;

  const requiredExamId = String(qualiphyExamId || "").trim();
  const storedExamId = String(appt?.qualiphy_exam_id || "").trim();
  if (requiredExamId && storedExamId && requiredExamId !== storedExamId) return false;

  return true;
}

export function buildGfeContextFromParts({
  requiresGfe,
  gfeCategory,
  qualiphyExamId,
  serviceLabel,
  validRecord,
  latestRecord,
  appointmentLevelValid,
  appointmentGfeCompletedAt,
}) {
  const category = resolveGfeCategory(gfeCategory);
  const examId = String(qualiphyExamId || "").trim() || null;
  const validityLabel = gfeValidityLabel({ qualiphyExamId: examId, serviceLabel });
  const requires = requiresGfe === true;

  if (!isGfeCategoryValidityEnabled()) {
    const legacySatisfied = !requires || appointmentLevelValid;
    return {
      gfe_category: category,
      qualiphy_exam_id: examId,
      gfe_category_label: validityLabel,
      gfe_validity_label: validityLabel,
      gfe_prerequisite_satisfied: legacySatisfied,
      gfe_valid_until: null,
      gfe_expired: false,
      gfe_expiring_soon: false,
      gfe_needs_new_exam: requires && !legacySatisfied,
      gfe_fee_applies: requires,
      gfe_skip_send: false,
    };
  }

  if (!requires) {
    return {
      gfe_category: category,
      qualiphy_exam_id: examId,
      gfe_category_label: validityLabel,
      gfe_validity_label: validityLabel,
      gfe_prerequisite_satisfied: true,
      gfe_valid_until: null,
      gfe_expired: false,
      gfe_expiring_soon: false,
      gfe_needs_new_exam: false,
      gfe_fee_applies: false,
      gfe_skip_send: false,
    };
  }

  const prerequisiteSatisfied = Boolean(validRecord) || appointmentLevelValid;
  const validUntil =
    validRecord?.expires_at ||
    (appointmentLevelValid && appointmentGfeCompletedAt
      ? addValidityDays(appointmentGfeCompletedAt)?.toISOString()
      : null);
  const expired =
    requires &&
    !prerequisiteSatisfied &&
    Boolean(latestRecord) &&
    new Date(latestRecord.expires_at).getTime() <= Date.now();

  const expiringSoon =
    prerequisiteSatisfied &&
    validRecord?.expires_at &&
    new Date(validRecord.expires_at).getTime() - Date.now() <= GFE_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;

  const feeCollected = Boolean(validRecord?.platform_fee_collected_at);
  const chargeGfeFee = requires && prerequisiteSatisfied && !feeCollected;

  return {
    gfe_category: category,
    qualiphy_exam_id: examId,
    gfe_category_label: validityLabel,
    gfe_validity_label: validityLabel,
    gfe_prerequisite_satisfied: prerequisiteSatisfied,
    gfe_valid_until: validUntil,
    gfe_expired: expired,
    gfe_expiring_soon: Boolean(expiringSoon),
    gfe_needs_new_exam: requires && !prerequisiteSatisfied,
    gfe_fee_applies: chargeGfeFee,
    gfe_skip_send: prerequisiteSatisfied,
  };
}

export async function resolveAppointmentGfeContext(appt) {
  const requiresGfe = appt?.requires_gfe === true;
  const gfeCategory =
    resolveGfeCategory(appt?.service_type_category) ||
    (await loadServiceTypeCategory(appt?.service_type_id));
  const qualiphyExamId = await resolveQualiphyExamIdForAppointmentRecord(appt);
  const patientId = String(appt?.patient_id || "").trim();
  const serviceLabel = String(appt?.service || appt?.service_type_name || "").trim();

  const validRecord =
    patientId && (qualiphyExamId || gfeCategory)
      ? await getValidPatientGfe(patientId, { qualiphyExamId, gfeCategory })
      : null;
  const latestRecord =
    patientId && (qualiphyExamId || gfeCategory) && !validRecord
      ? await getLatestPatientGfe(patientId, { qualiphyExamId, gfeCategory })
      : validRecord;

  return buildGfeContextFromParts({
    requiresGfe,
    gfeCategory,
    qualiphyExamId,
    serviceLabel,
    validRecord,
    latestRecord,
    appointmentLevelValid: appointmentLevelGfeValid(appt, qualiphyExamId),
    appointmentGfeCompletedAt: appt?.gfe_completed_at,
  });
}

export async function loadAppointmentGfeContext(appointmentId) {
  const id = String(appointmentId || "").trim();
  if (!id) return null;

  const { rows } = await query(
    `select a.*,
            ${APPOINTMENT_REQUIRES_GFE_SQL} as requires_gfe,
            coalesce(
              case when coalesce(st.is_membership, false) = false then st.category else null end,
              st_svc.category
            ) as service_type_category,
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
  const appt = rows[0];
  if (!appt) return null;
  const gfe = await resolveAppointmentGfeContext(appt);
  return { appointment: appt, ...gfe };
}

export async function assertGfePrerequisiteForAppointment(appointmentId) {
  const ctx = await loadAppointmentGfeContext(appointmentId);
  if (!ctx || ctx.appointment?.requires_gfe !== true) return;
  if (ctx.gfe_prerequisite_satisfied) return;

  const label = ctx.gfe_validity_label || ctx.gfe_category_label || "this service";
  const deferred = String(ctx.appointment?.gfe_status || "").toLowerCase() === "deferred";
  let message =
    "A Good Faith Exam must be approved before treatment can be logged or completed for this visit.";
  if (deferred) {
    message = `The patient's Good Faith Exam for ${label} was deferred. A new approved exam is required before treatment can proceed.`;
  } else if (ctx.gfe_expired) {
    message = `The patient's Good Faith Exam for ${label} has expired. A new GFE must be approved before treatment can be logged or completed.`;
  } else if (ctx.gfe_needs_new_exam) {
    message = `A Good Faith Exam for ${label} must be approved before treatment can be logged or completed for this visit.`;
  }

  const err = new Error(message);
  err.statusCode = 409;
  throw err;
}

export function computeAppointmentPaymentBreakdown(appt, gfeContext, treatmentAmount) {
  const amount = Number(treatmentAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      platformFeeAmount: 0,
      totalChargeAmount: null,
      feeApplied: false,
    };
  }

  const chargeGfeFee = gfeContext?.gfe_fee_applies === true;
  return computeTreatmentPaymentBreakdown({
    treatmentAmount: amount,
    chargeGfeFee,
    paymentType: PAYMENT_TYPE_APPOINTMENT_TREATMENT,
  });
}

export async function enrichAppointmentGfeFields(appointment) {
  if (!appointment || typeof appointment !== "object") return appointment;

  const gfeContext = await resolveAppointmentGfeContext(appointment);
  const treatmentAmount = Number(appointment.treatment_amount);
  const paymentBreakdown = computeAppointmentPaymentBreakdown(
    appointment,
    gfeContext,
    treatmentAmount
  );

  return {
    ...appointment,
    ...gfeContext,
    qualiphy_test_mode: isQualiphyTestMode(),
    gfe_simulation_enabled: isGfeSimulationEnabled(),
    platform_fee_amount: paymentBreakdown.platformFeeAmount ?? 0,
    treatment_charge_total:
      paymentBreakdown.totalChargeAmount ??
      (Number.isFinite(treatmentAmount) && treatmentAmount > 0 ? treatmentAmount : null),
  };
}

export async function enrichAppointmentsGfeFields(appointments) {
  const rows = Array.isArray(appointments) ? appointments : [];
  if (!rows.length) return rows;

  const pairMap = new Map();
  for (const appt of rows) {
    if (appt?.requires_gfe !== true) continue;
    const patientId = String(appt.patient_id || "").trim();
    if (!patientId) continue;
    const qualiphyExamId = await resolveQualiphyExamIdForAppointmentRecord(appt);
    const category =
      resolveGfeCategory(appt.service_type_category) ||
      resolveGfeCategory(appt.gfe_category);
    const key = qualiphyExamId
      ? `${patientId}::exam::${qualiphyExamId}`
      : category
        ? `${patientId}::cat::${category}`
        : null;
    if (!key) continue;
    pairMap.set(key, { patientId, qualiphyExamId, category });
  }

  const validByKey = new Map();
  const latestByKey = new Map();

  if (pairMap.size > 0) {
    const patientIds = [...new Set([...pairMap.values()].map((p) => p.patientId))];
    const examIds = [...new Set([...pairMap.values()].map((p) => p.qualiphyExamId).filter(Boolean))];
    const categories = [
      ...new Set([...pairMap.values()].filter((p) => !p.qualiphyExamId).map((p) => p.category).filter(Boolean)),
    ];

    if (examIds.length > 0) {
      const { rows: validRows } = await query(
        `select distinct on (patient_id, qualiphy_exam_id) *
           from public.patient_gfe_validations
          where patient_id = any($1::text[])
            and qualiphy_exam_id = any($2::text[])
            and status = 'approved'
            and expires_at > now()
          order by patient_id, qualiphy_exam_id, completed_at desc`,
        [patientIds, examIds]
      );
      for (const row of validRows || []) {
        validByKey.set(`${row.patient_id}::exam::${row.qualiphy_exam_id}`, mapValidationRow(row));
      }

      const { rows: latestRows } = await query(
        `select distinct on (patient_id, qualiphy_exam_id) *
           from public.patient_gfe_validations
          where patient_id = any($1::text[])
            and qualiphy_exam_id = any($2::text[])
          order by patient_id, qualiphy_exam_id, completed_at desc`,
        [patientIds, examIds]
      );
      for (const row of latestRows || []) {
        latestByKey.set(`${row.patient_id}::exam::${row.qualiphy_exam_id}`, mapValidationRow(row));
      }
    }

    if (categories.length > 0) {
      const { rows: validRows } = await query(
        `select distinct on (patient_id, gfe_category) *
           from public.patient_gfe_validations
          where patient_id = any($1::text[])
            and gfe_category = any($2::text[])
            and qualiphy_exam_id is null
            and status = 'approved'
            and expires_at > now()
          order by patient_id, gfe_category, completed_at desc`,
        [patientIds, categories]
      );
      for (const row of validRows || []) {
        validByKey.set(`${row.patient_id}::cat::${row.gfe_category}`, mapValidationRow(row));
      }

      const { rows: latestRows } = await query(
        `select distinct on (patient_id, gfe_category) *
           from public.patient_gfe_validations
          where patient_id = any($1::text[])
            and gfe_category = any($2::text[])
            and qualiphy_exam_id is null
          order by patient_id, gfe_category, completed_at desc`,
        [patientIds, categories]
      );
      for (const row of latestRows || []) {
        latestByKey.set(`${row.patient_id}::cat::${row.gfe_category}`, mapValidationRow(row));
      }
    }
  }

  return Promise.all(
    rows.map(async (appt) => {
      if (appt?.requires_gfe !== true) {
        const treatmentAmount = Number(appt.treatment_amount);
        return {
          ...appt,
          gfe_category: null,
          qualiphy_exam_id: null,
          gfe_prerequisite_satisfied: true,
          gfe_valid_until: null,
          gfe_expired: false,
          gfe_expiring_soon: false,
          gfe_needs_new_exam: false,
          gfe_fee_applies: false,
          gfe_skip_send: false,
          platform_fee_amount: 0,
          treatment_charge_total:
            Number.isFinite(treatmentAmount) && treatmentAmount > 0 ? treatmentAmount : null,
        };
      }

      const category =
        resolveGfeCategory(appt.service_type_category) ||
        (await loadServiceTypeCategory(appt.service_type_id));
      const qualiphyExamId = await resolveQualiphyExamIdForAppointmentRecord(appt);
      const key = qualiphyExamId
        ? `${String(appt.patient_id || "").trim()}::exam::${qualiphyExamId}`
        : `${String(appt.patient_id || "").trim()}::cat::${category || ""}`;
      const gfeContext = buildGfeContextFromParts({
        requiresGfe: true,
        gfeCategory: category,
        qualiphyExamId,
        serviceLabel: appt.service || appt.service_type_name,
        validRecord: validByKey.get(key) || null,
        latestRecord: latestByKey.get(key) || null,
        appointmentLevelValid: appointmentLevelGfeValid(appt, qualiphyExamId),
        appointmentGfeCompletedAt: appt.gfe_completed_at,
      });

      const paymentBreakdown = computeAppointmentPaymentBreakdown(
        appt,
        gfeContext,
        appt.treatment_amount
      );

      return {
        ...appt,
        ...gfeContext,
        platform_fee_amount: paymentBreakdown.platformFeeAmount ?? 0,
        treatment_charge_total:
          paymentBreakdown.totalChargeAmount ??
          (Number.isFinite(Number(appt.treatment_amount)) && Number(appt.treatment_amount) > 0
            ? Number(appt.treatment_amount)
            : null),
      };
    })
  );
}

export async function markPlatformFeeCollected({ patientId, qualiphyExamId, gfeCategory, appointmentId }) {
  const pid = String(patientId || "").trim();
  const examId = String(qualiphyExamId || "").trim();
  const cat = resolveGfeCategory(gfeCategory);
  const apptId = String(appointmentId || "").trim();
  if (!pid) return;

  if (examId) {
    await query(
      `update public.patient_gfe_validations
          set platform_fee_collected_at = coalesce(platform_fee_collected_at, now()),
              fee_appointment_id = coalesce(fee_appointment_id, $3),
              updated_at = now()
        where patient_id = $1
          and qualiphy_exam_id = $2
          and status = 'approved'
          and expires_at > now()`,
      [pid, examId, apptId || null]
    );
    return;
  }

  if (!cat) return;
  await query(
    `update public.patient_gfe_validations
        set platform_fee_collected_at = coalesce(platform_fee_collected_at, now()),
            fee_appointment_id = coalesce(fee_appointment_id, $3),
            updated_at = now()
      where patient_id = $1
        and gfe_category = $2
        and qualiphy_exam_id is null
        and status = 'approved'
        and expires_at > now()`,
    [pid, cat, apptId || null]
  );
}

export async function recordPatientGfeFromAppointment({
  appointmentId,
  patientId,
  gfeCategory,
  qualiphyExamId,
  status,
  completedAt,
  qualiphyPatientExamId,
}) {
  if (!isGfeCategoryValidityEnabled()) return null;
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (normalizedStatus !== "approved") return null;

  let resolvedExamId = String(qualiphyExamId || "").trim();
  let resolvedCategory = resolveGfeCategory(gfeCategory);

  if (appointmentId) {
    if (!resolvedExamId) {
      resolvedExamId = (await loadQualiphyExamIdFromAppointmentId(appointmentId)) || "";
    }
    if (!resolvedCategory) {
      resolvedCategory = await loadServiceTypeCategoryFromAppointment(appointmentId);
    }
  }

  if (!resolvedExamId && !resolvedCategory) return null;

  return upsertPatientGfeValidation({
    patientId,
    gfeCategory: resolvedCategory,
    qualiphyExamId: resolvedExamId || null,
    status: normalizedStatus,
    completedAt,
    sourceAppointmentId: appointmentId,
    qualiphyPatientExamId,
  });
}

async function loadQualiphyExamIdFromAppointmentId(appointmentId) {
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

async function loadServiceTypeCategoryFromAppointment(appointmentId) {
  const id = String(appointmentId || "").trim();
  if (!id) return null;
  const { rows } = await query(
    `select coalesce(st.category, st_by_name.category) as category
       from public.appointments a
       left join public.service_type st on st.id::text = a.service_type_id::text
       left join public.service_type st_by_name on a.service_type_id is null
         and lower(trim(coalesce(st_by_name.name, ''))) = lower(trim(coalesce(a.service, '')))
      where a.id = $1
      limit 1`,
    [id]
  );
  return resolveGfeCategory(rows[0]?.category);
}

export { getConnectGfePlatformFeeCents, resolveQualiphyExamIdForAppointment };
