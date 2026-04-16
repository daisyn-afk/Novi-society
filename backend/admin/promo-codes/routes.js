import { Router } from "express";
import { createPromoCode, deletePromoCode, listPromoCodes, updatePromoCode } from "./repository.js";

function validatePromoInput(payload) {
  const code = String(payload?.code || "").trim();
  if (!code) {
    const err = new Error("Promo code is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!["percentage", "percent", "fixed"].includes(payload?.discount_type)) {
    const err = new Error("discount_type must be 'percent' or 'fixed'.");
    err.statusCode = 400;
    throw err;
  }
  const discountValue = Number(payload?.discount_value);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    const err = new Error("discount_value must be a number greater than 0.");
    err.statusCode = 400;
    throw err;
  }
}

export const promoCodesRouter = Router();

promoCodesRouter.get("/", async (_req, res, next) => {
  try {
    const data = await listPromoCodes();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

promoCodesRouter.post("/", async (req, res, next) => {
  try {
    validatePromoInput(req.body || {});
    const created = await createPromoCode(req.body || {});
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

promoCodesRouter.put("/:id", async (req, res, next) => {
  try {
    validatePromoInput(req.body || {});
    const updated = await updatePromoCode(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: "Promo code not found." });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

promoCodesRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await deletePromoCode(req.params.id);
    if (!ok) return res.status(404).json({ error: "Promo code not found." });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});
