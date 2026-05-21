import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const mdMessagesRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function isMedicalDirectorRole(role) {
  return String(role || "").trim().toLowerCase() === "medical_director";
}

function isProviderRole(role) {
  return String(role || "").trim().toLowerCase() === "provider";
}

/**
 * Compute the deterministic thread_id for an MD-provider pair.
 * Sorting ensures the same ID regardless of who initiates.
 */
function computeThreadId(idA, idB) {
  return [String(idA), String(idB)].sort().join("-");
}

/**
 * Validate that an active MD-provider relationship exists.
 * Returns the relationship row or null.
 */
async function getActiveRelationship(mdId, providerId) {
  const { rows } = await query(
    `SELECT id, provider_email, provider_name, medical_director_email, medical_director_name
     FROM public.medical_director_relationship
     WHERE medical_director_id = $1 AND provider_id = $2 AND status = 'active'
     LIMIT 1`,
    [mdId, providerId]
  );
  return rows[0] || null;
}

// GET /admin/md-messages/threads
// Returns distinct threads for the current user with last message preview and unread count.
mdMessagesRouter.get("/threads", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    if (!isMedicalDirectorRole(me.role) && !isProviderRole(me.role)) {
      return res.status(403).json({ error: "Messaging is only available for providers and medical directors." });
    }

    // Aggregate threads: get latest message per thread and unread count
    const { rows } = await query(
      `SELECT
         m.thread_id,
         (
           SELECT msg.message FROM public.md_messages msg
           WHERE msg.thread_id = m.thread_id
           ORDER BY msg.created_at DESC LIMIT 1
         ) AS last_message,
         (
           SELECT msg.created_at FROM public.md_messages msg
           WHERE msg.thread_id = m.thread_id
           ORDER BY msg.created_at DESC LIMIT 1
         ) AS last_message_at,
         (
           SELECT msg.sender_id FROM public.md_messages msg
           WHERE msg.thread_id = m.thread_id
           ORDER BY msg.created_at DESC LIMIT 1
         ) AS last_sender_id,
         COUNT(*) FILTER (WHERE m.recipient_id = $1 AND m.read_at IS NULL) AS unread_count,
         -- Derive the other participant's info from the messages
         MAX(CASE WHEN m.sender_id <> $1 THEN m.sender_id END) AS other_user_id,
         MAX(CASE WHEN m.sender_id <> $1 THEN m.sender_email END) AS other_user_email,
         MAX(CASE WHEN m.sender_id <> $1 THEN m.sender_name END) AS other_user_name,
         MAX(CASE WHEN m.sender_id <> $1 THEN m.sender_role END) AS other_user_role,
         -- Fallback: get from recipient fields when current user is the sender
         MAX(CASE WHEN m.sender_id = $1 THEN m.recipient_id END) AS sent_to_id,
         MAX(CASE WHEN m.sender_id = $1 THEN m.recipient_email END) AS sent_to_email,
         MAX(CASE WHEN m.sender_id = $1 THEN m.recipient_name END) AS sent_to_name
       FROM public.md_messages m
       WHERE m.sender_id = $1 OR m.recipient_id = $1
       GROUP BY m.thread_id
       ORDER BY MAX(m.created_at) DESC`,
      [me.id]
    );

    // Normalize: ensure other_user fields always resolve regardless of message direction
    const threads = rows.map((row) => ({
      thread_id: row.thread_id,
      last_message: row.last_message,
      last_message_at: row.last_message_at,
      last_sender_id: row.last_sender_id,
      unread_count: Number(row.unread_count || 0),
      other_user_id: row.other_user_id || row.sent_to_id,
      other_user_email: row.other_user_email || row.sent_to_email,
      other_user_name: row.other_user_name || row.sent_to_name,
      other_user_role: row.other_user_role,
    }));

    return res.json(threads);
  } catch (error) {
    return next(error);
  }
});

