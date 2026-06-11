export const GFE_SIMULATE_PAGE_PATH = "/GfeSimulate";

export function isGfeSimulationUrl(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.pathname.replace(/\/+$/, "").toLowerCase().endsWith(GFE_SIMULATE_PAGE_PATH.toLowerCase());
  } catch {
    return value.toLowerCase().includes(GFE_SIMULATE_PAGE_PATH.toLowerCase());
  }
}
