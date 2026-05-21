import { adminApiRequest } from "./adminApiRequest.js";

export const mdMessagesApi = {
  /** List all conversation threads for the current user with unread counts. */
  getThreads: () =>
    adminApiRequest("/admin/md-messages/threads"),

  /** Fetch all messages in a thread. Caller must be a participant. */
  getMessages: (threadId) =>
    adminApiRequest(`/admin/md-messages/threads/${encodeURIComponent(threadId)}`),

  /**
   * Send a new message.
   * @param {{ recipient_id, recipient_email, recipient_name, message, sender_name, sender_role }} body
   */
  sendMessage: (body) =>
    adminApiRequest("/admin/md-messages", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** Mark all unread messages in the thread (where current user is recipient) as read. */
  markRead: (threadId) =>
    adminApiRequest(
      `/admin/md-messages/threads/${encodeURIComponent(threadId)}/read`,
      { method: "PATCH" }
    ),
};
