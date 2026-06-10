const ACCESS_TOKEN_KEY = "novi_auth_access_token";
const REFRESH_TOKEN_KEY = "novi_auth_refresh_token";

const STORAGE_KEYS = {
  until: "novi_master_login_until",
  target: "novi_master_login_target",
  backupAccess: "novi_auth_admin_backup_access_token",
  backupRefresh: "novi_auth_admin_backup_refresh_token",
};

export const MASTER_LOGIN_DURATION_MS = 5 * 60 * 1000;

function readSessionStorage(key) {
  try {
    return window.sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeSessionStorage(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

function removeSessionStorage(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

export function startMasterLoginSession({ session, targetUser, expiresAt, adminTokens }) {
  if (!session?.access_token || !adminTokens?.access_token) {
    throw new Error("Missing session data for master login.");
  }

  const untilMs = expiresAt ? Date.parse(expiresAt) : Date.now() + MASTER_LOGIN_DURATION_MS;

  writeSessionStorage(STORAGE_KEYS.backupAccess, adminTokens.access_token);
  if (adminTokens.refresh_token) {
    writeSessionStorage(STORAGE_KEYS.backupRefresh, adminTokens.refresh_token);
  }
  writeSessionStorage(STORAGE_KEYS.until, String(untilMs));
  writeSessionStorage(STORAGE_KEYS.target, JSON.stringify(targetUser || {}));

  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
  if (session.refresh_token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
  }
}

export function getMasterLoginState() {
  const until = Number(readSessionStorage(STORAGE_KEYS.until) || 0);
  if (!until || Date.now() >= until) return null;

  let target = null;
  try {
    target = JSON.parse(readSessionStorage(STORAGE_KEYS.target) || "null");
  } catch {
    target = null;
  }

  return {
    until,
    target,
    remainingMs: Math.max(0, until - Date.now()),
  };
}

export function isMasterLoginActive() {
  return Boolean(getMasterLoginState());
}

export function endMasterLoginSession() {
  const backupAccess = readSessionStorage(STORAGE_KEYS.backupAccess);
  const backupRefresh = readSessionStorage(STORAGE_KEYS.backupRefresh);

  removeSessionStorage(STORAGE_KEYS.until);
  removeSessionStorage(STORAGE_KEYS.target);
  removeSessionStorage(STORAGE_KEYS.backupAccess);
  removeSessionStorage(STORAGE_KEYS.backupRefresh);

  if (backupAccess) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, backupAccess);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (backupRefresh) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, backupRefresh);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function expireMasterLoginIfNeeded() {
  const until = Number(readSessionStorage(STORAGE_KEYS.until) || 0);
  if (!until) return false;
  if (Date.now() < until) return false;
  endMasterLoginSession();
  return true;
}
