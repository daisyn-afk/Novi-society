import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Bell, X, Calendar, Award, FileText, Users, CheckCircle, ShieldCheck, MessageSquare } from "lucide-react";
import { format } from "date-fns";

const NOTIF_ICONS = {
  appointment_request: Calendar,
  license_verified: FileText,
  license_rejected: FileText,
  cert_awarded: Award,
  cert_issue_pending: Award,
  cert_rejected: Award,
  md_relationship_approved: Users,
  md_relationship_pending: Users,
  md_coverage_pending: Users,
  gfe_invite: ShieldCheck,
  gfe_completed: ShieldCheck,
  gfe_deferred: ShieldCheck,
  treatment_record_approved: CheckCircle,
  treatment_record_flagged: FileText,
  treatment_record_changes_requested: FileText,
  treatment_record_resubmitted: FileText,
  appointment_message: MessageSquare,
};

const NOTIF_COLORS = {
  appointment_request: "text-blue-500 bg-blue-50",
  license_verified: "text-green-500 bg-green-50",
  license_rejected: "text-red-500 bg-red-50",
  cert_awarded: "text-amber-500 bg-amber-50",
  cert_issue_pending: "text-amber-600 bg-amber-50",
  cert_rejected: "text-red-500 bg-red-50",
  md_relationship_approved: "text-purple-500 bg-purple-50",
  md_relationship_pending: "text-yellow-500 bg-yellow-50",
  md_coverage_pending: "text-teal-700 bg-teal-50",
  gfe_invite: "text-indigo-600 bg-indigo-50",
  gfe_completed: "text-green-600 bg-green-50",
  gfe_deferred: "text-red-600 bg-red-50",
  treatment_record_approved: "text-green-600 bg-green-50",
  treatment_record_flagged: "text-red-600 bg-red-50",
  treatment_record_changes_requested: "text-orange-600 bg-orange-50",
  treatment_record_resubmitted: "text-blue-600 bg-blue-50",
  appointment_message: "text-indigo-600 bg-indigo-50",
};