// GET /admin/md-messages/threads/:threadId
// Returns all messages for a thread. Validates the caller is a participant.
mdMessagesRouter.get("/threads/:threadId", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    if (!isMedicalDirectorRole(me.role) && !isProviderRole(me.role)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const threadId = String(req.params.threadId || "").trim();
    if (!threadId) return res.status(400).json({ error: "threadId is required." });

    // Security: verify the caller is a participant in this thread
    const { rows: participantCheck } = await query(
      `SELECT id FROM public.md_messages
       WHERE thread_id = $1 AND (sender_id = $2 OR recipient_id = $2)
       LIMIT 1`,
      [threadId, me.id]
    );
    if (!participantCheck.length) {
      return res.status(403).json({ error: "You are not a participant in this thread." });
    }

    const { rows } = await query(
      `SELECT * FROM public.md_messages
       WHERE thread_id = $1
       ORDER BY created_at ASC`,
      [threadId]
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

// POST /admin/md-messages
// Send a new message. Server recomputes thread_id and validates the MD-provider relationship.
mdMessagesRouter.post("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    if (!isMedicalDirectorRole(me.role) && !isProviderRole(me.role)) {
      return res.status(403).json({ error: "Messaging is only available for providers and medical directors." });
    }

    const body = req.body || {};
    const recipientId = String(body.recipient_id || "").trim();
    const messageText = String(body.message || "").trim();

    if (!recipientId) return res.status(400).json({ error: "recipient_id is required." });
    if (!messageText) return res.status(400).json({ error: "message is required." });
    if (recipientId === me.id) return res.status(400).json({ error: "Cannot send a message to yourself." });

    let rel;
    let mdId;
    let providerId;

    if (isMedicalDirectorRole(me.role)) {
      // MD → provider: validate active relationship
      rel = await getActiveRelationship(me.id, recipientId);
      if (!rel) {
        return res.status(403).json({ error: "No active supervision relationship with this provider." });
      }
      mdId = me.id;
      providerId = recipientId;
    } else {
      // Provider → MD: validate active relationship
      const { rows: relRows } = await query(
        `SELECT id, provider_email, provider_name, medical_director_email, medical_director_name
         FROM public.medical_director_relationship
         WHERE provider_id = $1 AND medical_director_id = $2 AND status = 'active'
         LIMIT 1`,
        [me.id, recipientId]
      );
      rel = relRows[0] || null;
      if (!rel) {
        return res.status(403).json({ error: "No active supervision relationship with this medical director." });
      }
      mdId = recipientId;
      providerId = me.id;
    }

    // Compute deterministic thread_id
    const threadId = computeThreadId(mdId, providerId);

    // Resolve recipient name/email from relationship record when not supplied by caller
    let recipientEmail = String(body.recipient_email || "").trim() || null;
    let recipientName = String(body.recipient_name || "").trim() || null;

    if (!recipientEmail || !recipientName) {
      if (isMedicalDirectorRole(me.role)) {
        recipientEmail = recipientEmail || rel.provider_email || null;
        recipientName = recipientName || rel.provider_name || null;
      } else {
        recipientEmail = recipientEmail || rel.medical_director_email || null;
        recipientName = recipientName || rel.medical_director_name || null;
      }
    }

    const senderName = String(body.sender_name || me.full_name || "").trim() || null;
    const senderRole = String(body.sender_role || me.role || "provider").trim();

    const { rows } = await query(
      `INSERT INTO public.md_messages (
         thread_id, sender_id, sender_email, sender_name, sender_role,
         recipient_id, recipient_email, recipient_name, message
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        threadId,
        me.id,
        me.email || null,
        senderName,
        senderRole,
        recipientId,
        recipientEmail,
        recipientName,
        messageText,
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

// PATCH /admin/md-messages/threads/:threadId/read
// Mark all unread messages in the thread where recipient is current user as read.
mdMessagesRouter.patch("/threads/:threadId/read", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    if (!isMedicalDirectorRole(me.role) && !isProviderRole(me.role)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const threadId = String(req.params.threadId || "").trim();
    if (!threadId) return res.status(400).json({ error: "threadId is required." });

    // Only mark messages where the current user is the recipient and message is unread
    await query(
      `UPDATE public.md_messages
       SET read_at = now()
       WHERE thread_id = $1 AND recipient_id = $2 AND read_at IS NULL`,
      [threadId, me.id]
    );

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
