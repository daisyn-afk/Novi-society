/** Pre-booking marketplace inquiry — one answer per question, then book to continue. */

export const PRE_BOOKING_QUESTIONS = [
  {
    key: "service_interest",
    label: "What service or treatment are you interested in?",
    placeholder: "e.g. Botox, filler, laser, consultation…",
  },
  {
    key: "preferred_timing",
    label: "When would you like to schedule your visit?",
    placeholder: "e.g. Next week, Saturday mornings, flexible…",
  },
  {
    key: "prior_treatment",
    label: "Have you received this treatment before?",
    placeholder: "Yes/no and any relevant history…",
  },
  {
    key: "goals_concerns",
    label: "What results or concerns would you like the provider to know about?",
    placeholder: "Share your goals or questions…",
  },
  {
    key: "health_background",
    label: "Any allergies, medications, or health conditions relevant to this treatment?",
    placeholder: "List any the provider should know, or type “none”…",
  },
];

const QUESTION_KEYS = new Set(PRE_BOOKING_QUESTIONS.map((q) => q.key));

export function isValidPreBookingQuestionKey(key) {
  return QUESTION_KEYS.has(String(key || "").trim());
}

export function getPreBookingQuestion(key) {
  return PRE_BOOKING_QUESTIONS.find((q) => q.key === key) || null;
}

export function formatPreBookingAnswerMessage(questionKey, answerText) {
  const q = getPreBookingQuestion(questionKey);
  const label = q?.label || questionKey;
  return `${label}\n${String(answerText || "").trim()}`;
}

export async function listPatientPreBookingAnswers(query, threadId, patientId) {
  const { rows } = await query(
    `select question_key
     from public.appointment_messages
     where thread_id = $1
       and sender_id = $2
       and lower(coalesce(sender_role, '')) = 'patient'
       and question_key is not null
       and question_key <> ''`,
    [threadId, patientId]
  );
  return new Set(rows.map((r) => String(r.question_key)));
}

export function allPreBookingQuestionsAnswered(answeredKeys) {
  return PRE_BOOKING_QUESTIONS.every((q) => answeredKeys.has(q.key));
}

export function nextUnansweredQuestion(answeredKeys) {
  return PRE_BOOKING_QUESTIONS.find((q) => !answeredKeys.has(q.key)) || null;
}
