import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { buildProviderAttestationContext } from "@/lib/serviceAttestation";

export function useProviderAttestation({ enabled = true } = {}) {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    enabled,
  });

  const { data: certifications = [] } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user?.id) return [];
      return base44.entities.Certification.filter({ provider_id: user.id }, "-created_date");
    },
    enabled: enabled && !!me?.id,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments-coverage"],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user?.id) return [];
      return base44.entities.CourseEnrollment.filter({ provider_id: user.id }, "-created_date");
    },
    enabled: enabled && !!me?.id,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-coverage"],
    queryFn: () => base44.entities.Course.list(),
    enabled,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["my-sessions-attestation", enrollments.map((e) => e.id).join("|")],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user?.id) return [];
      const rows = await base44.entities.AttendanceSession.filter({ provider_id: user.id });
      const enrollmentIds = new Set(enrollments.map((e) => String(e.id)));
      return (rows || []).filter((s) => enrollmentIds.has(String(s.enrollment_id)));
    },
    enabled: enabled && !!me?.id,
  });

  const context = useMemo(
    () =>
      buildProviderAttestationContext({
        certifications,
        enrollments,
        sessions,
        courses,
      }),
    [certifications, enrollments, sessions, courses]
  );

  return {
    context,
    certifications,
    enrollments,
    sessions,
    courses,
  };
}
