import { Router } from "express";
import { requireAdminOrStaffWithModule } from "../auth/helpers.js";
import { createPromoCode, deletePromoCode, listPromoCodes, updatePromoCode } from "./repository.js";

function validatePromoInput(payload, { isUpdate = false } = {}) {
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
  const appliesTo = String(payload?.applies_to || "course").toLowerCase();
  if (!["course", "model"].includes(appliesTo)) {
    const err = new Error("applies_to must be 'course' or 'model'.");
    err.statusCode = 400;
    throw err;
  }

  const rawFrom = payload?.valid_from ?? payload?.starts_at ?? null;
  const rawUntil = payload?.valid_until ?? payload?.ends_at ?? null;
  const startsAt = rawFrom ? new Date(rawFrom) : null;
  const endsAt = rawUntil ? new Date(rawUntil) : null;

  if (rawFrom && (!startsAt || Number.isNaN(startsAt.getTime()))) {
    const err = new Error("Valid from must be a valid date and time.");
    err.statusCode = 400;
    throw err;
  }
  if (rawUntil && (!endsAt || Number.isNaN(endsAt.getTime()))) {
    const err = new Error("Valid until must be a valid date and time.");
    err.statusCode = 400;
    throw err;
  }
  if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
    const err = new Error("Valid until must be the same time or later than valid from.");
    err.statusCode = 400;
    throw err;
  }

  const now = Date.now();
  if (!isUpdate) {
    if (startsAt && startsAt.getTime() < now) {
      const err = new Error("Valid from cannot be in the past.");
      err.statusCode = 400;
      throw err;
    }
    if (endsAt && endsAt.getTime() < now) {
      const err = new Error("Valid until cannot be in the past.");
      err.statusCode = 400;
      throw err;
    }
  }

  const discountType = String(payload?.discount_type || "").toLowerCase();
  if (discountType === "percent" || discountType === "percentage") {
    if (discountValue > 100) {
      const err = new Error("Percentage discount cannot exceed 100.");
      err.statusCode = 400;
      throw err;
    }
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

promoCodesRouter.post("/", requireAdminOrStaffWithModule("AdminPromoCodes"), async (req, res, next) => {
  try {
    validatePromoInput(req.body || {});
    const created = await createPromoCode(req.body || {});
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

promoCodesRouter.put("/:id", requireAdminOrStaffWithModule("AdminPromoCodes"), async (req, res, next) => {
  try {
    validatePromoInput(req.body || {}, { isUpdate: true });
    const updated = await updatePromoCode(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: "Promo code not found." });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

promoCodesRouter.delete("/:id", requireAdminOrStaffWithModule("AdminPromoCodes"), async (req, res, next) => {
  try {
    const ok = await deletePromoCode(req.params.id);
    if (!ok) return res.status(404).json({ error: "Promo code not found." });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});