const NOTIF_ROW_STYLES = {
  appointment_request: "bg-blue-50/70 border-blue-100",
  license_verified: "bg-green-50/80 border-green-200",
  license_rejected: "bg-red-50/80 border-red-200",
  cert_awarded: "bg-amber-50/70 border-amber-100",
  cert_issue_pending: "bg-amber-50/80 border-amber-200",
  cert_rejected: "bg-red-50/80 border-red-200",
  md_relationship_approved: "bg-purple-50/70 border-purple-100",
  md_relationship_pending: "bg-yellow-50/70 border-yellow-100",
  md_coverage_pending: "bg-teal-50/80 border-teal-200",
  gfe_invite: "bg-indigo-50/80 border-indigo-200",
  gfe_completed: "bg-green-50/80 border-green-200",
  gfe_deferred: "bg-red-50/80 border-red-200",
  treatment_record_approved: "bg-green-50/80 border-green-200",
  treatment_record_flagged: "bg-red-50/80 border-red-200",
  treatment_record_changes_requested: "bg-orange-50/80 border-orange-200",
  treatment_record_resubmitted: "bg-blue-50/80 border-blue-200",
  appointment_message: "bg-indigo-50/80 border-indigo-200",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notificationEntity =
    base44.entities?.["Notification"] ||
    base44.entities?.["Notifications"] ||
    base44.entities?.["notification"] ||
    base44.entities?.["notifications"];

  const { data: notifications = [] } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: async () => {
      const me = await base44.auth.me();
      if (!notificationEntity) return [];
      const meEmail = String(me?.email || "").trim().toLowerCase();
      const meId = String(me?.id || "").trim();
      const fetchByFilter = async (filter) => {
        try {
          return await notificationEntity.filter(filter, "-created_date", 30);
        } catch {
          return await notificationEntity.filter(filter, "-created_at", 30);
        }
      };
      const [byUserId, byUserEmail] = await Promise.all([
        fetchByFilter({ user_id: meId }),
        meEmail ? fetchByFilter({ user_email: meEmail }) : Promise.resolve([]),
      ]);
      let merged = [...(byUserId || []), ...(byUserEmail || [])];
      if (merged.length === 0) {
        // Base44 projects can differ in filter support/field names; fall back to list + client filter.
        let raw = [];
        try {
          raw = await notificationEntity.list("-created_date", 200);
        } catch {
          raw = await notificationEntity.list("-created_at", 200);
        }
        merged = (raw || []).filter((n) => {
          const userId = String(n?.user_id || n?.recipient_id || "").trim();
          const userEmail = String(n?.user_email || n?.recipient_email || "").trim().toLowerCase();
          return (meId && userId === meId) || (meEmail && userEmail === meEmail);
        });
      }
      const deduped = Array.from(new Map(merged.map((item) => [item.id, item])).values());
      deduped.sort((a, b) => {
        const aDate = new Date(a?.created_date || a?.created_at || 0).getTime();
        const bDate = new Date(b?.created_date || b?.created_at || 0).getTime();
        return bDate - aDate;
      });
      return deduped.slice(0, 30);
    },
    refetchInterval: 2_000,
    refetchOnWindowFocus: true,
  });

  const unreadApptRequestCount = notifications.filter(
    (n) => n.type === "appointment_request" && !n.read_at
  ).length;
  const prevUnreadApptRequests = useRef(0);

  useEffect(() => {
    if (unreadApptRequestCount > prevUnreadApptRequests.current) {
      void qc.refetchQueries({ queryKey: ["my-appointments"] });
    }
    prevUnreadApptRequests.current = unreadApptRequestCount;
  }, [unreadApptRequestCount, qc]);

  const unread = notifications.filter(n => !n.read_at);

  const markRead = useMutation({
    mutationFn: (id) => notificationEntity?.update(id, { read_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const markAllRead = async () => {
    if (!notificationEntity) return;
    for (const n of unread) {
      await notificationEntity.update(n.id, { read_at: new Date().toISOString() });
    }
    qc.invalidateQueries({ queryKey: ["my-notifications"] });
  };

  const resolveNotificationHref = (linkPage) => {
    const raw = String(linkPage || "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return raw;
    const [pageName, queryString] = raw.split("?");
    const routePath = createPageUrl(String(pageName || "").trim() || raw);
    return queryString ? `${routePath}?${queryString}` : routePath;
  };

  const appendQueryParams = (href, paramsToAdd) => {
    if (!href) return href;
    const [pathname, existingQuery = ""] = String(href).split("?");
    const params = new URLSearchParams(existingQuery);
    Object.entries(paramsToAdd || {}).forEach(([key, value]) => {
      if (!params.get(key) && value) params.set(key, String(value));
    });
    const nextQuery = params.toString();
    return nextQuery ? `${pathname}?${nextQuery}` : pathname;
  };

  const handleNotificationClick = (notification) => {
    const nowIso = new Date().toISOString();
    if (!notification?.read_at && notification?.id) {
      qc.setQueryData(["my-notifications"], (old = []) =>
        (Array.isArray(old) ? old : []).map((n) => (
          n?.id === notification.id ? { ...n, read_at: nowIso } : n
        ))
      );
      markRead.mutate(notification.id);
    }
    const type = String(notification?.type || "").toLowerCase();
    const isAdminSubmissionNotification = type === "license_submitted" || type === "cert_submitted";
    const isAdminCertIssueNotification = type === "cert_issue_pending";
    let targetHref = resolveNotificationHref(notification?.link_page);
    if (isAdminCertIssueNotification) {
      targetHref = appendQueryParams(targetHref || createPageUrl("AdminLicenses"), {
        tab: "certifications",
        focus_type: "awaiting_issue",
      });
    } else if (isAdminSubmissionNotification) {
      targetHref = appendQueryParams(targetHref || createPageUrl("AdminLicenses"), {
        tab: type === "cert_submitted" ? "certifications" : "licenses",
        focus_type: type === "cert_submitted" ? "certification" : "license",
      });
    } else if (type === "appointment_request") {
      targetHref = appendQueryParams(targetHref || createPageUrl("ProviderPractice"), {
        tab: "appointments",
      });
    } else if (type === "treatment_record_resubmitted") {
      targetHref = createPageUrl("MDTreatmentRecords");
    } else if (type.startsWith("treatment_record_")) {
      targetHref = targetHref || createPageUrl("ProviderPractice");
    } else if (type === "appointment_message") {
      const link = String(notification?.link_page || "");
      if (link.includes("ProviderMessaging") || link.includes("patient_queries")) {
        const threadMatch = link.match(/thread_id=([^&]+)/);
        targetHref = appendQueryParams(createPageUrl("ProviderMessaging"), {
          tab: "patient_queries",
          ...(threadMatch ? { thread_id: decodeURIComponent(threadMatch[1]) } : {}),
        });
      } else if (link.includes("ProviderPractice") || link.includes("ProviderAppointments")) {
        targetHref = appendQueryParams(createPageUrl("ProviderPractice"), { tab: "appointments" });
      } else if (link.includes("PatientMarketplace")) {
        targetHref = link.startsWith("/") ? link : `/${link}`;
      } else {
        targetHref = targetHref || createPageUrl("PatientAppointments");
      }
    }
    if (targetHref) {
      setOpen(false);
      if (/^https?:\/\//i.test(targetHref)) {
        window.open(targetHref, "_blank", "noopener,noreferrer");
      } else {
        navigate(targetHref);
      }
    }
  };

  return (
    <div className="relative">
      <button
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
            style={{ background: unreadApptRequestCount > 0 ? "#dc2626" : "#FA6F30" }}>
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-300 z-40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <p className="font-semibold text-slate-950 text-sm">Notifications</p>
              <div className="flex items-center gap-2">
                {unread.length > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => {
                  const Icon = NOTIF_ICONS[n.type] || Bell;
                  const colorClass = NOTIF_COLORS[n.type] || "text-slate-500 bg-slate-50";
                  const rowStyleClass = NOTIF_ROW_STYLES[n.type] || "bg-slate-50/60 border-slate-100";
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-colors ${
                        !n.read_at ? rowStyleClass : "border-slate-100 hover:bg-slate-50/80"
                      }`}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${n.read_at ? "text-slate-700" : "text-slate-950 font-semibold"}`}>
                          {n.message}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {(n.created_date || n.created_at) ? format(new Date(n.created_date || n.created_at), "MMM d, h:mm a") : ""}
                        </p>
                      </div>
                      {!n.read_at && (
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#FA6F30" }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}