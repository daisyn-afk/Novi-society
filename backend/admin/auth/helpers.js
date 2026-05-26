import { getMeFromAccessToken } from "./service.js";

const STAFF_MODULE_ALIASES = {
  AdminUsers: [],
  AdminPreOrders: ["StaffPreOrders"],
  admincourses: [],
  AdminEnrollments: ["StaffEnrollments"],
  AdminProviders: ["StaffProviders"],
  AdminLicenses: [],
  AdminServiceTypes: [],
  AdminPromoCodes: [],
  AdminManufacturers: [],
  AdminEmailTemplates: [],
  AdminLaunchPad: [],
  AdminWizardConfig: [],
  AdminCompliance: ["StaffCompliance"],
  AdminModelSignups: ["StaffModelSignups"],
  AdminDashboard: ["StaffDashboard"],
};
const STAFF_MODULE_KEYS = new Set(
  Object.keys(STAFF_MODULE_ALIASES).flatMap((key) => [key, ...(STAFF_MODULE_ALIASES[key] || [])])
);

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export function getBearerTokenFromRequest(req) {
  return String(req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export function hasAdminAccess(role) {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

export function hasStaffModuleAccess(me, moduleKey) {
  if (!moduleKey || !STAFF_MODULE_KEYS.has(moduleKey)) return false;
  if (normalizeRole(me?.role) !== "staff") return false;
  const permissions = me?.permissions || {};
  if (permissions[moduleKey] === true) return true;
  const aliases = STAFF_MODULE_ALIASES[moduleKey] || [];
  return aliases.some((alias) => permissions[alias] === true);
}

export function hasAdminOrStaffModuleAccess(me, moduleKey) {
  if (hasAdminAccess(me?.role)) return true;
  return hasStaffModuleAccess(me, moduleKey);
}

/**
 * requireAuth — verifies the Bearer token and attaches req.me.
 * Allows any authenticated user (admin, staff, provider, etc.).
 * Apply this to operational routes that staff needs to call.
 */
export async function requireAuth(req, res, next) {
  const token = getBearerTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  try {
    req.me = await getMeFromAccessToken(token);
    next();
  } catch (err) {
    res.status(err.statusCode || 401).json({ error: err.message });
  }
}

export async function requireAdmin(req, res, next) {
  const token = getBearerTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  try {
    req.me = await getMeFromAccessToken(token);
    if (!hasAdminAccess(req.me?.role)) {
      return res.status(403).json({ error: "Forbidden. Admin access required." });
    }
    return next();
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }
}

/**
 * requireAdminOrStaff — verifies the Bearer token and ensures the caller is
 * either admin or staff.  Useful for routes that both roles legitimately call.
 */
export async function requireAdminOrStaff(req, res, next) {
  const token = getBearerTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  try {
    req.me = await getMeFromAccessToken(token);
    const role = normalizeRole(req.me?.role);
    if (!hasAdminAccess(role) && role !== "staff") {
      return res.status(403).json({ error: "Forbidden." });
    }
    next();
  } catch (err) {
    res.status(err.statusCode || 401).json({ error: err.message });
  }
}

export function requireAdminOrStaffWithModule(moduleKey) {
  return async function requireAdminOrStaffModule(req, res, next) {
    const token = getBearerTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    try {
      req.me = await getMeFromAccessToken(token);
      if (hasAdminAccess(req.me?.role)) return next();
      if (hasStaffModuleAccess(req.me, moduleKey)) return next();
      return res.status(403).json({ error: "Forbidden." });
    } catch (err) {
      return res.status(err.statusCode || 401).json({ error: err.message });
    }
  };
}
