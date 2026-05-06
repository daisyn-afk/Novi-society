// Prepend "/api" to paths under /admin/ or /webhooks/ so API calls do not
// collide with React Router SPA routes (e.g. /admin dashboard page).
// Serverless functions live at /api/admin/[...path].js and /api/webhooks/[...path].js.
function toApiPath(path) {
  if (!path || typeof path !== "string") return path;
  if (path.startsWith("/api/")) return path;
  if (path.startsWith("/admin/") || path.startsWith("/webhooks/") || path.startsWith("/functions/")) {
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

    const debugWindow = parsed?.debug_window;
    const debugText = debugWindow
      ? `\nNow: ${debugWindow.now || "n/a"}\nStart: ${debugWindow.start_at || "n/a"}\nEnd: ${debugWindow.end_at || "n/a"}\nExpires: ${debugWindow.expires_at || "n/a"}\nSelected Course: ${debugWindow.selected_course_id || "n/a"}\nSelected Session Date: ${debugWindow.selected_session_date || "n/a"}\nMatched Course: ${debugWindow.matched_course_id || "n/a"}\nMatched Session Date: ${debugWindow.matched_session_date || "n/a"}`
      : "";
    const error = new Error(`${parsed.error || raw || `Request failed: ${response.status}`}${debugText}`);
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
          update: (id, payload) => authRequest(`/admin/pre-orders/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(payload || {})
          }),
          delete: createNotImplementedMethod("entities.PreOrder.delete"),
          filter: async (filters = {}, _sort = "", limit = 200) => {
            const all = await authRequest(`/admin/pre-orders?limit=${encodeURIComponent(String(limit || 200))}`, { method: "GET" });
            const rows = Array.isArray(all) ? all : [];
            const orderType = filters?.order_type ? String(filters.order_type) : "";
            const status = filters?.status ? String(filters.status) : "";
            return rows.filter((row) => {
              if (orderType && String(row?.order_type || "") !== orderType) return false;
              if (status && String(row?.status || "") !== status) return false;
              return true;
            });
          }
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
      if (name === "Certification") {
        return {
          list: () => authRequest("/admin/certifications", { method: "GET" }),
          filter: async (filters = {}) => {
            const all = await authRequest("/admin/certifications", { method: "GET" });
            const providerId = filters?.provider_id ? String(filters.provider_id) : "";
            const providerEmail = filters?.provider_email ? String(filters.provider_email).toLowerCase() : "";
            const status = filters?.status ? String(filters.status).toLowerCase() : "";
            return (all || []).filter((row) => {
              if (providerId && String(row?.provider_id || "") !== providerId) return false;
              if (providerEmail && String(row?.provider_email || "").toLowerCase() !== providerEmail) return false;
              if (status && String(row?.status || "").toLowerCase() !== status) return false;
              return true;
            });
          },
          get: (id) => authRequest(`/admin/certifications/${encodeURIComponent(id)}`, { method: "GET" }),
          create: (payload) => authRequest("/admin/certifications", {
            method: "POST",
            body: JSON.stringify(payload || {})
          }),
          update: (id, payload) => authRequest(`/admin/certifications/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(payload || {})
          }),
          delete: createNotImplementedMethod("entities.Certification.delete")
        };
      }
      if (name === "ClassSession") {
        return {
          list: () => authRequest("/admin/class-sessions", { method: "GET" }),
          create: (payload) => authRequest("/admin/class-sessions", {
            method: "POST",
            body: JSON.stringify(payload || {})
          }),
          update: (id, payload) => authRequest(`/admin/class-sessions/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(payload || {})
          }),
          get: createNotImplementedMethod("entities.ClassSession.get"),
          delete: createNotImplementedMethod("entities.ClassSession.delete"),
          filter: async (filters = {}) => {
            const all = await authRequest("/admin/class-sessions", { method: "GET" });
            const providerId = filters?.provider_id ? String(filters.provider_id) : "";
            const providerEmail = filters?.provider_email ? String(filters.provider_email).toLowerCase() : "";
            const courseId = filters?.course_id ? String(filters.course_id) : "";
            const enrollmentId = filters?.enrollment_id ? String(filters.enrollment_id) : "";
            const sessionCode = filters?.session_code ? String(filters.session_code).toUpperCase() : "";
            const sessionDate = filters?.session_date ? String(filters.session_date) : "";
            const hasCodeUsed = Object.prototype.hasOwnProperty.call(filters || {}, "code_used");
            const codeUsed = hasCodeUsed ? Boolean(filters.code_used) : null;
            return (all || []).filter((row) => {
              if (providerId && String(row?.provider_id || "") !== providerId) return false;
              if (providerEmail && String(row?.provider_email || "").toLowerCase() !== providerEmail) return false;
              if (courseId && String(row?.course_id || "") !== courseId) return false;
              if (enrollmentId && String(row?.enrollment_id || "") !== enrollmentId) return false;
              if (sessionCode && String(row?.session_code || "").toUpperCase() !== sessionCode) return false;
              if (sessionDate && String(row?.session_date || "") !== sessionDate) return false;
              if (hasCodeUsed && Boolean(row?.code_used) !== codeUsed) return false;
              return true;
            });
          }
        };
      }
      if (name === "Course") {
        return {
          list: () => authRequest("/admin/courses", { method: "GET" }),
          filter: async (filters = {}) => {
            const all = await authRequest("/admin/courses", { method: "GET" });
            const rows = Array.isArray(all) ? all : [];
            const type = filters?.type ? String(filters.type) : "";
            return rows.filter((row) => {
              if (type && String(row?.type || "") !== type) return false;
              return true;
            });
          },
          get: (id) => authRequest(`/admin/courses/${encodeURIComponent(id)}`, { method: "GET" }),
          create: (payload) => authRequest("/admin/courses", {
            method: "POST",
            body: JSON.stringify(payload || {})
          }),
          update: (id, payload) => authRequest(`/admin/courses/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(payload || {})
          }),
          delete: (id) => authRequest(`/admin/courses/${encodeURIComponent(id)}`, { method: "DELETE" })
        };
      }
      if (name === "Enrollment") {
        return {
          list: () => authRequest("/admin/enrollments", { method: "GET" }),
          filter: async (filters = {}) => {
            const all = await authRequest("/admin/enrollments", { method: "GET" });
            const providerId = filters?.provider_id ? String(filters.provider_id) : "";
            const providerEmail = filters?.provider_email ? String(filters.provider_email).toLowerCase() : "";
            const status = filters?.status ? String(filters.status) : "";
            return (all || []).filter((row) => {
              if (providerId && String(row?.provider_id || "") !== providerId) return false;
              if (providerEmail && String(row?.provider_email || "").toLowerCase() !== providerEmail) return false;
              if (status && String(row?.status || "") !== status) return false;
              return true;
            });
          },
          update: (id, payload) => authRequest(`/admin/enrollments/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(payload || {})
          }),
          get: createNotImplementedMethod("entities.Enrollment.get"),
          create: createNotImplementedMethod("entities.Enrollment.create"),
          delete: createNotImplementedMethod("entities.Enrollment.delete")
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
        return {
          data: await authRequest(`/functions/${functionName}`, {
            method: "POST",
            body: JSON.stringify(payload || {})
          })
        };
      }
    },
    integrations: {
      Core: {
        UploadFile: async ({ file }) => {
          if (!file) throw new Error("[lovable-provider] Upload file is required.");
          const token = getStoredAccessToken();
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch(`${ADMIN_API_BASE_URL}${toApiPath("/admin/uploads/license-photo")}`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData
          });
          if (!response.ok) {
            const raw = await response.text().catch(() => "");
            let parsed = {};
            try {
              parsed = raw ? JSON.parse(raw) : {};
            } catch {
              parsed = {};
            }
            throw new Error(parsed.error || raw || `[lovable-provider] upload failed (${response.status})`);
          }
          const payload = await response.json();
          const fileUrl = payload?.file_url || payload?.url || payload?.public_url || "";
          if (!fileUrl) {
            throw new Error("[lovable-provider] upload succeeded but no file URL was returned.");
          }
          return {
            ...payload,
            file_url: fileUrl
          };
        }
      }
    }
  };
}

