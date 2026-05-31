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

export function getPreBookingQuestion(key) {
  return PRE_BOOKING_QUESTIONS.find((q) => q.key === key) || null;
}

/** @param {Array} messages @param {string} patientId */
export function getAnsweredQuestionKeys(messages, patientId) {
  const keys = new Set();
  for (const m of messages || []) {
    if (m.sender_id !== patientId) continue;
    const qk = String(m.question_key || "").trim();
    if (qk) keys.add(qk);
  }
  return keys;
}

export function nextUnansweredQuestion(answeredKeys) {
  return PRE_BOOKING_QUESTIONS.find((q) => !answeredKeys.has(q.key)) || null;
}

export function allPreBookingQuestionsAnswered(answeredKeys) {
  return PRE_BOOKING_QUESTIONS.every((q) => answeredKeys.has(q.key));
}
