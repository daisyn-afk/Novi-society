import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  insertAppNotification,
  resolveNotificationRecipient,
} from "../certificationNotifications.js";
import {
  buildPreBookingThreadId,
  isPreBookingThreadId,
  legacyPreBookingThreadId,
  parsePreBookingThreadId,
  providerPreBookingThreadLikePattern,
} from "./preBookingThreads.js";
import {
  PRE_BOOKING_QUESTIONS,
  allPreBookingQuestionsAnswered,
  formatPreBookingAnswerMessage,
  isValidPreBookingQuestionKey,
  listPatientPreBookingAnswers,
  nextUnansweredQuestion,
} from "./preBookingQuestions.js";

export const appointmentMessagesRouter = Router();

let tableReadyPromise = null;

async function ensureAppointmentMessagesTable() {
  if (!tableReadyPromise) {
    tableReadyPromise = query(
      `create table if not exists public.appointment_messages (
         id              uuid        primary key default gen_random_uuid(),
         thread_id       text        not null,
         appointment_id  text        not null,
         sender_id       text        not null,
         sender_email    text,
         sender_name     text,
         sender_role     text,
         recipient_id    text        not null,
         recipient_email text,
         recipient_name  text,
         message         text        not null,
         read_at         timestamptz,
         created_at      timestamptz not null default now()
       )`
    )
      .then(() =>
        query(
          `create index if not exists idx_appointment_messages_thread_id on public.appointment_messages(thread_id)`
        )
      )
      .then(() =>
        query(
          `alter table public.appointment_messages
           add column if not exists question_key text`
        )
      )
      .catch((err) => {
        tableReadyPromise = null;
        throw err;
      });
  }
  return tableReadyPromise;
}

appointmentMessagesRouter.use(async (_req, _res, next) => {
  try {
    await ensureAppointmentMessagesTable();
    next();
  } catch (error) {
    next(error);
  }
});

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

function isPatientRole(role) {
  return String(role || "").trim().toLowerCase() === "patient";
}

function isProviderRole(role) {
  return String(role || "").trim().toLowerCase() === "provider";
}

function mapMessageRow(row) {
  if (!row) return row;
  return {
    ...row,
    appointment_id: row.thread_id,
    created_date: row.created_at,
  };
}

