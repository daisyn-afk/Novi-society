import { Router } from "express";
import { listPreOrders, updatePreOrderStatus, patchPreOrder } from "./repository.js";
import { hasAdminAccess, hasStaffModuleAccess, requireAuth } from "../auth/helpers.js";

export const preOrdersRouter = Router();
preOrdersRouter.use(requireAuth);

preOrdersRouter.get("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    const role = String(me.role || "").trim().toLowerCase();
    const requestedOrderType = String(req.query?.order_type || "").trim().toLowerCase();
    const requestedEmail = String(req.query?.customer_email || "").trim().toLowerCase();
    let customerEmail = requestedEmail;

    if (!hasAdminAccess(role) && role !== "staff") {
      customerEmail = String(me.email || "").trim().toLowerCase();
      if (!customerEmail) {
        return res.status(403).json({ error: "Forbidden." });
      }
    }

    if (role === "staff") {
      if (!requestedOrderType) {
        return res.status(400).json({ error: "Staff requests must include order_type." });
      }
      if (requestedOrderType === "model") {
        if (!hasStaffModuleAccess(me, "StaffModelSignups")) {
          return res.status(403).json({ error: "Forbidden." });
        }
      } else if (!hasStaffModuleAccess(me, "StaffPreOrders")) {
        return res.status(403).json({ error: "Forbidden." });
      }
    }

    const rows = await listPreOrders({
      limit: req.query?.limit || 200,
      customerEmail,
      orderType: requestedOrderType,
    });
    const responseRows = hasAdminAccess(role)
      ? rows
      : rows.map((row) => {
          const {
            password_setup_status: _passwordSetupStatus,
            password_reset_email_sent_at: _passwordResetEmailSentAt,
            password_reset_link_issued_at: _passwordResetLinkIssuedAt,
            password_reset_completed_at: _passwordResetCompletedAt,
            ...safeRow
          } = row || {};
          return safeRow;
        });
    res.json(responseRows);
  } catch (error) {
    next(error);
  }
});

preOrdersRouter.patch("/:id", async (req, res, next) => {
  try {
    const me = req.me || {};
    if (!hasAdminAccess(me.role) && !hasStaffModuleAccess(me, "StaffModelSignups")) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const row = await patchPreOrder(req.params.id, req.body || {});
    if (!row) return res.status(404).json({ error: "Pre-order not found." });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

preOrdersRouter.post("/action", async (req, res, next) => {
  try {
    const me = req.me || {};
    if (!hasAdminAccess(me.role) && !hasStaffModuleAccess(me, "StaffPreOrders")) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const row = await updatePreOrderStatus({
      id: req.body?.pre_order_id,
      action: req.body?.action,
      rejectionReason: req.body?.rejection_reason,
      actor: req.headers["x-admin-email"] || null
    });
    if (!row) return res.status(404).json({ error: "Pre-order not found." });
    res.json(row);
  } catch (error) {
    next(error);
  }
});
