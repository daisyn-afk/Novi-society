import { Router } from "express";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateUser
} from "./repository.js";
import {
  hasAdminAccess,
  hasStaffModuleAccess,
  requireAuth,
  requireAdminOrStaffWithModule,
} from "../auth/helpers.js";

export const usersRouter = Router();

// Staff-accessible read-only provider directory.
// Registered BEFORE requireAdminAuth so it bypasses the admin-only guard.
// Returns limited fields only — no passwords, no role management data.
usersRouter.get("/providers", requireAdminOrStaffWithModule("AdminProviders"), async (req, res, next) => {
  try {
    const result = await listUsers({
      page: req.query.page,
      pageSize: req.query.page_size ?? req.query.pageSize,
      q: req.query.q ?? req.query.search,
      role: "provider",
      isActive: req.query.is_active ?? req.query.isActive,
    });
    const safeData = (result.data || []).map(u => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      full_name: u.full_name,
      email: u.email,
      is_active: u.is_active,
      created_at: u.created_at,
    }));
    res.json({ ...result, data: safeData });
  } catch (error) {
    next(error);
  }
});

async function requireUsersRouteAccess(req, res, next) {
  const me = req.me || {};
  if (hasAdminAccess(me.role) || hasStaffModuleAccess(me, "AdminUsers") || hasStaffModuleAccess(me, "AdminProviders")) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden." });
}

function isProviderOnlyStaff(me) {
  return hasStaffModuleAccess(me, "AdminProviders") && !hasStaffModuleAccess(me, "AdminUsers");
}

usersRouter.use(requireAuth);

usersRouter.get("/", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      const roleFilter = String(req.query.role || "").trim().toLowerCase();
      if (isProviderOnlyStaff(me) && roleFilter && roleFilter !== "provider") {
        return res.status(403).json({ error: "Forbidden." });
      }
      const effectiveRole = isProviderOnlyStaff(me) ? "provider" : req.query.role;
      const result = await listUsers({
        page: req.query.page,
        pageSize: req.query.page_size ?? req.query.pageSize,
        q: req.query.q ?? req.query.search,
        role: effectiveRole,
        isActive: req.query.is_active ?? req.query.isActive
      });
      return res.json(result);
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found." });
      if (isProviderOnlyStaff(me) && String(user.role || "").toLowerCase() !== "provider") {
        return res.status(403).json({ error: "Forbidden." });
      }
      return res.json(user);
    });
  } catch (error) {
    return next(error);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      const requestedRole = String(req.body?.role || "provider").trim().toLowerCase();
      if (isProviderOnlyStaff(me) && requestedRole !== "provider") {
        return res.status(403).json({ error: "Forbidden." });
      }
      const created = await createUser(req.body || {});
      return res.status(201).json(created);
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.put("/:id", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      if (isProviderOnlyStaff(me)) {
        const target = await getUserById(req.params.id);
        if (!target) return res.status(404).json({ error: "User not found." });
        const nextRole = Object.prototype.hasOwnProperty.call(req.body || {}, "role")
          ? String(req.body.role || "").trim().toLowerCase()
          : String(target.role || "").trim().toLowerCase();
        if (String(target.role || "").toLowerCase() !== "provider" || nextRole !== "provider") {
          return res.status(403).json({ error: "Forbidden." });
        }
      }
      const updated = await updateUser(req.params.id, req.body || {});
      if (!updated) return res.status(404).json({ error: "User not found." });
      return res.json(updated);
    });
  } catch (error) {
    return next(error);
  }
});

usersRouter.delete("/:id", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      if (isProviderOnlyStaff(me)) {
        const target = await getUserById(req.params.id);
        if (!target) return res.status(404).json({ error: "User not found." });
        if (String(target.role || "").toLowerCase() !== "provider") {
          return res.status(403).json({ error: "Forbidden." });
        }
      }
      const ok = await deleteUser(req.params.id);
      if (!ok) return res.status(404).json({ error: "User not found." });
      return res.status(204).send();
    });
  } catch (error) {
    return next(error);
  }
});
