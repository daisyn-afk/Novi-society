import { adminApiRequest } from "./adminApiRequest.js";

export const appointmentMessagesApi = {
  getMessages: (threadId) =>
    adminApiRequest(
      `/admin/appointment-messages?thread_id=${encodeURIComponent(String(threadId || ""))}`
    ),

  sendMessage: (body) =>
    adminApiRequest("/admin/appointment-messages", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  markRead: (threadId) =>
    adminApiRequest(
      `/admin/appointment-messages/threads/${encodeURIComponent(String(threadId || ""))}/read`,
      { method: "PATCH" }
    ),

  getUnreadSummary: () => adminApiRequest("/admin/appointment-messages/unread-summary"),

  getPreBookingInbox: () =>
    adminApiRequest("/admin/appointment-messages/pre-booking-inbox"),

  getPreBookingQuestions: (threadId) =>
    adminApiRequest(
      `/admin/appointment-messages/pre-booking-questions?thread_id=${encodeURIComponent(String(threadId || ""))}`
    ),
};
