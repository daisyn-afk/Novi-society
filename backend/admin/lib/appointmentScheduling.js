function todayDateKey() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** True when appointment date/time is before now (server local timezone). */
export function isAppointmentInPast(appointmentDate, appointmentTime = "09:00") {
  const dateStr = String(appointmentDate || "").trim();
  if (!dateStr) return true;
  const todayStr = todayDateKey();
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;
  const timeStr = String(appointmentTime || "09:00").trim();
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  const now = new Date();
  return h < now.getHours() || (h === now.getHours() && m < now.getMinutes());
}
