import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  getProviderIdAliases,
  isMedicalDirectorRole,
  mdHasActiveSupervisionOf,
} from "../mdSupervisedAccess.js";
import { resolveSupervisingMdCoverageForProvider } from "../lib/mdStateLicenseContext.js";

export const mdRelationshipsRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

mdRelationshipsRouter.get("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const providerIdFilter = String(req.query.provider_id || "").trim();

    if (hasAdminAccess(me.role)) {
      if (providerIdFilter) {
        const { rows } = await query(
          `select * from public.medical_director_relationship
           where provider_id = $1
           order by created_at desc nulls last
           limit 200`,
          [providerIdFilter]
        );
        return res.json(rows || []);
      }
      const { rows } = await query(
        `select * from public.medical_director_relationship
         order by created_at desc nulls last
         limit 500`
      );
      return res.json(rows || []);
    }

    if (isMedicalDirectorRole(me.role)) {
      const { rows } = await query(
        `select * from public.medical_director_relationship
         where medical_director_id = $1
         order by created_at desc nulls last
         limit 200`,
        [me.id]
      );
      return res.json(rows || []);
    }

    const { rows } = await query(
      `select * from public.medical_director_relationship
       where provider_id = $1
       order by created_at desc nulls last
       limit 200`,
      [me.id]
    );
    return res.json(rows || []);
  } catch (error) {
    return next(error);
  }
});

/** Supervising MD NPI + per-state licenses for the logged-in provider (relevant states only). */
mdRelationshipsRouter.get("/supervising-md-coverage", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const role = String(me?.role || "").trim().toLowerCase();
    if (role !== "provider" && !hasAdminAccess(me.role)) {
      return res.status(403).json({ error: "Provider access only." });
    }

    const providerId = hasAdminAccess(me.role)
      ? String(req.query.provider_id || me.id || "").trim()
      : String(me.id || "").trim();
    if (!providerId) return res.status(400).json({ error: "provider_id is required." });

    const { aliases } = await getProviderIdAliases(providerId);
    const lookupIds = aliases.length ? aliases : [providerId];
    const { rows: userRows } = await query(
      `select id::text as app_user_id, auth_user_id::text as auth_user_id
       from public.users
       where auth_user_id::text = any($1::text[])
          or id::text = any($1::text[])
       limit 1`,
      [lookupIds]
    );
    const appUserId = String(userRows[0]?.app_user_id || "").trim();
    const { rows: profileRows } = await query(
      `select city, state, address_line1, address_line2, zip
       from public.provider_profiles
       where user_id::text = $1
       limit 1`,
      [appUserId || providerId]
    );
    const profile = profileRows[0] || {};
    const practiceAddress = [
      profile.address_line1,
      profile.address_line2,
      profile.city,
      profile.state,
      profile.zip,
    ]
      .filter((part) => part != null && String(part).trim() !== "")
      .join(" ");

    const { rows: licenseRows } = await query(
      `select license_type, license_number, issuing_state, status
       from public.licenses
       where provider_id::text = any($1::text[])
         and lower(coalesce(status, '')) = 'verified'
       order by created_at desc`,
      [lookupIds]
    );

    const coverage = await resolveSupervisingMdCoverageForProvider({
      providerId,
      profileState: profile.state,
      userState: me.state,
      licenses: licenseRows,
      practiceAddress,
      lookupIds,
    });

    return res.json(coverage);
  } catch (error) {
    return next(error);
  }
});

/** Provider profile + location for an MD's supervised provider (credentials panel). */
mdRelationshipsRouter.get("/supervised-provider", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (!isMedicalDirectorRole(me.role) && !hasAdminAccess(me.role)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const providerId = String(req.query.provider_id || "").trim();
    if (!providerId) {
      return res.status(400).json({ error: "provider_id is required." });
    }
    if (!hasAdminAccess(me.role)) {
      const allowed = await mdHasActiveSupervisionOf(me, providerId);
      if (!allowed) return res.status(403).json({ error: "Forbidden." });
    }
    const { aliases, email } = await getProviderIdAliases(providerId);
    const { rows: userRows } = await query(
      `select id::text as app_user_id,
              auth_user_id::text as auth_user_id,
              email,
              full_name,
              first_name,
              last_name
         from public.users
        where auth_user_id::text = any($1::text[])
           or id::text = any($1::text[])
        limit 1`,
      [aliases.length ? aliases : [providerId]]
    );
    const user = userRows[0] || {};
    const appUserId = String(user.app_user_id || "").trim();
    const { rows: profileRows } = await query(
      `select city, state, zip, address_line1, address_line2
         from public.provider_profiles
        where user_id::text = $1
        limit 1`,
      [appUserId || providerId]
    );
    const profile = profileRows[0] || {};
    const locationParts = [
      profile.address_line1,
      profile.address_line2,
      profile.city,
      profile.state,
      profile.zip,
    ].filter((p) => p != null && String(p).trim() !== "");
    return res.json({
      provider_id: user.auth_user_id || providerId,
      email: user.email || email || null,
      full_name:
        user.full_name ||
        [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
        null,
      city: profile.city || null,
      state: profile.state || null,
      location_label: locationParts.join(", ") || null,
    });
  } catch (error) {
    return next(error);
  }
});

