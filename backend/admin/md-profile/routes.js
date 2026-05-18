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
            created_at, updated_at
     from public.medical_director_profiles
     where medical_director_id = $1
     limit 1`,
    [medicalDirectorId]
  );
  return rows[0] || null;
}

async function getLicensedStates(medicalDirectorId) {
  const { rows } = await query(
    `select us_state
     from public.medical_director_state_license
     where medical_director_id = $1
     order by us_state`,
    [medicalDirectorId]
  );
  return (rows || []).map((r) => String(r.us_state || "").trim()).filter(Boolean);
}

function profilePayload(row, me, licensedStates) {
  const base = row || {};
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
    licensed_states: licensedStates,
    licensed_states_nationwide: licensedStates.length === 0,
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
    const licensedStates = await getLicensedStates(mid);
    return res.json(profilePayload(row, me, licensedStates));
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

    if (Object.prototype.hasOwnProperty.call(body, "licensed_states")) {
      const raw = body.licensed_states;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: "licensed_states must be an array." });
      }
      const states = [...new Set(raw.map(normalizeUsState).filter(Boolean))].sort();
      await query(`delete from public.medical_director_state_license where medical_director_id = $1`, [mid]);
      if (states.length > 0) {
        await query(
          `insert into public.medical_director_state_license (medical_director_id, us_state)
           select $1, x from unnest($2::text[]) as x`,
          [mid, states]
        );
      }
    }

    const row = await getProfileRow(mid);
    const licensedStates = await getLicensedStates(mid);
    return res.json(profilePayload(row, me, licensedStates));
  } catch (error) {
    return next(error);
  }
});
