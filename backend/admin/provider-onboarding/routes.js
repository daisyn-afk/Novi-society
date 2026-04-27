import { Router } from "express";
import { submitProviderBasicOnboarding } from "./service.js";

export const providerOnboardingRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

providerOnboardingRouter.post("/basic", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing bearer token." });
    }
    const saved = await submitProviderBasicOnboarding({
      accessToken: token,
      payload: req.body || {}
    });
    return res.status(201).json(saved);
  } catch (error) {
    return next(error);
  }
});
