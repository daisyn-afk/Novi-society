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
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    const isLocalTarget = h === "localhost" || h === "127.0.0.1";

    // In dev, always use Vite proxy for localhost backends.
    if (import.meta.env.DEV && isLocalTarget) return "";

    // In production, never call the end user's localhost.
    if (!import.meta.env.DEV && isLocalTarget && typeof window !== "undefined") {
      const currentHost = String(window.location.hostname || "").toLowerCase();
      const isCurrentHostLocal = currentHost === "localhost" || currentHost === "127.0.0.1";
      if (!isCurrentHostLocal) return "";
    }
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

function sortEntityRows(rows, sortSpec = "") {
  if (!sortSpec || !Array.isArray(rows)) return rows || [];
  const desc = sortSpec.startsWith("-");
  const rawField = desc ? sortSpec.slice(1) : sortSpec;
  const dateFieldMap = { created_date: "created_at", updated_date: "updated_at" };
  const field = dateFieldMap[rawField] || rawField;
  return [...rows].sort((a, b) => {
    const av = a[field] ?? "";
    const bv = b[field] ?? "";
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function buildEntityQuery(filters = {}, limit) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters || {})) {
    if (value != null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  }
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
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
      if (name === "EmailTemplate") {
        return {
          list: (_sort = "") => authRequest("/admin/email-templates", { method: "GET" }),
          filter: (_filters = {}, _sort = "") =>
            authRequest("/admin/email-templates", { method: "GET" }),
          get: (key) =>
            authRequest(`/admin/email-templates/${encodeURIComponent(String(key || ""))}`, {
              method: "GET",
            }),
          update: (key, payload) =>
            authRequest(`/admin/email-templates/${encodeURIComponent(String(key || ""))}`, {
              method: "PUT",
              body: JSON.stringify(payload || {}),
            }),
          create: (payload = {}) => {
            const key = String(payload.template_key || "").trim();
            if (!key) {
              return Promise.reject(
                new Error("EmailTemplate.create requires payload.template_key matching a registered template.")
              );
            }
            return authRequest(`/admin/email-templates/${encodeURIComponent(key)}`, {
              method: "PUT",
              body: JSON.stringify(payload || {}),
            });
          },
          delete: (key) =>
            authRequest(`/admin/email-templates/${encodeURIComponent(String(key || ""))}`, {
              method: "DELETE",
            }),
          setActive: (key, isActive) =>
            authRequest(`/admin/email-templates/${encodeURIComponent(String(key || ""))}/active`, {
              method: "PATCH",
              body: JSON.stringify({ is_active: Boolean(isActive) }),
            }),
          preview: (key, payload = {}) =>
            authRequest(`/admin/email-templates/${encodeURIComponent(String(key || ""))}/preview`, {
              method: "POST",
              body: JSON.stringify(payload || {}),
            }),
          categories: () => authRequest("/admin/email-templates/categories", { method: "GET" }),
          placeholders: () => authRequest("/admin/email-templates/placeholders", { method: "GET" }),
        };
      }
      if (name === "Manufacturer") {
        return {
          list: () => authRequest("/admin/manufacturers", { method: "GET" }),
          get: (id) => authRequest(`/admin/manufacturers/${encodeURIComponent(id)}`, { method: "GET" }),
          create: (payload) => authRequest("/admin/manufacturers", {
            method: "POST",
            body: JSON.stringify(payload || {})
          }),
          update: (id, payload) => authRequest(`/admin/manufacturers/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(payload || {})
          }),
          delete: (id) => authRequest(`/admin/manufacturers/${encodeURIComponent(id)}`, { method: "DELETE" }),
          filter: (filters = {}) => {
            const params = new URLSearchParams();
            if (Object.hasOwn(filters, "is_active")) {
              params.set("is_active", String(Boolean(filters.is_active)));
            }
            if (Object.hasOwn(filters, "is_featured")) {
              params.set("is_featured", String(Boolean(filters.is_featured)));
            }
            if (filters.category) {
              params.set("category", String(filters.category));
            }
            const qs = params.toString();
            return authRequest(`/admin/manufacturers${qs ? `?${qs}` : ""}`, { method: "GET" });
          }
        };
      }
      if (name === "ManufacturerApplication") {
        const buildQuery = (filters = {}, sort = "-submitted_at") => {
          const params = new URLSearchParams();
          if (filters.provider_id) params.set("provider_id", String(filters.provider_id));
          if (filters.manufacturer_id) params.set("manufacturer_id", String(filters.manufacturer_id));
          if (filters.status) params.set("status", String(filters.status));
          if (sort) params.set("sort", String(sort));
          const qs = params.toString();
          return qs ? `?${qs}` : "";
        };
        return {
          list: (sort = "-submitted_at") =>
            authRequest(`/admin/manufacturer-applications${buildQuery({}, sort)}`, { method: "GET" }),
          filter: (filters = {}, sort = "-submitted_at") =>
            authRequest(`/admin/manufacturer-applications${buildQuery(filters, sort)}`, { method: "GET" }),
          get: (id) =>
            authRequest(`/admin/manufacturer-applications/${encodeURIComponent(id)}`, { method: "GET" }),
          update: (id, payload) =>
            authRequest(`/admin/manufacturer-applications/${encodeURIComponent(id)}`, {
              method: "PATCH",
              body: JSON.stringify(payload || {})
            }),
          create: createNotImplementedMethod(
            "entities.ManufacturerApplication.create (use functions.invoke('sendManufacturerInquiry') instead)"
          ),
          delete: createNotImplementedMethod("entities.ManufacturerApplication.delete")
        };
      }
      if (name === "ProviderInventory") {
        const buildInventoryQuery = (filters = {}) => {
          const params = new URLSearchParams();
          if (filters.provider_id) params.set("provider_id", String(filters.provider_id));
          if (filters.manufacturer_id) params.set("manufacturer_id", String(filters.manufacturer_id));
          const qs = params.toString();
          return qs ? `?${qs}` : "";
        };
        return {
          list: (_sort = "-created_date") =>
            authRequest(`/admin/manufacturer-order-requests/inventory-lines${buildInventoryQuery({})}`, { method: "GET" }),
          filter: (filters = {}, _sort = "-created_date") =>
            authRequest(`/admin/manufacturer-order-requests/inventory-lines${buildInventoryQuery(filters)}`, { method: "GET" }),
          get: createNotImplementedMethod("entities.ProviderInventory.get"),
          create: createNotImplementedMethod("entities.ProviderInventory.create"),
          update: createNotImplementedMethod("entities.ProviderInventory.update"),
          delete: createNotImplementedMethod("entities.ProviderInventory.delete"),
        };
      }
      if (name === "ProviderManufacturerRep") {
        const buildRepQuery = (filters = {}) => {
          const params = new URLSearchParams();
          if (filters.manufacturer_id) params.set("manufacturer_id", String(filters.manufacturer_id));
          if (filters.provider_id) params.set("provider_id", String(filters.provider_id));
          const qs = params.toString();
          return qs ? `?${qs}` : "";
        };
        return {
          list: () => authRequest("/admin/provider-manufacturer-reps", { method: "GET" }),
          filter: (filters = {}) =>
            authRequest(`/admin/provider-manufacturer-reps${buildRepQuery(filters)}`, { method: "GET" }),
          lookup: (filters = {}) =>
            authRequest(`/admin/provider-manufacturer-reps/lookup${buildRepQuery(filters)}`, { method: "GET" }),
          upsert: (payload) =>
            authRequest("/admin/provider-manufacturer-reps", {
              method: "PUT",
              body: JSON.stringify(payload || {}),
            }),
          get: createNotImplementedMethod("entities.ProviderManufacturerRep.get"),
          create: createNotImplementedMethod("entities.ProviderManufacturerRep.create (use upsert instead)"),
          update: createNotImplementedMethod("entities.ProviderManufacturerRep.update (use upsert instead)"),
          delete: createNotImplementedMethod("entities.ProviderManufacturerRep.delete"),
        };
      }
      if (name === "ProviderRepCall") {
        const buildCallQuery = (filters = {}) => {
          const params = new URLSearchParams();
          if (filters.manufacturer_id) params.set("manufacturer_id", String(filters.manufacturer_id));
          if (filters.provider_id) params.set("provider_id", String(filters.provider_id));
          if (filters.upcoming) params.set("upcoming", "true");
          const qs = params.toString();
          return qs ? `?${qs}` : "";
        };
        return {
          list: () => authRequest("/admin/provider-rep-calls?upcoming=true", { method: "GET" }),
          filter: (filters = {}) =>
            authRequest(`/admin/provider-rep-calls${buildCallQuery(filters)}`, { method: "GET" }),
          get: createNotImplementedMethod("entities.ProviderRepCall.get"),
          create: createNotImplementedMethod(
            "entities.ProviderRepCall.create (use functions.invoke('scheduleRepCall') instead)"
          ),
          update: createNotImplementedMethod("entities.ProviderRepCall.update"),
          delete: createNotImplementedMethod("entities.ProviderRepCall.delete"),
        };
      }
      if (name === "ManufacturerOrderRequest") {
        const buildQuery = (filters = {}, sort = "-created_at") => {
          const params = new URLSearchParams();
          if (filters.provider_id) params.set("provider_id", String(filters.provider_id));
          if (filters.manufacturer_id) params.set("manufacturer_id", String(filters.manufacturer_id));
          if (filters.contact_type) params.set("contact_type", String(filters.contact_type));
          if (sort) params.set("sort", String(sort));
          const qs = params.toString();
          return qs ? `?${qs}` : "";
        };
        return {
          list: (sort = "-created_at") =>
            authRequest(`/admin/manufacturer-order-requests${buildQuery({}, sort)}`, { method: "GET" }),
          filter: (filters = {}, sort = "-created_at") =>
            authRequest(`/admin/manufacturer-order-requests${buildQuery(filters, sort)}`, { method: "GET" }),
          get: createNotImplementedMethod("entities.ManufacturerOrderRequest.get"),
          create: createNotImplementedMethod(
            "entities.ManufacturerOrderRequest.create (use functions.invoke('sendRepContactEmail') instead)"
          ),
          update: createNotImplementedMethod("entities.ManufacturerOrderRequest.update"),
          delete: createNotImplementedMethod("entities.ManufacturerOrderRequest.delete"),
        };
      }
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
      if (name === "PromoCode") {
        return {
          list: () => requestJson("/admin/promo-codes", { method: "GET" }),
          filter: async (filters = {}) => {
            const all = await requestJson("/admin/promo-codes", { method: "GET" });
            const rows = Array.isArray(all) ? all : [];
            const code = filters?.code ? String(filters.code).trim().toUpperCase() : "";
            const requireActive = filters?.is_active === true;
            return rows
              .filter((row) => {
                if (code && String(row?.code || "").trim().toUpperCase() !== code) return false;
                if (requireActive && row?.active === false) return false;
                return true;
              })
              .map((row) => ({
                ...row,
                is_active: row?.active !== false,
                valid_from: row?.starts_at ?? row?.valid_from ?? null,
                valid_until: row?.ends_at ?? row?.valid_until ?? null,
                discount_type:
                  String(row?.discount_type || "").toLowerCase() === "percent"
                    ? "percentage"
                    : row?.discount_type,
              }));
          },
          get: createNotImplementedMethod("entities.PromoCode.get"),
          create: createNotImplementedMethod("entities.PromoCode.create"),
          update: createNotImplementedMethod("entities.PromoCode.update"),
          delete: createNotImplementedMethod("entities.PromoCode.delete"),
        };
      }
      if (name === "PreOrder") {
        return {
          list: (_sort = "", limit = 200, opts = {}) => {
            const params = new URLSearchParams({ limit: String(limit || 200) });
            const emailParam = String(opts?.customer_email || "").trim();
            if (emailParam) params.set("customer_email", emailParam);
            const orderTypeParam = String(opts?.order_type || "").trim();
            if (orderTypeParam) params.set("order_type", orderTypeParam);
            return authRequest(`/admin/pre-orders?${params.toString()}`, { method: "GET" });
          },
          get: (id) => requestJson(`/admin/checkout/pre-order?id=${encodeURIComponent(id)}`, { method: "GET" }),
          create: async (payload = {}) => {
            const result = await requestJson("/admin/checkout/service", {
              method: "POST",
              body: JSON.stringify({
                customer_name: payload.customer_name,
                customer_email: payload.customer_email,
                phone: payload.phone || null,
                order_type: payload.order_type || "service",
                notes: payload.notes || null,
                service_type_id: payload.service_type_id,
                license_type: payload.license_type || null,
                license_number: payload.license_number || null,
                license_image_url: payload.license_image_url || null,
                certification_document_url: payload.certification_document_url || null,
              }),
            });
            return { id: result?.pre_order_id, ...result };
          },
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
            const params = new URLSearchParams();
            const providerId = filters?.provider_id ? String(filters.provider_id) : "";
            const providerEmail = filters?.provider_email ? String(filters.provider_email) : "";
            const status = filters?.status ? String(filters.status) : "";
            if (providerId) params.set("provider_id", providerId);
            if (providerEmail) params.set("provider_email", providerEmail);
            if (status) params.set("status", status);
            const qs = params.toString();
            const rows = await authRequest(`/admin/certifications${qs ? `?${qs}` : ""}`, { method: "GET" });
            return rows || [];
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
          filter: (filters = {}) => {
            const params = new URLSearchParams();
            if (Object.hasOwn(filters, "id") && filters.id) {
              params.set("id", String(filters.id));
            }
            if (Object.hasOwn(filters, "provider_id") && filters.provider_id) {
              params.set("provider_id", String(filters.provider_id));
            }
            if (Object.hasOwn(filters, "provider_email") && filters.provider_email) {
              params.set("provider_email", String(filters.provider_email));
            }
            if (Object.hasOwn(filters, "course_id") && filters.course_id) {
              params.set("course_id", String(filters.course_id));
            }
            if (Object.hasOwn(filters, "enrollment_id") && filters.enrollment_id) {
              params.set("enrollment_id", String(filters.enrollment_id));
            }
            if (Object.hasOwn(filters, "session_code") && filters.session_code) {
              params.set("session_code", String(filters.session_code));
            }
            if (Object.hasOwn(filters, "session_date") && filters.session_date) {
              params.set("session_date", String(filters.session_date));
            }
            const qs = params.toString();
            return authRequest(`/admin/class-sessions${qs ? `?${qs}` : ""}`, { method: "GET" });
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
            const requireActive = filters?.is_active === true;
            return rows.filter((row) => {
              if (type && String(row?.type || "") !== type) return false;
              if (requireActive && row?.is_active === false) return false;
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
            if (Object.hasOwn(filters, "course_id") && filters.course_id) {
              params.set("course_id", String(filters.course_id));
            }
            const qs = params.toString();
            return authRequest(`/admin/enrollments${qs ? `?${qs}` : ""}`, { method: "GET" });
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
      if (name === "Notification" || name === "Notifications" || name === "notification" || name === "notifications") {
        return {
          list: (_sort = "", limit = 30) =>
            authRequest(`/admin/notifications?limit=${encodeURIComponent(String(limit || 30))}`, { method: "GET" }),
          filter: (filters = {}, _sort = "", limit = 30) => {
            const params = new URLSearchParams();
            if (Object.hasOwn(filters, "user_id") && filters.user_id) {
              params.set("user_id", String(filters.user_id));
            }
            if (Object.hasOwn(filters, "user_email") && filters.user_email) {
              params.set("user_email", String(filters.user_email));
            }
            params.set("limit", String(limit || 30));
            const qs = params.toString();
            return authRequest(`/admin/notifications${qs ? `?${qs}` : ""}`, { method: "GET" });
          },
          get: (id) => authRequest(`/admin/notifications/${encodeURIComponent(id)}`, { method: "GET" }),
          create: (payload) => authRequest("/admin/notifications", {
            method: "POST",
            body: JSON.stringify(payload || {})
          }),
          update: (id, payload) => authRequest(`/admin/notifications/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(payload || {})
          }),
          delete: createNotImplementedMethod(`entities.${name}.delete`)
        };
      }
      if (name === "User") {
        return {
          list: async () => {
            const out = [];
            for (let page = 1; page <= 20; page += 1) {
              const raw = await authRequest(`/admin/users?page=${page}&page_size=100`, { method: "GET" });
              const batch = Array.isArray(raw?.data) ? raw.data : [];
              out.push(...batch);
              if (batch.length < 100) break;
            }
            return out.map((row) => ({
              ...row,
              id: String(row?.auth_user_id || row?.id || "").trim() || row.id
            }));
          },
          get: createNotImplementedMethod("entities.User.get"),
          filter: createNotImplementedMethod("entities.User.filter"),
          create: createNotImplementedMethod("entities.User.create"),
          update: createNotImplementedMethod("entities.User.update"),
          delete: createNotImplementedMethod("entities.User.delete")
        };
      }
      if (name === "MDSubscription") {
        return {
          list: () => authRequest("/admin/md-subscriptions", { method: "GET" }),
          filter: async (filters = {}) => {
            const params = new URLSearchParams();
            const pid = String(filters?.provider_id || "").trim();
            if (pid) params.set("provider_id", pid);
            if (Object.hasOwn(filters, "status") && filters.status) {
              params.set("status", String(filters.status));
            }
            const qs = params.toString();
            return authRequest(`/admin/md-subscriptions${qs ? `?${qs}` : ""}`, { method: "GET" });
          },
          create: (payload) =>
            authRequest("/admin/md-subscriptions", { method: "POST", body: JSON.stringify(payload || {}) }),
          get: createNotImplementedMethod("entities.MDSubscription.get"),
          update: createNotImplementedMethod("entities.MDSubscription.update"),
          delete: createNotImplementedMethod("entities.MDSubscription.delete")
        };
      }
      if (name === "MedicalDirectorRelationship") {
        return {
          list: () => authRequest("/admin/md-relationships", { method: "GET" }),
          getSupervisedProvider: (providerId) =>
            authRequest(
              `/admin/md-relationships/supervised-provider?provider_id=${encodeURIComponent(String(providerId || ""))}`,
              { method: "GET" }
            ),
          filter: async (filters = {}) => {
            const pid = String(filters?.provider_id || "").trim();
            const qs = pid ? `?provider_id=${encodeURIComponent(pid)}` : "";
            const rows = await authRequest(`/admin/md-relationships${qs}`, { method: "GET" });
            const list = Array.isArray(rows) ? rows : [];
            const mdId = String(filters?.medical_director_id || "").trim();
            const status = String(filters?.status || "").trim().toLowerCase();
            return list.filter((row) => {
              if (mdId && String(row.medical_director_id || "") !== mdId) return false;
              if (status && String(row.status || "").toLowerCase() !== status) return false;
              return true;
            });
          },
          create: (payload) =>
            authRequest("/admin/md-relationships", { method: "POST", body: JSON.stringify(payload || {}) }),
          get: createNotImplementedMethod("entities.MedicalDirectorRelationship.get"),
          update: (id, payload) =>
            authRequest(`/admin/md-relationships/${encodeURIComponent(id)}`, {
              method: "PATCH",
              body: JSON.stringify(payload || {}),
            }),
          delete: createNotImplementedMethod("entities.MedicalDirectorRelationship.delete")
        };
      }
      if (name === "Appointment") {
        const fetchAppointments = async (filters = {}, sort = "", limit) => {
          const qs = buildEntityQuery(filters, limit);
          const rows = await authRequest(`/admin/appointments${qs}`, { method: "GET" });
          return sortEntityRows(Array.isArray(rows) ? rows : [], sort);
        };
        return {
          list: (sort, limit) => fetchAppointments({}, sort, limit),
          filter: fetchAppointments,
          create: (payload) =>
            authRequest("/admin/appointments", { method: "POST", body: JSON.stringify(payload || {}) }),
          update: (id, payload) =>
            authRequest(`/admin/appointments/${encodeURIComponent(id)}`, {
              method: "PATCH",
              body: JSON.stringify(payload || {}),
            }),
          get: createNotImplementedMethod("entities.Appointment.get"),
          delete: createNotImplementedMethod("entities.Appointment.delete")
        };
      }
      if (name === "TreatmentRecord") {
        const fetchTreatmentRecords = async (filters = {}, sort = "", limit) => {
          const qs = buildEntityQuery(filters, limit);
          const rows = await authRequest(`/admin/treatment-records${qs}`, { method: "GET" });
          return sortEntityRows(Array.isArray(rows) ? rows : [], sort);
        };
        return {
          list: (sort, limit) => fetchTreatmentRecords({}, sort, limit),
          filter: fetchTreatmentRecords,
          create: (payload) =>
            authRequest("/admin/treatment-records", { method: "POST", body: JSON.stringify(payload || {}) }),
          update: (id, payload) =>
            authRequest(`/admin/treatment-records/${encodeURIComponent(id)}`, {
              method: "PATCH",
              body: JSON.stringify(payload || {}),
            }),
          get: createNotImplementedMethod("entities.TreatmentRecord.get"),
          delete: createNotImplementedMethod("entities.TreatmentRecord.delete")
        };
      }
      if (name === "Review") {
        const fetchReviews = async (filters = {}, sort = "", limit) => {
          const params = new URLSearchParams();
          if (Object.hasOwn(filters, "provider_id") && filters.provider_id) {
            params.set("provider_id", String(filters.provider_id));
          }
          if (Object.hasOwn(filters, "patient_id") && filters.patient_id) {
            params.set("patient_id", String(filters.patient_id));
          }
          if (Object.hasOwn(filters, "is_verified")) {
            params.set("is_verified", String(Boolean(filters.is_verified)));
          }
          const lim = limit || 200;
          params.set("limit", String(lim));
          const qs = params.toString();
          const rows = await authRequest(`/admin/reviews${qs ? `?${qs}` : ""}`, { method: "GET" });
          return sortEntityRows(Array.isArray(rows) ? rows : [], sort);
        };
        return {
          list: (sort, limit) => fetchReviews({}, sort, limit),
          filter: fetchReviews,
          create: (payload) =>
            authRequest("/admin/reviews", { method: "POST", body: JSON.stringify(payload || {}) }),
          update: (id, payload) =>
            authRequest(`/admin/reviews/${encodeURIComponent(id)}`, {
              method: "PATCH",
              body: JSON.stringify(payload || {}),
            }),
          get: createNotImplementedMethod("entities.Review.get"),
          delete: (id) =>
            authRequest(`/admin/reviews/${encodeURIComponent(id)}`, { method: "DELETE" }),
        };
      }
      if (name === "Message") {
        return {
          list: createNotImplementedMethod("entities.Message.list"),
          get: createNotImplementedMethod("entities.Message.get"),
          create: (payload) =>
            authRequest("/admin/appointment-messages", {
              method: "POST",
              body: JSON.stringify({
                thread_id: payload?.thread_id || payload?.appointment_id,
                appointment_id: payload?.appointment_id || payload?.thread_id,
                recipient_id: payload?.recipient_id,
                recipient_name: payload?.recipient_name,
                recipient_email: payload?.recipient_email,
                message: payload?.message,
                sender_name: payload?.sender_name,
                sender_role: payload?.sender_role,
              }),
            }),
          update: createNotImplementedMethod("entities.Message.update"),
          delete: createNotImplementedMethod("entities.Message.delete"),
          filter: async (filters = {}, _sort = "", _limit = 200) => {
            const threadId = String(filters?.thread_id || filters?.appointment_id || "").trim();
            if (!threadId) return [];
            return authRequest(
              `/admin/appointment-messages?thread_id=${encodeURIComponent(threadId)}`,
              { method: "GET" }
            );
          },
        };
      }
      if (name === "ComplianceLog") {
        const fetchComplianceLogs = async (filters = {}, sort = "", limit) => {
          const qs = buildEntityQuery(filters, limit || 200);
          const rows = await authRequest(`/admin/compliance-logs${qs}`, { method: "GET" });
          return sortEntityRows(Array.isArray(rows) ? rows : [], sort);
        };
        return {
          list: (sort, limit) => fetchComplianceLogs({}, sort, limit),
          filter: fetchComplianceLogs,
          create: (payload) =>
            authRequest("/admin/compliance-logs", { method: "POST", body: JSON.stringify(payload || {}) }),
          update: (id, payload) =>
            authRequest(`/admin/compliance-logs/${encodeURIComponent(id)}`, {
              method: "PATCH",
              body: JSON.stringify(payload || {}),
            }),
          get: createNotImplementedMethod("entities.ComplianceLog.get"),
          delete: (id) =>
            authRequest(`/admin/compliance-logs/${encodeURIComponent(id)}`, { method: "DELETE" }),
        };
      }
      if (name === "PatientJourney") {
        return {
          list: (_sort = "", limit = 200) =>
            authRequest(`/admin/patient-journey?limit=${encodeURIComponent(String(limit || 200))}`, { method: "GET" }),
          get: createNotImplementedMethod("entities.PatientJourney.get"),
          filter: async (filters = {}) => {
            const pid = String(filters?.patient_id || "").trim();
            if (!pid) return [];
            return authRequest(`/admin/patient-journey?patient_id=${encodeURIComponent(pid)}`, { method: "GET" });
          },
          create: (payload) =>
            authRequest("/admin/patient-journey", { method: "POST", body: JSON.stringify(payload || {}) }),
          update: (id, payload) =>
            authRequest(`/admin/patient-journey/${encodeURIComponent(id)}`, {
              method: "PUT",
              body: JSON.stringify(payload || {}),
            }),
          delete: createNotImplementedMethod("entities.PatientJourney.delete")
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
    marketplace: {
      getCatalog: () => authRequest("/admin/marketplace/providers", { method: "GET" }),
      getProvider: (providerId) =>
        authRequest(`/admin/marketplace/providers?provider_id=${encodeURIComponent(String(providerId || ""))}`, {
          method: "GET",
        }),
    },
    appLogs: {
      logUserInApp: async () => ({ ok: true })
    },
    functions: {
      invoke: async (functionName, payload) => {
        // Payment-creating endpoints get a fresh client_timestamp at the
        // moment of invocation so the backend can compare it to
        // server_received_timestamp and detect stale frontend state.
        const PAYMENT_FUNCTIONS = new Set([
          "createPreOrderCheckout",
          "createModelCheckout",
          "createCheckoutSession",
          "createCourseCheckout",
          "createAppointmentPayment",
        ]);
        const isPaymentFn = PAYMENT_FUNCTIONS.has(functionName);
        const clientTimestamp = isPaymentFn ? new Date().toISOString() : null;
        const browserOrigin =
          typeof window !== "undefined" && window.location?.origin
            ? window.location.origin
            : "";
        const stampedPayload = {
          ...(payload || {}),
          ...(browserOrigin && !payload?.frontend_origin
            ? { frontend_origin: browserOrigin }
            : {}),
          ...(isPaymentFn ? { client_timestamp: clientTimestamp } : {}),
        };
        const paymentHeaders = isPaymentFn
          ? { "x-novi-client-timestamp": clientTimestamp }
          : undefined;

        if (functionName === "createPreOrderCheckout") {
          if (payload?.pre_order_id) {
            throw new Error("[lovable-provider] createPreOrderCheckout with pre_order_id is not implemented yet.");
          }
          return {
            data: await requestJson("/admin/checkout/service", {
              method: "POST",
              body: JSON.stringify(stampedPayload),
              headers: paymentHeaders
            })
          };
        }
        if (functionName === "createCourseCheckout") {
          const info = payload?.personal_info || {};
          let promoCode = null;
          if (payload?.promo_code_id) {
            const promos = await requestJson("/admin/promo-codes", { method: "GET" });
            const match = (Array.isArray(promos) ? promos : []).find(
              (p) => String(p?.id) === String(payload.promo_code_id)
            );
            promoCode = match?.code || null;
          }
          const checkout = await requestJson("/admin/checkout/course", {
            method: "POST",
            body: JSON.stringify({
              course_id: payload?.course_id,
              course_date: payload?.course_date || null,
              first_name: info.first_name,
              last_name: info.last_name,
              customer_email: info.email,
              customer_name: `${info.first_name || ""} ${info.last_name || ""}`.trim(),
              phone: info.phone || null,
              terms_confirmed: true,
              refund_policy_confirmed: true,
              promo_code: promoCode,
              checkout_return_to: "landing",
              client_timestamp: clientTimestamp,
            }),
            headers: paymentHeaders,
          });
          return { data: { url: checkout?.checkout_url || null } };
        }
        if (functionName === "sendMdServiceConfirmationEmail") {
          return { data: { success: true } };
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
            body: JSON.stringify(stampedPayload),
            headers: paymentHeaders
          })
        };
      }
    },
    integrations: {
      Core: {
        UploadFile: async ({ file, kind } = {}) => {
          if (!file) throw new Error("[lovable-provider] Upload file is required.");
          const token = getStoredAccessToken();
          const formData = new FormData();
          formData.append("file", file);
          const uploadPath =
            kind === "patient_journey_selfie"
              ? "/admin/uploads/patient-selfie"
              : kind === "manufacturer_logo"
                ? "/admin/uploads/manufacturer-logo"
                : kind === "manufacturer_contract"
                  ? "/admin/uploads/md-document"
                  : "/admin/uploads/license-photo";
          const response = await fetch(`${ADMIN_API_BASE_URL}${toApiPath(uploadPath)}`, {
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
        },
        InvokeLLM: async (body = {}) => {
          const out = await authRequest("/admin/integrations/invoke-llm", {
            method: "POST",
            body: JSON.stringify(body || {})
          });
          if (body.response_json_schema && out && typeof out === "object" && !Object.hasOwn(out, "content")) {
            return out;
          }
          if (typeof out?.content === "string") return out.content;
          if (typeof out === "string") return out;
          return out;
        }
      }
    }
  };
}

