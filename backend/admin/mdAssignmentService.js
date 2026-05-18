import { pool, query } from "./db.js";
import { notifyMdOfAutoAssignment } from "./certificationNotifications.js";
import { listEligibleMedicalDirectorsForService } from "./mdEligibleDirectors.js";

function supervisionNote(serviceTypeName, serviceTypeId) {
  const label = String(serviceTypeName || serviceTypeId || "service").trim();
  return [
    "Auto-assigned by NOVI (assignment engine).",
    `Coverage service: ${label}.`,
    "Sequential round-robin among MDs who offer this service; provider does not choose a medical director.",
    "State-based filtering can be enabled with MD_ASSIGNMENT_STATE_MATCHING=1 once MD state licenses are populated.",
  ].join(" ");
}

/**
 * @param {import('pg').PoolClient|null} client
 * @param {string} providerId
 * @param {string} serviceTypeId
 */
async function findActiveRelationshipForReuse(client, providerId, serviceTypeId) {
  const pid = String(providerId || "").trim();
  const st = String(serviceTypeId || "").trim();
  if (!pid || !st) return null;
  const { rows } = await (client ? client.query.bind(client) : query)(
    `select id, medical_director_id, medical_director_email, medical_director_name, service_type_id, status
     from public.medical_director_relationship
     where provider_id = $1
       and lower(coalesce(status, '')) = 'active'
       and coalesce(service_type_id, '') = $2
     order by created_at desc nulls last
     limit 1`,
    [pid, st]
  );
  const row = rows?.[0];
  if (!row) return null;
  return {
    id: String(row.id),
    medical_director_id: String(row.medical_director_id || ""),
    medical_director_email: String(row.medical_director_email || ""),
    medical_director_name: String(row.medical_director_name || ""),
  };
}

/**
 * @param {import('pg').PoolClient|null} client
 */
async function isMdStillEligibleForService(client, mdId, serviceTypeId, providerState) {
  const list = await listEligibleMedicalDirectorsForService(serviceTypeId, { providerState }, client);
  return list.some((m) => String(m.id) === String(mdId));
}

/**
 * Round-robin pick + pending relationship + coverage request + MD notification.
 * Runs in a single DB transaction (pointer + inserts).
 *
 * @param {object} p
 * @param {string} p.providerId auth user id
 * @param {string} [p.providerEmail]
 * @param {string} [p.providerName]
 * @param {string} [p.providerState] two-letter state when available
 * @param {string} p.serviceTypeId
 * @param {string} [p.serviceTypeName]
 * @returns {Promise<{ ok: boolean, reused?: boolean, error?: string, medical_director_id?: string, relationship_id?: string, request_id?: string, assignment_index?: number, eligible_count?: number }>}
 */
export async function submitMdBoardCoverageAssignment(p) {
  const providerId = String(p.providerId || "").trim();
  const serviceTypeId = String(p.serviceTypeId || "").trim();
  const serviceTypeName = String(p.serviceTypeName || "").trim();
  const providerState = p.providerState || null;
  if (!providerId || !serviceTypeId) {
    return { ok: false, error: "provider_id and service_type_id are required." };
  }

  const { rows: pendingDup } = await query(
    `select id, medical_director_id
     from public.medical_director_relationship
     where provider_id = $1
       and coalesce(service_type_id, '') = $2
       and lower(coalesce(status, '')) = 'pending'
     limit 1`,
    [providerId, serviceTypeId]
  );
  if (pendingDup?.[0]) {
    return {
      ok: true,
      pending_existing: true,
      relationship_id: String(pendingDup[0].id),
      medical_director_id: String(pendingDup[0].medical_director_id || ""),
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingReuse = await findActiveRelationshipForReuse(client, providerId, serviceTypeId);
    if (existingReuse) {
      const still = await isMdStillEligibleForService(
        client,
        existingReuse.medical_director_id,
        serviceTypeId,
        providerState
      );
      if (still) {
        await client.query("COMMIT");
        return {
          ok: true,
          reused: true,
          medical_director_id: existingReuse.medical_director_id,
          medical_director_email: existingReuse.medical_director_email,
          medical_director_name: existingReuse.medical_director_name,
          relationship_id: existingReuse.id,
        };
      }
    }

    const eligible = await listEligibleMedicalDirectorsForService(serviceTypeId, { providerState }, client);
    const n = eligible.length;
    if (n === 0) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error:
          "No medical director offers this service yet. Each Board MD must list supported services under Services I cover (or set MD_ASSIGNMENT_POOL_FALLBACK=1 in non-production).",
      };
    }

    const { rows: seqRows } = await client.query(
      `insert into public.md_assignment_round_robin (service_type_id, seq)
       values ($1, 1)
       on conflict (service_type_id) do update
         set seq = public.md_assignment_round_robin.seq + 1
       returning seq`,
      [serviceTypeId]
    );
    const seq = Number(seqRows[0]?.seq ?? 1);
    const idx = (seq - 1) % n;
    const chosen = eligible[idx];

    const note = supervisionNote(serviceTypeName, serviceTypeId);
    const { rows: relRows } = await client.query(
      `insert into public.medical_director_relationship (
        provider_id, provider_email, provider_name,
        medical_director_id, medical_director_email, medical_director_name,
        status, start_date, supervision_notes, service_type_id
      ) values ($1, $2, $3, $4, $5, $6, $7, null, $8, $9)
      returning id`,
      [
        providerId,
        p.providerEmail || null,
        p.providerName || null,
        chosen.id,
        chosen.email || null,
        chosen.full_name || chosen.email || null,
        "pending",
        note,
        serviceTypeId,
      ]
    );
    const relationshipId = relRows[0]?.id;

    const { rows: reqRows } = await client.query(
      `insert into public.md_coverage_request (
        provider_id, service_type_id, medical_director_relationship_id,
        assigned_medical_director_id, assigned_medical_director_email, assigned_medical_director_name,
        status, assignment_reason, round_robin_seq, assignment_index, eligible_count, provider_state
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning id`,
      [
        providerId,
        serviceTypeId,
        relationshipId,
        chosen.id,
        chosen.email || null,
        chosen.full_name || chosen.email || null,
        "pending_md_approval",
        "service_match_round_robin",
        seq,
        idx,
        n,
        normalizeProviderStateForDb(providerState),
      ]
    );

    await client.query("COMMIT");

    await notifyMdOfAutoAssignment({
      medicalDirectorId: chosen.id,
      medicalDirectorEmail: chosen.email,
      medicalDirectorName: chosen.full_name || chosen.email,
      providerName: p.providerName,
      providerEmail: p.providerEmail,
      serviceTypeName: serviceTypeName || serviceTypeId,
    });

    return {
      ok: true,
      reused: false,
      medical_director_id: chosen.id,
      medical_director_email: chosen.email || "",
      medical_director_name: chosen.full_name || chosen.email || "",
      relationship_id: String(relationshipId || ""),
      request_id: String(reqRows[0]?.id || ""),
      assignment_index: idx,
      eligible_count: n,
      service_type_id: serviceTypeId,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}

function normalizeProviderStateForDb(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s || s.length !== 2) return null;
  return /^[A-Z]{2}$/.test(s) ? s : null;
}
