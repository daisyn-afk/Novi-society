import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const mdProfileRouter = Router();

const PROFILE_COLUMNS = [
  "phone",
  "city",
  "state",
  "bio",
  "specialty",
  "avatar_url",
  "npi",
  "medical_license_number",
  "license_state",
  "board_certifications",
];

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function isMdRole(role) {
  return String(role || "").trim().toLowerCase() === "medical_director";
}

function normalizeUsState(value) {
  const s = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : "";
}

async function getProfileRow(medicalDirectorId) {
  const { rows } = await query(
    `select medical_director_id, phone, city, state, bio, specialty, avatar_url,
            npi, medical_license_number, license_state, board_certifications,
            coalesce(supervision_nationwide, false) as supervision_nationwide,
            created_at, updated_at
     from public.medical_director_profiles
     where medical_director_id = $1
     limit 1`,
    [medicalDirectorId]
  );
  return rows[0] || null;
}

async function replaceStateLicenses(medicalDirectorId, entries) {
  await query(`delete from public.medical_director_state_license where medical_director_id = $1`, [
    medicalDirectorId,
  ]);
  if (!entries.length) return;
  const states = entries.map((e) => e.us_state);
  const licenseNumbers = entries.map((e) => e.license_number);
  const expirationDates = entries.map((e) => e.expiration_date);
  const sortOrders = entries.map((e) => Number(e.sort_order) || 0);
  await query(
    `insert into public.medical_director_state_license
       (medical_director_id, us_state, license_number, expiration_date, sort_order)
     select $1, x.us_state, nullif(x.license_number, ''), nullif(x.expiration_date, ''), x.sort_order
     from unnest($2::text[], $3::text[], $4::text[], $5::int[]) as x(us_state, license_number, expiration_date, sort_order)`,
    [medicalDirectorId, states, licenseNumbers, expirationDates, sortOrders]
  );
}

function normalizeStoredText(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  return raw || null;
}

function normalizeStateLicenseEntry(raw, index) {
  const us_state = normalizeUsState(raw?.us_state);
  if (!us_state) return null;
  return {
    us_state,
    license_number: normalizeStoredText(raw?.license_number),
    expiration_date: normalizeStoredText(raw?.expiration_date),
    sort_order: Number.isFinite(Number(raw?.sort_order)) ? Number(raw.sort_order) : index,
  };
}

async function getStateLicenses(medicalDirectorId) {
  const { rows } = await query(
    `select us_state, license_number, expiration_date, sort_order
     from public.medical_director_state_license
     where medical_director_id = $1
     order by sort_order, us_state`,
    [medicalDirectorId]
  );
  return (rows || [])
    .map((r) => ({
      us_state: String(r.us_state || "").trim().toUpperCase(),
      license_number: r.license_number ? String(r.license_number).trim() : null,
      expiration_date: r.expiration_date ? String(r.expiration_date).trim() : null,
    }))
    .filter((r) => r.us_state);
}

function licensedStatesFromEntries(stateLicenses) {
  return stateLicenses
    .filter((row) => {
      const license = String(row.license_number || "").trim();
      return license && license !== "-";
    })
    .map((row) => row.us_state);
}

function profilePayload(row, me, stateLicenses) {
  const base = row || {};
  const supervisionNationwide = base.supervision_nationwide === true;
  const licensedStates = licensedStatesFromEntries(stateLicenses);
  return {
    medical_director_id: String(me.id || ""),
    email: me.email || null,
    full_name: me.full_name || null,
    first_name: me.first_name || null,
    last_name: me.last_name || null,
    phone: base.phone || null,
    city: base.city || null,
    state: base.state || null,
    bio: base.bio || null,
    specialty: base.specialty || null,
    avatar_url: base.avatar_url || null,
    npi: base.npi || null,
    medical_license_number: base.medical_license_number || null,
    license_state: base.license_state || null,
    board_certifications: base.board_certifications || null,
    state_licenses: stateLicenses,
    supervision_nationwide: supervisionNationwide,
    licensed_states: supervisionNationwide ? [] : licensedStates,
    licensed_states_nationwide: supervisionNationwide,
  };
}

mdProfileRouter.get("/me", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (!isMdRole(me.role)) {
      return res.status(403).json({ error: "Medical director access only." });
    }
    const mid = String(me.id || "").trim();
    const row = await getProfileRow(mid);
    const stateLicenses = await getStateLicenses(mid);
    return res.json(profilePayload(row, me, stateLicenses));
  } catch (error) {
    return next(error);
  }
});

mdProfileRouter.patch("/me", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (!isMdRole(me.role)) {
      return res.status(403).json({ error: "Medical director access only." });
    }
    const mid = String(me.id || "").trim();
    const body = req.body || {};

    const updates = {};
    for (const col of PROFILE_COLUMNS) {
      if (Object.prototype.hasOwnProperty.call(body, col)) {
        const val = body[col];
        updates[col] = val == null || val === "" ? null : String(val).trim() || null;
      }
    }

    const hasProfileFields = Object.keys(updates).length > 0;
    if (hasProfileFields) {
      const cols = ["medical_director_id", ...Object.keys(updates)];
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const values = [mid, ...Object.values(updates)];
      const setClause = Object.keys(updates)
        .map((col) => `${col} = excluded.${col}`)
        .join(", ");

      await query(
        `insert into public.medical_director_profiles (${cols.join(", ")})
         values (${placeholders})
         on conflict (medical_director_id)
         do update set ${setClause}, updated_at = now()`,
        values
      );
    }

    if (Object.prototype.hasOwnProperty.call(body, "supervision_nationwide")) {
      const nationwide = body.supervision_nationwide === true;
      await query(
        `insert into public.medical_director_profiles (medical_director_id, supervision_nationwide)
         values ($1, $2)
         on conflict (medical_director_id)
         do update set supervision_nationwide = excluded.supervision_nationwide, updated_at = now()`,
        [mid, nationwide]
      );
    }

    if (Object.prototype.hasOwnProperty.call(body, "state_licenses")) {
      const raw = body.state_licenses;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: "state_licenses must be an array." });
      }
      const entries = raw.map((row, index) => normalizeStateLicenseEntry(row, index)).filter(Boolean);
      await replaceStateLicenses(mid, entries);
    } else if (Object.prototype.hasOwnProperty.call(body, "licensed_states")) {
      const raw = body.licensed_states;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: "licensed_states must be an array." });
      }
      const states = [...new Set(raw.map(normalizeUsState).filter(Boolean))].sort();
      const entries = states.map((us_state) => ({
        us_state,
        license_number: us_state,
        expiration_date: null,
      }));
      await replaceStateLicenses(mid, entries);
    }

    const row = await getProfileRow(mid);
    const stateLicenses = await getStateLicenses(mid);
    return res.json(profilePayload(row, me, stateLicenses));
  } catch (error) {
    return next(error);
  }
});
