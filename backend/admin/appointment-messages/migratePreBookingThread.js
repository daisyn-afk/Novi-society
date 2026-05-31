import {
  buildPreBookingThreadId,
  legacyPreBookingThreadId,
} from "./preBookingThreads.js";

/**
 * Moves marketplace pre-booking messages into the real appointment thread
 * so the conversation continues after the patient books.
 */
export async function migratePreBookingMessagesToAppointment(
  query,
  { providerId, patientId, appointmentId }
) {
  const apptId = String(appointmentId || "").trim();
  const pid = String(providerId || "").trim();
  const ptid = String(patientId || "").trim();
  if (!apptId || !pid || !ptid) return { migrated: 0 };

  let migrated = 0;

  const perPatientThread = buildPreBookingThreadId(pid, ptid);
  if (perPatientThread) {
    const { rowCount } = await query(
      `update public.appointment_messages
       set thread_id = $1,
           appointment_id = $1
       where thread_id = $2`,
      [apptId, perPatientThread]
    );
    migrated += Number(rowCount || 0);
  }

  const legacyThread = legacyPreBookingThreadId(pid);
  if (legacyThread) {
    const { rowCount } = await query(
      `update public.appointment_messages
       set thread_id = $1,
           appointment_id = $1
       where thread_id = $2
         and sender_id = $3`,
      [apptId, legacyThread, ptid]
    );
    migrated += Number(rowCount || 0);
  }

  return { migrated };
}
