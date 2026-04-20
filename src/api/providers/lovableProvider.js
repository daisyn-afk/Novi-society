import { apiRuntimeConfig } from "@/api/runtimeConfig";

function createNotImplementedMethod(path) {
  return async () => {
    throw new Error(
      `[lovable-provider] "${path}" is not implemented yet. ` +
      "Keep VITE_APP_API_PROVIDER=base44 until this endpoint is migrated."
    );
  };
}

async function postJson(path, payload) {
  const baseUrl = apiRuntimeConfig.apiBaseUrl;
  if (!baseUrl) {
    throw new Error(
      "[lovable-provider] VITE_APP_API_BASE_URL is required when VITE_APP_API_PROVIDER=lovable."
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {})
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[lovable-provider] ${response.status} ${text}`);
  }

  return response.json();
}

function resolveAdminApiBaseUrl() {
  const raw = (import.meta.env.VITE_APP_API_BASE_URL || "").trim();
  if (!import.meta.env.DEV) return raw;
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1") return "";
  } catch {
    return raw;
  }
  return raw;
}

const ADMIN_API_BASE_URL = resolveAdminApiBaseUrl();
const ACCESS_TOKEN_KEY = "novi_auth_access_token";
const REFRESH_TOKEN_KEY = "novi_auth_refresh_token";

function getStoredAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

function hasStoredSession() {
  return Boolean(getStoredAccessToken());
}

function storeAuthSession(session) {
  if (session?.access_token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
  }
  if (session?.refresh_token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
  }
}

function clearAuthSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function authRequest(path, options = {}) {
  const token = getStoredAccessToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${ADMIN_API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    const error = new Error(parsed.error || raw || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

export function createLovableProviderClient() {
  const entityProxy = new Proxy(
    {},
    {
      get: (_, entityName) => ({
        list: createNotImplementedMethod(`entities.${String(entityName)}.list`),
        get: createNotImplementedMethod(`entities.${String(entityName)}.get`),
        create: createNotImplementedMethod(`entities.${String(entityName)}.create`),
        update: createNotImplementedMethod(`entities.${String(entityName)}.update`),
        delete: createNotImplementedMethod(`entities.${String(entityName)}.delete`),
        filter: createNotImplementedMethod(`entities.${String(entityName)}.filter`)
      })
    }
  );

  return {
    auth: {
      hasSession: () => hasStoredSession(),
      me: async () => authRequest("/admin/auth/me", { method: "GET" }),
      logout: (redirectTo) => {
        clearAuthSession();
        if (redirectTo) window.location.href = redirectTo;
      },
      redirectToLogin: () => {
        const next = encodeURIComponent(window.location.href);
        window.location.href = `/login?redirect=${next}`;
      },
      updateMe: async (payload) => authRequest("/admin/auth/me", {
        method: "PATCH",
        body: JSON.stringify(payload || {})
      }),
      login: async ({ email, password }) => {
        const result = await authRequest("/admin/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        storeAuthSession(result?.session);
        return result;
      },
      signup: async ({ first_name, last_name, email, password, confirm_password, role }) => {
        const result = await authRequest("/admin/auth/signup", {
          method: "POST",
          body: JSON.stringify({ first_name, last_name, email, password, confirm_password, role })
        });
        storeAuthSession(result?.session);
        return result;
      }
    },
    entities: entityProxy,
    appLogs: {
      logUserInApp: async () => ({ ok: true })
    },
    functions: {
      invoke: async (functionName, payload) =>
        postJson(`/functions/${functionName}`, payload)
    }
  };
}

