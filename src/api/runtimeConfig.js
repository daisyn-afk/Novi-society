const API_PROVIDER_BASE44 = "base44";
const API_PROVIDER_LOVABLE = "lovable";

export const apiRuntimeConfig = {
  provider: import.meta.env.VITE_APP_API_PROVIDER || API_PROVIDER_BASE44,
  apiBaseUrl: import.meta.env.VITE_APP_API_BASE_URL || "",
  base44: {
    appId: import.meta.env.VITE_BASE44_APP_ID,
    appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL,
    functionsVersion: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION
  }
};

export const isBase44Provider = apiRuntimeConfig.provider === API_PROVIDER_BASE44;
export const isLovableProvider = apiRuntimeConfig.provider === API_PROVIDER_LOVABLE;

