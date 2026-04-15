import { Router } from "express";
import { createLocation, listLocations } from "./repository.js";

function sanitizeText(value, maxLength = 255) {
  return String(value || "").trim().slice(0, maxLength);
}

function validateLocationInput(body) {
  const venue_name = sanitizeText(body?.venue_name);
  const street_address = sanitizeText(body?.street_address);
  const city = sanitizeText(body?.city);
  const state = sanitizeText(body?.state, 10).toUpperCase();
  const zip_code = sanitizeText(body?.zip_code, 20);

  const errors = {};
  if (!venue_name) errors.venue_name = "Venue name is required.";
  if (!city) errors.city = "City is required.";
  if (!state) errors.state = "State is required.";

  if (Object.keys(errors).length > 0) {
    const err = new Error("Invalid location payload.");
    err.statusCode = 400;
    err.details = errors;
    throw err;
  }

  return {
    venue_name,
    street_address: street_address || null,
    city,
    state,
    zip_code: zip_code || null,
  };
}

export const locationsRouter = Router();

locationsRouter.get("/", async (req, res, next) => {
  try {
    const locations = await listLocations({
      search: req.query.search || "",
      limit: req.query.limit || 50,
    });
    res.json(locations);
  } catch (error) {
    next(error);
  }
});

locationsRouter.post("/", async (req, res, next) => {
  try {
    const payload = validateLocationInput(req.body);
    const created = await createLocation(payload);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});
