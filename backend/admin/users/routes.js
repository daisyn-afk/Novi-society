import { Router } from "express";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateUser
} from "./repository.js";
import { requireAdmin, requireAdminOrStaffWithModule } from "../auth/helpers.js";

export const usersRouter = Router();

// Staff-accessible read-only provider directory.
// Registered BEFORE requireAdminAuth so it bypasses the admin-only guard.
// Returns limited fields only — no passwords, no role management data.
usersRouter.get("/providers", requireAdminOrStaffWithModule("StaffProviders"), async (req, res, next) => {
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

usersRouter.use(requireAdmin);

usersRouter.get("/", async (req, res, next) => {
  try {
    const result = await listUsers({
      page: req.query.page,
      pageSize: req.query.page_size ?? req.query.pageSize,
      q: req.query.q ?? req.query.search,
      role: req.query.role,
      isActive: req.query.is_active ?? req.query.isActive
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const created = await createUser(req.body || {});
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

usersRouter.put("/:id", async (req, res, next) => {
  try {
    const updated = await updateUser(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: "User not found." });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

usersRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: "User not found." });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});
