import { isGfeSimulationUrl } from "@/lib/gfeSimulation";

/** Open Qualiphy GFE in a new browser tab (or in-app simulation when QUALIPHY_ENV=test). */
export function openQualiphyGfeExam(meetingUrl) {
  const url = String(meetingUrl || "").trim();
  if (!url || url.includes("/ModelBookingLookup")) return false;

  if (isGfeSimulationUrl(url)) {
    window.location.assign(url);
    return true;
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  return opened != null;
}
