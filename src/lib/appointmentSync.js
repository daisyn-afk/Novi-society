/** Cross-tab signal so provider Practice Hub refetches appointments right after a patient books. */
export const APPOINTMENTS_REFRESH_STORAGE_KEY = "novi:appointments-refresh-at";
export const APPOINTMENTS_REFRESH_EVENT = "novi:appointments-refresh";

export function broadcastAppointmentsRefresh() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APPOINTMENTS_REFRESH_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore private mode / quota
  }
  window.dispatchEvent(new CustomEvent(APPOINTMENTS_REFRESH_EVENT));
}

export function subscribeAppointmentsRefresh(callback) {
  if (typeof window === "undefined") return () => {};

  const onEvent = () => callback();
  const onStorage = (event) => {
    if (event.key === APPOINTMENTS_REFRESH_STORAGE_KEY) callback();
  };

  window.addEventListener(APPOINTMENTS_REFRESH_EVENT, onEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(APPOINTMENTS_REFRESH_EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}
