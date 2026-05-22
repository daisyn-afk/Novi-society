import { getMeFromAccessToken } from "./service.js";

/**
 * requireAuth — verifies the Bearer token and attaches req.me.
 * Allows any authenticated user (admin, staff, provider, etc.).
 * Apply this to operational routes that staff needs to call.
 */
export async function requireAuth(req, res, next) {
  const token = String(req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
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

/**
 * requireAdminOrStaff — verifies the Bearer token and ensures the caller is
 * either admin or staff.  Useful for routes that both roles legitimately call.
 */
export async function requireAdminOrStaff(req, res, next) {
  const token = String(req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  try {
    req.me = await getMeFromAccessToken(token);
    if (req.me?.role !== "admin" && req.me?.role !== "staff") {
      return res.status(403).json({ error: "Forbidden." });
    }
    next();
  } catch (err) {
    res.status(err.statusCode || 401).json({ error: err.message });
  }
}
