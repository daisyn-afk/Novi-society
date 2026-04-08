/**
 * ProviderLockGate — legacy wrapper, now delegates to ServiceLockGate.
 * Kept for backward compatibility — all existing pages using <ProviderLockGate> still work.
 */
import ServiceLockGate from "@/components/ServiceLockGate";

export default function ProviderLockGate({ children, feature, bypass }) {
  return <ServiceLockGate feature={feature} bypass={bypass}>{children}</ServiceLockGate>;
}