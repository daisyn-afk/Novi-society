import { Router } from "express";
import { listPreOrders, patchPreOrder } from "./repository.js";
import { processPreOrderAction } from "./service.js";
import { hasAdminAccess, hasStaffModuleAccess, requireAuth } from "../auth/helpers.js";

export const preOrdersRouter = Router();
preOrdersRouter.use(requireAuth);

preOrdersRouter.get("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    const role = String(me.role || "").trim().toLowerCase();
    let requestedOrderType = String(req.query?.order_type || "").trim().toLowerCase();
    const requestedEmail = String(req.query?.customer_email || "").trim().toLowerCase();
    let customerEmail = requestedEmail;

    if (!hasAdminAccess(role) && role !== "staff") {
      customerEmail = String(me.email || "").trim().toLowerCase();
      if (!customerEmail) {
        return res.status(403).json({ error: "Forbidden." });
      }
    }

    if (role === "staff") {
      const canPreOrders = hasStaffModuleAccess(me, "AdminPreOrders");
      const canModelSignups = hasStaffModuleAccess(me, "AdminModelSignups");

      if (requestedOrderType === "model") {
        if (!canModelSignups) {
          return res.status(403).json({ error: "Forbidden." });
        }
      } else if (requestedOrderType) {
        if (!canPreOrders) return res.status(403).json({ error: "Forbidden." });
      } else {
        // Match admin page behavior:
        // - If staff has only one related module, auto-scope to that dataset.
        // - If both are granted, return both datasets like admin.
        if (canPreOrders && !canModelSignups) requestedOrderType = "course";
        else if (!canPreOrders && canModelSignups) requestedOrderType = "model";
        else if (!canPreOrders && !canModelSignups) return res.status(403).json({ error: "Forbidden." });
      }
    }

    const rows = await listPreOrders({
      limit: req.query?.limit || 200,
      customerEmail,
      orderType: requestedOrderType,
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

preOrdersRouter.patch("/:id", async (req, res, next) => {
  try {
    const me = req.me || {};
    if (!hasAdminAccess(me.role) && !hasStaffModuleAccess(me, "AdminModelSignups")) {
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
    if (!hasAdminAccess(me.role) && !hasStaffModuleAccess(me, "AdminPreOrders")) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const row = await processPreOrderAction({
      id: req.body?.pre_order_id,
      action: req.body?.action,
      rejectionReason: req.body?.rejection_reason,
      actor: req.headers["x-admin-email"] || null,
      req,
      frontendOrigin: req.body?.frontend_origin
    });
    if (!row) return res.status(404).json({ error: "Pre-order not found." });
    res.json(row);
  } catch (error) {
    next(error);
  }
});
