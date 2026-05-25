import { adminApiRequest } from "@/api/adminApiRequest";

export function fetchGoogleCalendarStatus() {
  return adminApiRequest("/admin/integrations/google-calendar/status", { method: "GET" });
}

export function fetchGoogleCalendarConnectUrl() {
  return adminApiRequest("/admin/integrations/google-calendar/connect-url", { method: "GET" });
}

export function disconnectGoogleCalendar() {
  return adminApiRequest("/admin/integrations/google-calendar", { method: "DELETE" });
}

export function googleCalendarCallbackMessage(searchParams) {
  const status = searchParams.get("google_calendar");
  if (!status) return null;

  if (status === "connected") {
    return { type: "success", message: "Google Calendar connected successfully." };
  }
  if (status === "denied") {
    return { type: "error", message: "Google Calendar connection was cancelled." };
  }

  const reason = searchParams.get("reason");
  if (reason === "email_mismatch") {
    const expected = searchParams.get("expected");
    return {
      type: "error",
      message: `Connect with the same Google account as your NOVI email${expected ? ` (${expected})` : ""}.`,
    };
  }

  return {
    type: "error",
    message: "Could not connect Google Calendar. Please try again.",
  };
}
