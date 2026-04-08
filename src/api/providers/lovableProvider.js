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
      me: createNotImplementedMethod("auth.me"),
      logout: () => {},
      redirectToLogin: () => {
        window.location.href = "/login";
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

