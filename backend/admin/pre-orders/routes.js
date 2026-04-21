import { Router } from "express";
import { listPreOrders, updatePreOrderStatus } from "./repository.js";

export const preOrdersRouter = Router();

preOrdersRouter.get("/", async (req, res, next) => {
  try {
    const rows = await listPreOrders({ limit: req.query?.limit || 200 });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

preOrdersRouter.post("/action", async (req, res, next) => {
  try {
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
