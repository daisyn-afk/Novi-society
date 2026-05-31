import { useQuery } from "@tanstack/react-query";
import { appointmentMessagesApi } from "@/api/appointmentMessagesApi";
import { parsePreBookingThreadId } from "@/lib/appointmentMessageThreads";

export function useAppointmentMessageUnread(options = {}) {
  const { enabled = true, ...queryOptions } = options;
  return useQuery({
    queryKey: ["appointment-message-unread"],
    queryFn: () => appointmentMessagesApi.getUnreadSummary(),
    refetchInterval: 5000,
    staleTime: 4000,
    refetchOnWindowFocus: true,
    enabled,
    ...queryOptions,
  });
}

export function unreadCountForThread(summary, threadId) {
  const byThread = summary?.by_thread || {};
  return Number(byThread[String(threadId || "")] || 0);
}

/** Unread messages grouped by patient (sums across that patient's appointment threads). */
export function unreadMessagesByPatient(appointments, summary) {
  const byThread = summary?.by_thread || {};
  const patientMap = new Map();

  for (const appt of appointments || []) {
    const count = Number(byThread[String(appt.id)] || 0);
    if (count <= 0) continue;
    const key = String(appt.patient_id || appt.patient_email || appt.id);
    const existing = patientMap.get(key) || {
      key,
      patient_id: appt.patient_id,
      patient_name: appt.patient_name,
      patient_email: appt.patient_email,
      unread: 0,
    };
    existing.unread += count;
    if (!existing.patient_name && appt.patient_name) existing.patient_name = appt.patient_name;
    if (!existing.patient_email && appt.patient_email) existing.patient_email = appt.patient_email;
    patientMap.set(key, existing);
  }

  for (const [threadId, count] of Object.entries(byThread)) {
    const pre = parsePreBookingThreadId(threadId);
    if (!pre) continue;
    const n = Number(count || 0);
    if (n <= 0) continue;
    const key = pre.patientId ? `patient:${pre.patientId}` : threadId;
    if (pre.patientId && patientMap.has(key)) {
      const existing = patientMap.get(key);
      existing.unread += n;
      continue;
    }
    patientMap.set(key, {
      key,
      patient_id: pre.patientId,
      patient_name: pre.patientId ? "Marketplace inquiry" : "Marketplace inquiry",
      patient_email: null,
      unread: n,
      isPreBooking: true,
      thread_id: threadId,
    });
  }

  return [...patientMap.values()].sort((a, b) => b.unread - a.unread);
}
