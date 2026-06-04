/** Open Qualiphy GFE in a new browser tab (exam runs on Qualiphy, not in-app). */
export function openQualiphyGfeExam(meetingUrl) {
  const url = String(meetingUrl || "").trim();
  if (!url || url.includes("/ModelBookingLookup")) return false;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  return opened != null;
}
