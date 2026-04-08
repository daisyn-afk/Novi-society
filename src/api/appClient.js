import { createLovableProviderClient } from "@/api/providers/lovableProvider";
import { apiRuntimeConfig } from "@/api/runtimeConfig";

if (apiRuntimeConfig.provider !== "lovable") {
  console.warn(
    "[appClient] Base44 provider has been removed. Forcing provider to lovable."
  );
}

export const appClient = createLovableProviderClient();

// Backward compatibility alias used across existing pages/components.
export const base44 = appClient;