mdRelationshipsRouter.post("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (!hasAdminAccess(me.role)) {
      return res.status(403).json({
        error: "Board relationships are created by the NOVI assignment engine. Providers cannot POST here.",
      });
    }
    const body = req.body || {};
    const providerId = String(body.provider_id || "").trim() || me.id;
    const mdId = String(body.medical_director_id || "").trim();
    if (!mdId) {
      return res.status(400).json({ error: "medical_director_id is required." });
    }
    const serviceTypeId = String(body.service_type_id || "").trim() || null;
    const { rows } = await query(
      `insert into public.medical_director_relationship (
        provider_id, provider_email, provider_name,
        medical_director_id, medical_director_email, medical_director_name,
        status, start_date, supervision_notes, service_type_id
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning *`,
      [
        providerId,
        body.provider_email || me.email || null,
        body.provider_name || me.full_name || null,
        mdId,
        body.medical_director_email || null,
        body.medical_director_name || null,
        String(body.status || "active").trim() || "active",
        body.start_date || null,
        body.supervision_notes || null,
        serviceTypeId,
      ]
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

async function syncCoverageRequestStatus(relationshipId, relationshipStatus) {
  const rid = String(relationshipId || "").trim();
  if (!rid) return;
  const st = String(relationshipStatus || "").trim().toLowerCase();
  let requestStatus = null;
  if (st === "active") requestStatus = "active";
  else if (st === "rejected") requestStatus = "rejected_by_md";
  else if (st === "terminated" || st === "suspended") requestStatus = "cancelled";
  if (!requestStatus) return;
  await query(
    `update public.md_coverage_request
     set status = $2, updated_at = now()
     where medical_director_relationship_id = $1::uuid`,
    [rid, requestStatus]
  ).catch(() => {});
}

mdRelationshipsRouter.patch("/:id", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id is required." });

    const { rows: existingRows } = await query(
      `select * from public.medical_director_relationship where id = $1::uuid limit 1`,
      [id]
    );
    const existing = existingRows?.[0];
    if (!existing) return res.status(404).json({ error: "Relationship not found." });

    const isAdmin = hasAdminAccess(me.role);
    const isMd = isMedicalDirectorRole(me.role) && String(existing.medical_director_id || "") === String(me.id);
    if (!isAdmin && !isMd) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const body = req.body || {};
    const allowed = {};
    for (const key of ["status", "start_date", "supervision_notes", "end_date", "medical_director_email", "medical_director_name"]) {
      if (Object.prototype.hasOwnProperty.call(body, key)) allowed[key] = body[key];
    }
    if (!Object.keys(allowed).length) {
      return res.json(existing);
    }

    if (!isAdmin && isMd) {
      if (Object.prototype.hasOwnProperty.call(allowed, "status")) {
        const nextStatus = String(allowed.status || "").trim().toLowerCase();
        const prevStatus = String(existing.status || "").trim().toLowerCase();
        const mdAllowed = new Set(["active", "suspended", "terminated"]);
        if (!mdAllowed.has(nextStatus)) {
          return res.status(400).json({
            error:
              "Medical directors cannot reject an assignment. Accept the assigned provider (active), or suspend/terminate an existing supervision.",
          });
        }
        if (prevStatus === "pending") {
          if (nextStatus !== "active") {
            return res.status(400).json({
              error: "While this assignment is pending, you can only accept it by setting status to active.",
            });
          }
        } else if (prevStatus === "active") {
          if (!["suspended", "terminated"].includes(nextStatus)) {
            return res.status(400).json({ error: "Invalid status transition from active." });
          }
        } else if (prevStatus === "suspended") {
          if (!["active", "terminated"].includes(nextStatus)) {
            return res.status(400).json({ error: "Invalid status transition from suspended." });
          }
        } else {
          return res.status(400).json({ error: "This relationship cannot be updated." });
        }
      }
      delete allowed.medical_director_email;
      delete allowed.medical_director_name;
    }

    const setParts = [];
    const params = [id];
    let i = 2;
    for (const [col, val] of Object.entries(allowed)) {
      setParts.push(`${col} = $${i}`);
      params.push(val);
      i += 1;
    }
    setParts.push("updated_at = now()");
    const { rows } = await query(
      `update public.medical_director_relationship
       set ${setParts.join(", ")}
       where id = $1::uuid
       returning *`,
      params
    );
    const row = rows?.[0] || existing;
    if (Object.prototype.hasOwnProperty.call(allowed, "status")) {
      await syncCoverageRequestStatus(id, allowed.status);
    }
    return res.json(row);
  } catch (error) {
    return next(error);
  }
});
