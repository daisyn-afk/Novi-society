import { Router } from "express";
import { getMeFromAccessToken, login, refreshSession, signup, updateMe } from "./service.js";

export const authRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

authRouter.post("/signup", async (req, res, next) => {
  try {
    const result = await signup(req.body || {});
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const result = await login(req.body || {});
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const result = await refreshSession(req.body?.refresh_token);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing bearer token." });
    }
    const me = await getMeFromAccessToken(token);
    return res.json(me);
  } catch (error) {
    return next(error);
  }
});

authRouter.patch("/me", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing bearer token." });
    }
    const me = await updateMe({
      accessToken: token,
      updates: req.body || {}
    });
    return res.json(me);
  } catch (error) {
    return next(error);
  }
});
