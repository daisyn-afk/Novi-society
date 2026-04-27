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

function resolveAdminApiBaseUrl() {
  const raw = (import.meta.env.VITE_APP_API_BASE_URL || "").trim();
  // In dev, always route through the Vite proxy (relative URLs) so the `/api`
  // prefix gets stripped before reaching the Express server. A localhost base
  // URL in .env would bypass the proxy and 404 on the `/api/*` mount path.
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

async function postJson(path, payload) {
  const response = await fetch(`${ADMIN_API_BASE_URL}${toApiPath(path)}`, {
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
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (includeAuth) {
    const token = getStoredAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${ADMIN_API_BASE_URL}${toApiPath(path)}`, {
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
const ACCESS_TOKEN_KEY = "novi_auth_access_token";
const REFRESH_TOKEN_KEY = "novi_auth_refresh_token";
const RECOVERY_HASH_KEY = "novi_recovery_hash";

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

function parseRecoveryHash(rawHash) {
  const source = typeof rawHash === "string" ? rawHash : "";
  const hash = source.startsWith("#") ? source.slice(1) : source;
  const params = new URLSearchParams(hash);
  const type = String(params.get("type") || "").toLowerCase();
  const accessToken = params.get("access_token") || "";
  const refreshToken = params.get("refresh_token") || "";
  const isPasswordSetupFlow = type === "recovery" || type === "invite";
  if (!isPasswordSetupFlow || !accessToken) return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken
  };
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
      if (name === "License") {
        return {
          list: (_sort = "", limit = 200) =>
            authRequest(`/admin/licenses?limit=${encodeURIComponent(String(limit || 200))}`, { method: "GET" }),
          get: (id) => authRequest(`/admin/licenses/${encodeURIComponent(id)}`, { method: "GET" }),
          create: (payload) => authRequest("/admin/licenses", {
            method: "POST",
            body: JSON.stringify(payload || {})
          }),
          update: (id, payload) => authRequest(`/admin/licenses/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(payload || {})
          }),
          delete: createNotImplementedMethod("entities.License.delete"),
          filter: (filters = {}) => {
            const params = new URLSearchParams();
            if (Object.hasOwn(filters, "provider_id") && filters.provider_id) {
              params.set("provider_id", String(filters.provider_id));
            }
            if (Object.hasOwn(filters, "provider_email") && filters.provider_email) {
              params.set("provider_email", String(filters.provider_email));
            }
            if (Object.hasOwn(filters, "status") && filters.status) {
              params.set("status", String(filters.status));
            }
            const qs = params.toString();
            return authRequest(`/admin/licenses${qs ? `?${qs}` : ""}`, { method: "GET" });
          }
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
      setPassword: async ({ access_token, refresh_token, password, confirm_password }) => authRequest("/admin/auth/set-password", {
        method: "POST",
        body: JSON.stringify({
          access_token,
          refresh_token,
          password,
          confirm_password
        })
      }),
      storeSession: ({ access_token, refresh_token }) => {
        storeAuthSession({
          access_token,
          refresh_token
        });
      },
      consumeRecoveryHash: (rawHash) => {
        const parsed = parseRecoveryHash(rawHash ?? window.location.hash);
        if (!parsed) return null;
        try {
          window.sessionStorage.setItem(RECOVERY_HASH_KEY, rawHash ?? window.location.hash);
        } catch {
          // ignore storage failures
        }
        storeAuthSession(parsed);
        return parsed;
      },
      getStoredRecoveryHash: () => {
        try {
          return window.sessionStorage.getItem(RECOVERY_HASH_KEY) || "";
        } catch {
          return "";
        }
      },
      clearStoredRecoveryHash: () => {
        try {
          window.sessionStorage.removeItem(RECOVERY_HASH_KEY);
        } catch {
          // ignore storage failures
        }
      },
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