function previewText(text, max = 120) {
  const trimmed = String(text || "").trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

async function getAppointmentByThreadId(threadId) {
  const id = String(threadId || "").trim();
  if (!id || isPreBookingThreadId(id)) return null;
  const { rows } = await query(
    `select id, patient_id, patient_email, patient_name, provider_id, provider_email, provider_name, service
     from public.appointments
     where id = $1
     limit 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Validates the caller may access the thread. Returns context for send/list or null.
 */
async function resolveThreadAccess(me, threadId) {
  const tid = String(threadId || "").trim();
  if (!tid) return null;

  const pre = parsePreBookingThreadId(tid);
  if (pre) {
    if (isPatientRole(me.role)) {
      if (pre.legacy) {
        return { threadId: tid, isPreBooking: true, providerId: pre.providerId, patientId: me.id, legacy: true };
      }
      if (pre.patientId !== me.id) return null;
      return { threadId: tid, isPreBooking: true, providerId: pre.providerId, patientId: pre.patientId, legacy: false };
    }
    if (isProviderRole(me.role) && me.id === pre.providerId) {
      return {
        threadId: tid,
        isPreBooking: true,
        providerId: pre.providerId,
        patientId: pre.patientId,
        legacy: pre.legacy,
      };
    }
    if (hasAdminAccess(me.role)) {
      return {
        threadId: tid,
        isPreBooking: true,
        providerId: pre.providerId,
        patientId: pre.patientId,
        legacy: pre.legacy,
      };
    }
    return null;
  }

  // Never treat pre-booking thread ids as appointment UUIDs
  if (isPreBookingThreadId(tid)) return null;

  const appt = await getAppointmentByThreadId(tid);
  if (!appt) return null;

  const isParticipant =
    appt.patient_id === me.id ||
    appt.provider_id === me.id ||
    hasAdminAccess(me.role);
  if (!isParticipant) return null;

  return { threadId: tid, appointment: appt, isPreBooking: false };
}

async function notifyMessageRecipient({
  recipientId,
  recipientEmail,
  recipientRole,
  senderName,
  threadId,
  messageText,
  appointment,
}) {
  const recipient =
    recipientRole === "provider"
      ? await resolveNotificationRecipient({
          providerId: recipientId,
          providerEmail: recipientEmail,
        })
      : await (async () => {
          const id = String(recipientId || "").trim();
          const email = String(recipientEmail || "").trim().toLowerCase();
          const { rows } = await query(
            `select auth_user_id, email
             from public.users
             where ($1::text <> '' and (auth_user_id::text = $1 or id::text = $1))
                or ($2::text <> '' and lower(email) = $2)
             order by updated_at desc nulls last
             limit 1`,
            [id, email]
          );
          const row = rows?.[0] || null;
          return {
            userId: String(row?.auth_user_id || id || "").trim() || null,
            userEmail: String(row?.email || email || "").trim().toLowerCase() || null,
          };
        })();

  const senderLabel = String(senderName || "Someone").trim() || "Someone";
  const snippet = previewText(messageText);
  const serviceLabel = appointment?.service ? ` (${appointment.service})` : "";

  const isPre = isPreBookingThreadId(threadId);
  let linkPage;
  if (recipientRole === "patient") {
    linkPage = isPre
      ? `PatientMarketplace?open_message=${encodeURIComponent(threadId)}`
      : `PatientAppointments?open_message=${encodeURIComponent(threadId)}`;
  } else if (isPre) {
    linkPage = `ProviderMessaging?tab=patient_queries&thread_id=${encodeURIComponent(threadId)}`;
  } else {
    linkPage = "ProviderPractice?tab=appointments";
  }

  const message = isPre && !appointment
    ? `New pre-booking inquiry from ${senderLabel}: ${snippet}`
    : appointment
      ? `New message from ${senderLabel}${serviceLabel}: ${snippet}`
      : `New message from ${senderLabel}: ${snippet}`;

  await insertAppNotification({
    user_id: recipient.userId || recipientId || null,
    user_email: recipient.userEmail || recipientEmail || null,
    type: "appointment_message",
    message,
    link_page: linkPage,
  });
}

// GET /admin/appointment-messages/pre-booking-questions — question list + progress for a thread
appointmentMessagesRouter.get("/pre-booking-questions", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const threadId = String(req.query.thread_id || "").trim();
    if (!threadId || !isPreBookingThreadId(threadId)) {
      return res.status(400).json({ error: "A pre-booking thread_id is required." });
    }

    const access = await resolveThreadAccess(me, threadId);
    if (!access) return res.status(403).json({ error: "Forbidden." });

    const patientId =
      isPatientRole(me.role) ? me.id : String(req.query.patient_id || access.patientId || "").trim();
    const answered =
      patientId ? await listPatientPreBookingAnswers(query, threadId, patientId) : new Set();

    return res.json({
      questions: PRE_BOOKING_QUESTIONS,
      answered_keys: [...answered],
      complete: allPreBookingQuestionsAnswered(answered),
      next_question: nextUnansweredQuestion(answered),
    });
  } catch (error) {
    return next(error);
  }
});

// GET /admin/appointment-messages/pre-booking-inbox — provider: per-patient marketplace inquiries
appointmentMessagesRouter.get("/pre-booking-inbox", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (!isProviderRole(me.role) && !hasAdminAccess(me.role)) {
      return res.status(403).json({ error: "Only providers can view pre-booking inquiries." });
    }

    const providerId = me.id;
    const legacyId = legacyPreBookingThreadId(providerId);
    const likePattern = providerPreBookingThreadLikePattern(providerId);

    const { rows } = await query(
      `select thread_id, sender_id, sender_name, sender_email, sender_role,
              recipient_id, message, read_at, created_at
       from public.appointment_messages
       where thread_id = $1 or thread_id like $2
       order by created_at desc`,
      [legacyId, likePattern]
    );

    const conversations = new Map();

    for (const row of rows) {
      const pre = parsePreBookingThreadId(row.thread_id);
      let convKey;
      let patientId;
      let patientName;
      let patientEmail;

      if (pre?.legacy) {
        if (String(row.sender_role || "").toLowerCase() !== "patient") continue;
        patientId = row.sender_id;
        patientName = row.sender_name;
        patientEmail = row.sender_email;
        convKey = `legacy:${patientId}`;
      } else if (pre?.patientId) {
        patientId = pre.patientId;
        convKey = row.thread_id;
        patientName = null;
        patientEmail = null;
      } else {
        continue;
      }

      if (!patientId) continue;

      if (!conversations.has(convKey)) {
        conversations.set(convKey, {
          thread_id: pre?.legacy ? legacyId : row.thread_id,
          patient_id: patientId,
          patient_name: patientName || null,
          patient_email: patientEmail || null,
          last_message: row.message,
          last_message_at: row.created_at,
          unread_count: 0,
          patient_message_count: 0,
          legacy: !!pre?.legacy,
        });
      }

      const conv = conversations.get(convKey);
      if (
        String(row.sender_role || "").toLowerCase() === "patient" &&
        (!patientId || row.sender_id === patientId)
      ) {
        conv.patient_message_count += 1;
        if (!conv.patient_name && row.sender_name) conv.patient_name = row.sender_name;
        if (!conv.patient_email && row.sender_email) conv.patient_email = row.sender_email;
      }
      if (row.recipient_id === providerId && !row.read_at) {
        conv.unread_count += 1;
      }
    }

    const list = [...conversations.values()].sort(
      (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)
    );

    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

// GET /admin/appointment-messages/unread-summary
appointmentMessagesRouter.get("/unread-summary", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const { rows } = await query(
      `select thread_id, count(*)::int as unread_count
       from public.appointment_messages
       where recipient_id = $1 and read_at is null
       group by thread_id`,
      [me.id]
    );

    const by_thread = {};
    let total = 0;
    for (const row of rows) {
      const count = Number(row.unread_count || 0);
      by_thread[row.thread_id] = count;
      total += count;
    }

    return res.json({ total, by_thread });
  } catch (error) {
    return next(error);
  }
});

// GET /admin/appointment-messages?thread_id=
appointmentMessagesRouter.get("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const threadId = String(req.query.thread_id || "").trim();
    if (!threadId) return res.status(400).json({ error: "thread_id is required." });

    const access = await resolveThreadAccess(me, threadId);
    if (!access) return res.status(403).json({ error: "You are not a participant in this conversation." });

    const { rows } = await query(
      `select * from public.appointment_messages
       where thread_id = $1
       order by created_at asc`,
      [threadId]
    );

    return res.json(rows.map(mapMessageRow));
  } catch (error) {
    return next(error);
  }
});

// POST /admin/appointment-messages
appointmentMessagesRouter.post("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const body = req.body || {};
    const threadId = String(body.thread_id || body.appointment_id || "").trim();
    const recipientId = String(body.recipient_id || "").trim();
    let messageText = String(body.message || "").trim();
    const questionKey = String(body.question_key || "").trim() || null;

    if (!threadId) return res.status(400).json({ error: "thread_id is required." });
    if (!recipientId) return res.status(400).json({ error: "recipient_id is required." });
    if (recipientId === me.id) return res.status(400).json({ error: "Cannot send a message to yourself." });

    const access = await resolveThreadAccess(me, threadId);
    if (!access) return res.status(403).json({ error: "You are not allowed to message in this thread." });

    let storedQuestionKey = null;

    if (access.isPreBooking && isPatientRole(me.role)) {
      const answered = await listPatientPreBookingAnswers(query, threadId, me.id);

      if (allPreBookingQuestionsAnswered(answered)) {
        return res.status(429).json({
          error:
            "You have completed the pre-booking questions. Please book an appointment to continue the conversation.",
          code: "PRE_BOOKING_INQUIRY_COMPLETE",
        });
      }

      if (!questionKey || !isValidPreBookingQuestionKey(questionKey)) {
        const next = nextUnansweredQuestion(answered);
        return res.status(400).json({
          error: `Please answer the required question: ${next?.label || "inquiry form"}`,
          code: "PRE_BOOKING_QUESTION_REQUIRED",
          next_question_key: next?.key || null,
        });
      }

      if (answered.has(questionKey)) {
        return res.status(409).json({
          error: "You already answered this question.",
          code: "PRE_BOOKING_QUESTION_DUPLICATE",
        });
      }

      const expected = nextUnansweredQuestion(answered);
      if (expected && expected.key !== questionKey) {
        return res.status(400).json({
          error: `Please answer questions in order. Next: ${expected.label}`,
          code: "PRE_BOOKING_QUESTION_ORDER",
          next_question_key: expected.key,
        });
      }

      if (!messageText) {
        return res.status(400).json({ error: "Please provide an answer." });
      }

      storedQuestionKey = questionKey;
      messageText = formatPreBookingAnswerMessage(questionKey, messageText);
    } else {
      if (!messageText) return res.status(400).json({ error: "message is required." });
    }

    if (access.isPreBooking) {
      if (!isPatientRole(me.role) && !isProviderRole(me.role)) {
        return res.status(403).json({ error: "Forbidden." });
      }
      if (isPatientRole(me.role)) {
        if (access.providerId !== recipientId) {
          return res.status(403).json({ error: "Invalid recipient for this conversation." });
        }
        if (!access.legacy && access.patientId && access.patientId !== me.id) {
          return res.status(403).json({ error: "Invalid thread for this patient." });
        }
      }
      if (isProviderRole(me.role) && me.id !== access.providerId) {
        return res.status(403).json({ error: "Invalid thread for this provider." });
      }
    } else {
      const appt = access.appointment;
      const allowedRecipient =
        (me.id === appt.patient_id && recipientId === appt.provider_id) ||
        (me.id === appt.provider_id && recipientId === appt.patient_id);
      if (!allowedRecipient && !hasAdminAccess(me.role)) {
        return res.status(403).json({ error: "Invalid recipient for this appointment." });
      }
    }

    let recipientEmail = String(body.recipient_email || "").trim() || null;
    let recipientName = String(body.recipient_name || "").trim() || null;
    if (!recipientEmail || !recipientName) {
      if (access.appointment) {
        const appt = access.appointment;
        if (recipientId === appt.provider_id) {
          recipientEmail = recipientEmail || appt.provider_email || null;
          recipientName = recipientName || appt.provider_name || null;
        } else {
          recipientEmail = recipientEmail || appt.patient_email || null;
          recipientName = recipientName || appt.patient_name || null;
        }
      } else if (access.isPreBooking && isPatientRole(me.role)) {
        const { rows } = await query(
          `select email, full_name from public.users
           where auth_user_id::text = $1 or id::text = $1
           limit 1`,
          [access.providerId]
        );
        const u = rows[0];
        recipientEmail = recipientEmail || u?.email || null;
        recipientName = recipientName || u?.full_name || null;
      }
    }

    const senderName = String(body.sender_name || me.full_name || "").trim() || null;
    const senderRole = String(body.sender_role || me.role || "").trim().toLowerCase();

    const { rows } = await query(
      `insert into public.appointment_messages (
         thread_id, appointment_id, sender_id, sender_email, sender_name, sender_role,
         recipient_id, recipient_email, recipient_name, message, question_key
       ) values ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
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
        storedQuestionKey,
      ]
    );

    const created = mapMessageRow(rows[0]);

    let recipientRole = "provider";
    if (access.appointment) {
      recipientRole =
        recipientId === access.appointment.patient_id ? "patient" : "provider";
    } else if (access.isPreBooking) {
      recipientRole = isPatientRole(me.role) ? "provider" : "patient";
    } else if (isPatientRole(me.role)) {
      recipientRole = "provider";
    } else {
      recipientRole = "patient";
    }

    void notifyMessageRecipient({
      recipientId,
      recipientEmail,
      recipientRole,
      senderName,
      threadId,
      messageText,
      appointment: access.appointment || null,
    }).catch((err) => {
      console.warn("[appointment-messages] notification failed:", err?.message || err);
    });

    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

// PATCH /admin/appointment-messages/threads/:threadId/read
appointmentMessagesRouter.patch("/threads/:threadId/read", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const threadId = String(req.params.threadId || "").trim();
    if (!threadId) return res.status(400).json({ error: "threadId is required." });

    const access = await resolveThreadAccess(me, threadId);
    if (!access) return res.status(403).json({ error: "Forbidden." });

    await query(
      `update public.appointment_messages
       set read_at = now()
       where thread_id = $1 and recipient_id = $2 and read_at is null`,
      [threadId, me.id]
    );

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
