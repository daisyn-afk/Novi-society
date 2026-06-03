import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";

export const integrationsRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

/**
 * OpenAI vision + JSON (used by patient "My Journey" skin analysis and optional chat).
 * Set OPENAI_API_KEY. Optional: OPENAI_VISION_MODEL (default gpt-4o-mini).
 */
integrationsRouter.post("/invoke-llm", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      const err = new Error("Missing bearer token.");
      err.statusCode = 401;
      throw err;
    }
    await getMeFromAccessToken(token);

    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      const err = new Error("OpenAI is not configured (OPENAI_API_KEY).");
      err.statusCode = 503;
      throw err;
    }

    const body = req.body || {};
    const prompt = String(body.prompt || "").trim();
    if (!prompt) {
      const err = new Error("prompt is required.");
      err.statusCode = 400;
      throw err;
    }

    const fileUrls = Array.isArray(body.file_urls) ? body.file_urls.map((u) => String(u || "").trim()).filter(Boolean) : [];
    const model = String(process.env.OPENAI_VISION_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
    const wantsJson = Boolean(body.response_json_schema) || fileUrls.length > 0;

    const userContent = [];
    userContent.push({ type: "text", text: prompt });
    for (const url of fileUrls.slice(0, 4)) {
      userContent.push({
        type: "image_url",
        image_url: { url }
      });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are Novi, an aesthetic wellness assistant. Follow the user's instructions. When JSON output is requested, respond with a single valid JSON object only — no markdown, no code fences, no commentary."
      },
      { role: "user", content: userContent }
    ];

    const payload = {
      model,
      messages,
      temperature: 0.4
    };

    if (wantsJson) {
      payload.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    if (!response.ok) {
      let detail = rawText.slice(0, 500);
      try {
        const openAiErr = JSON.parse(rawText)?.error;
        if (openAiErr?.message) detail = String(openAiErr.message);
        if (openAiErr?.code === "insufficient_quota") {
          const err = new Error(
            "OpenAI API credits are exhausted. Add billing credits at platform.openai.com, then try again."
          );
          err.statusCode = 503;
          err.code = "insufficient_quota";
          throw err;
        }
      } catch (parseErr) {
        if (parseErr?.code === "insufficient_quota") throw parseErr;
      }
      const err = new Error(`OpenAI request failed (${response.status}): ${detail}`);
      err.statusCode = 502;
      throw err;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const err = new Error("OpenAI returned invalid JSON.");
      err.statusCode = 502;
      throw err;
    }

    const choice = parsed?.choices?.[0]?.message?.content;
    const textOut = typeof choice === "string" ? choice.trim() : "";

    if (payload.response_format) {
      try {
        const json = JSON.parse(textOut);
        return res.json(json);
      } catch {
        const err = new Error("Model did not return parseable JSON.");
        err.statusCode = 502;
        throw err;
      }
    }

    return res.json({ content: textOut });
  } catch (error) {
    return next(error);
  }
});
