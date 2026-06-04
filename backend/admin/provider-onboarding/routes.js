import { Router } from "express";
import { getProviderBasicOnboardingForMe, submitProviderBasicOnboarding } from "./service.js";
import {
  listProviderJoinChoices,
  recordProviderJoinChoiceFromToken,
  upsertProviderJoinChoice,
} from "./joinChoice.js";

export const providerOnboardingRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

providerOnboardingRouter.get("/me", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing bearer token." });
    }
    const data = await getProviderBasicOnboardingForMe(token);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

/** Save email + Join-as-Provider choice (signup/login sync or logged-in user). */
providerOnboardingRouter.post("/join-choice", async (req, res, next) => {
  try {
    const body = req.body || {};
    const token = getBearerToken(req);
    const saved = token
      ? await recordProviderJoinChoiceFromToken({
          accessToken: token,
          choice: body.choice,
          goal: body.goal,
          explore_skip: body.explore_skip,
        })
      : await upsertProviderJoinChoice({
          email: body.email,
          choice: body.choice,
          goal: body.goal,
          explore_skip: body.explore_skip,
        });
    return res.json(saved);
  } catch (error) {
    return next(error);
  }
});

/** Admin: list provider join choices. */
providerOnboardingRouter.get("/join-choices", async (req, res, next) => {
  try {
    const rows = await listProviderJoinChoices({ limit: req.query?.limit });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

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
