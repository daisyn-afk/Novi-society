/**
 * Server-side OpenAI chat completions (no user auth required).
 * Used by escalation flows and /admin/integrations/invoke-llm.
 */

export function getOpenAiVisionModel() {
  return String(process.env.OPENAI_VISION_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
}

export async function invokeOpenAiChat({ prompt, responseJson = false, temperature = 0.4 }) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    const err = new Error("OpenAI is not configured (OPENAI_API_KEY).");
    err.statusCode = 503;
    throw err;
  }

  const payload = {
    model: getOpenAiVisionModel(),
    messages: [
      {
        role: "system",
        content:
          "You are a clinical aesthetic compliance assistant. When JSON is requested, respond with a single valid JSON object only — no markdown, no code fences.",
      },
      { role: "user", content: String(prompt || "").trim() },
    ],
    temperature,
  };

  if (responseJson) {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  if (!response.ok) {
    let detail = rawText.slice(0, 500);
    try {
      const openAiErr = JSON.parse(rawText)?.error;
      if (openAiErr?.message) detail = String(openAiErr.message);
    } catch {
      /* ignore */
    }
    const err = new Error(`OpenAI request failed (${response.status}): ${detail}`);
    err.statusCode = 502;
    throw err;
  }

  const parsed = JSON.parse(rawText);
  const textOut = String(parsed?.choices?.[0]?.message?.content || "").trim();

  if (responseJson) {
    try {
      return JSON.parse(textOut);
    } catch {
      const err = new Error("Model did not return parseable JSON.");
      err.statusCode = 502;
      throw err;
    }
  }

  return textOut;
}
