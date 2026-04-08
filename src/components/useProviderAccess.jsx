/**
 * useProviderAccess
 * Returns the provider's current access tier based on their journey progress.
 *
 * Tiers (in order):
 *   "none"         → No license submitted → full sales lock, show apply CTA
 *   "pending"      → License submitted, awaiting admin approval → full sales lock, show pending banner
 *   "courses_only" → License verified by admin → can browse/purchase/attend courses + upload external certs
 *   "md_eligible"  → Has at least one active NOVI cert (completed course) OR an admin-approved external cert
 *                    → can apply for MD Board subscription (unlocks the MD Coverage flow)
 *   "full"         → Has at least one active MDSubscription → full portal (practice, patients, appointments)
 *
 * External cert fast-track:
 *   If provider uploads an external cert and admin approves it (status="active"), they jump to
 *   "md_eligible" (or "full" if they already have an active MDSubscription) — bypassing the NOVI course.
 */
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useProviderAccess() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const isProvider = !!me && me.role === "provider";

  const { data: licenses = [], isLoading: loadingLicenses } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.License.filter({ provider_id: u.id });
    },
    enabled: isProvider,
  });

  const { data: certs = [], isLoading: loadingCerts } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: u.id });
    },
    enabled: isProvider,
  });

  const { data: mdSubs = [], isLoading: loadingMdSubs } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: u.id });
    },
    enabled: isProvider,
  });

  // Non-providers get full access
  if (!me || me.role !== "provider") return { status: "full", isLoading: false };

  const isLoading = loadingLicenses || loadingCerts || loadingMdSubs;
  if (isLoading) return { status: "loading", isLoading: true };

  // Step 1: Must have a verified license
  const hasVerifiedLicense = licenses.some(l => l.status === "verified");
  const hasAnyLicense = licenses.length > 0;

  if (!hasAnyLicense) return { status: "none", isLoading: false };
  if (!hasVerifiedLicense) return { status: "pending", isLoading: false };

  // Step 2: Check for active MD subscription → full access
  const hasActiveMdSub = mdSubs.some(s => s.status === "active");
  if (hasActiveMdSub) return { status: "full", isLoading: false };

  // Step 3: Check for certification that qualifies for MD application
  // Either: NOVI cert (issued_by not set or from NOVI), or an admin-approved external cert
  const hasQualifyingCert = certs.some(c => c.status === "active");
  if (hasQualifyingCert) return { status: "md_eligible", isLoading: false };

  // Step 4: License verified but no qualifying cert yet → can buy/attend courses, upload external certs
  return { status: "courses_only", isLoading: false };
}