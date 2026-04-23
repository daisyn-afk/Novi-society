import { apiRuntimeConfig } from "@/api/runtimeConfig";

// Prepend "/api" to paths under /admin/ or /webhooks/ so API calls do not
// collide with React Router SPA routes (e.g. /admin dashboard page).
// Serverless functions live at /api/admin/[...path].js and /api/webhooks/[...path].js.
function toApiPath(path) {
  if (!path || typeof path !== "string") return path;
  if (path.startsWith("/api/")) return path;
  if (path.startsWith("/admin/") || path.startsWith("/webhooks/")) {
    return `/api${path}`;
  }
  return path;
}

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

  const response = await fetch(`${baseUrl}${toApiPath(path)}`, {
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

async function requestJson(path, options = {}, { includeAuth = false } = {}) {
  const baseUrl = apiRuntimeConfig.apiBaseUrl;
  if (!baseUrl) {
    throw new Error("[lovable-provider] VITE_APP_API_BASE_URL is required.");
  }
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (includeAuth) {
    const token = getStoredAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}${toApiPath(path)}`, {
    ...options,
    headers
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`[lovable-provider] ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
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

function getStoredRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY) || "";
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

async function tryRefreshAuthSession() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(`${ADMIN_API_BASE_URL}${toApiPath("/admin/auth/refresh")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  if (!response.ok) {
    clearAuthSession();
    return false;
  }

  const result = await response.json().catch(() => null);
  if (!result?.session?.access_token) {
    clearAuthSession();
    return false;
  }

  storeAuthSession(result.session);
  return true;
}

async function authRequest(path, options = {}, retryOnAuthError = true) {
  const token = getStoredAccessToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${ADMIN_API_BASE_URL}${toApiPath(path)}`, {
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

    if (response.status === 401 && retryOnAuthError) {
      const refreshed = await tryRefreshAuthSession();
      if (refreshed) {
        return authRequest(path, options, false);
      }
    }

    const error = new Error(parsed.error || raw || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

export function createLovableProviderClient() {
  const entityProxy = new Proxy({}, {
    get: (_, entityName) => {
      const name = String(entityName);
      if (name === "ServiceType") {
        return {
          list: () => authRequest("/admin/service-types", { method: "GET" }),
          get: (id) => authRequest(`/admin/service-types/${id}`, { method: "GET" }),
          create: (payload) => authRequest("/admin/service-types", {
            method: "POST",
            body: JSON.stringify(payload || {})
          }),
          update: (id, payload) => authRequest(`/admin/service-types/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload || {})
          }),
          delete: (id) => authRequest(`/admin/service-types/${id}`, { method: "DELETE" }),
          filter: (filters = {}) => {
            const params = new URLSearchParams();
            if (Object.hasOwn(filters, "is_active")) {
              params.set("is_active", String(Boolean(filters.is_active)));
            }
            const qs = params.toString();
            return requestJson(`/admin/service-types${qs ? `?${qs}` : ""}`, { method: "GET" });
          }
        };
      }
      if (name === "PreOrder") {
        return {
          list: (_sort = "", limit = 200) => authRequest(`/admin/pre-orders?limit=${encodeURIComponent(String(limit || 200))}`, { method: "GET" }),
          get: (id) => requestJson(`/admin/checkout/pre-order?id=${encodeURIComponent(id)}`, { method: "GET" }),
          create: createNotImplementedMethod("entities.PreOrder.create"),
          update: createNotImplementedMethod("entities.PreOrder.update"),
          delete: createNotImplementedMethod("entities.PreOrder.delete"),
          filter: createNotImplementedMethod("entities.PreOrder.filter")
        };
      }
      return {
        list: createNotImplementedMethod(`entities.${name}.list`),
        get: createNotImplementedMethod(`entities.${name}.get`),
        create: createNotImplementedMethod(`entities.${name}.create`),
        update: createNotImplementedMethod(`entities.${name}.update`),
        delete: createNotImplementedMethod(`entities.${name}.delete`),
        filter: createNotImplementedMethod(`entities.${name}.filter`)
      };
    }
  });

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
      invoke: async (functionName, payload) => {
        if (functionName === "createPreOrderCheckout") {
          if (payload?.pre_order_id) {
            throw new Error("[lovable-provider] createPreOrderCheckout with pre_order_id is not implemented yet.");
          }
          return {
            data: await requestJson("/admin/checkout/service", {
              method: "POST",
              body: JSON.stringify(payload || {})
            })
          };
        }
        if (functionName === "approvePreOrder") {
          return {
            data: await authRequest("/admin/pre-orders/action", {
              method: "POST",
              body: JSON.stringify(payload || {})
            })
          };
        }
        return postJson(`/functions/${functionName}`, payload);
      }
    }
  };
}

