import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { adminApiRequest } from "@/api/adminApiRequest";
import { createPageUrl } from "@/utils";
import { ClipboardList, Users, Clock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { STAFF_MODULE_CATALOG } from "@/lib/routeAccessPolicy";

const MODULE_ICONS = {
  StaffEnrollments:  ClipboardList,
  StaffProviders:    Users,
  StaffModelSignups: Users,
  StaffPreOrders:    ClipboardList,
  StaffCompliance:   AlertCircle,
};

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 12px rgba(30,37,53,0.05)" }}>
      {Icon && <Icon className="w-5 h-5 mb-2" style={{ color }} />}
      <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color, lineHeight: 1, fontWeight: 400 }}>{value}</p>
      <p className="text-xs mt-1.5" style={{ color: "rgba(30,37,53,0.5)" }}>{label}</p>
    </div>
  );
}

function QueueItem({ name, detail, badge, badgeColor }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>{name}</p>
        {detail && <p className="text-xs truncate mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{detail}</p>}
      </div>
      {badge && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: badgeColor?.bg || "rgba(250,111,48,0.12)", color: badgeColor?.text || "#FA6F30", border: `1px solid ${badgeColor?.border || "rgba(250,111,48,0.3)"}` }}>
          {badge}
        </span>
      )}
    </div>
  );
}

export default function StaffDashboard() {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: preOrdersRaw = [] } = useQuery({
    queryKey: ["staff-dash-preorders"],
    queryFn: () => base44.entities.PreOrder.list("-created_date", 200),
  });

  const { data: modelSignupsRaw = [] } = useQuery({
    queryKey: ["staff-dash-models"],
    queryFn: async () => {
      const rows = await adminApiRequest("/admin/pre-orders?limit=300");
      return Array.isArray(rows) ? rows.filter(r => String(r?.order_type || "").toLowerCase() === "model") : [];
    },
  });

  const { data: enrollmentsRaw = [] } = useQuery({
    queryKey: ["staff-dash-enrollments"],
    queryFn: () => base44.entities.Enrollment.list("-created_date"),
  });

  const pendingApplications = useMemo(
    () => preOrdersRaw.filter(o => o.status === "pending_approval" && o.order_type !== "model"),
    [preOrdersRaw]
  );

  const modelsPendingGFE = useMemo(
    () => modelSignupsRaw.filter(m => !m.gfe_status || m.gfe_status === "not_available"),
    [modelSignupsRaw]
  );

  const waitlistedModels = useMemo(
    () => modelSignupsRaw.filter(m => m.is_waitlist && m.status !== "cancelled"),
    [modelSignupsRaw]
  );

  const recentEnrollments = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return enrollmentsRaw.filter(e => {
      const d = e.created_date ? new Date(e.created_date).getTime() : 0;
      return (e.status === "paid" || e.status === "confirmed") && d > cutoff;
    });
  }, [enrollmentsRaw]);

  const permittedModules = useMemo(
    () => STAFF_MODULE_CATALOG.filter(m => user?.permissions?.[m.key] === true),
    [user]
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(123,142,200,0.7)", letterSpacing: "0.14em" }}>Staff Portal</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "#1e2535", lineHeight: 1.15 }}>
          Welcome back{user?.first_name ? `, ${user.first_name}` : ""}
        </h1>
        <p style={{ color: "rgba(30,37,53,0.55)", fontSize: 13, marginTop: 4 }}>Your operational overview for today</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Applications" value={pendingApplications.length} color="#FA6F30" icon={ClipboardList} />
        <StatCard label="GFE Not Sent" value={modelsPendingGFE.length} color="#2D6B7F" icon={Clock} />
        <StatCard label="Waitlisted Models" value={waitlistedModels.length} color="#7B8EC8" icon={Users} />
        <StatCard label="Enrollments This Week" value={recentEnrollments.length} color="#4a6b10" icon={CheckCircle2} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending applications queue */}
        {user?.permissions?.StaffPreOrders !== false && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div className="flex items-center justify-between">
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, color: "#1e2535" }}>Pending Applications</h2>
              <Link to={createPageUrl("StaffPreOrders")} className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#7B8EC8" }}>
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {pendingApplications.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: "rgba(30,37,53,0.4)" }}>No applications pending approval</p>
            ) : (
              <div className="space-y-2">
                {pendingApplications.slice(0, 5).map(o => (
                  <QueueItem
                    key={o.id}
                    name={o.customer_name || o.customer_email || "Applicant"}
                    detail={o.course_title || o.service_name || ""}
                    badge="Action Needed"
                    badgeColor={{ bg: "rgba(250,111,48,0.12)", text: "#FA6F30", border: "rgba(250,111,48,0.3)" }}
                  />
                ))}
                {pendingApplications.length > 5 && (
                  <p className="text-xs text-center pt-1" style={{ color: "rgba(30,37,53,0.4)" }}>+{pendingApplications.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Models pending GFE */}
        {user?.permissions?.StaffModelSignups !== false && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div className="flex items-center justify-between">
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, color: "#1e2535" }}>GFE Not Sent</h2>
              <Link to={createPageUrl("StaffModelSignups")} className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#7B8EC8" }}>
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {modelsPendingGFE.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: "rgba(30,37,53,0.4)" }}>All model sign-ups have GFE sent</p>
            ) : (
              <div className="space-y-2">
                {modelsPendingGFE.slice(0, 5).map(m => (
                  <QueueItem
                    key={m.id}
                    name={m.customer_name || m.customer_email || "Model"}
                    detail={m.course_date ? new Date(m.course_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                    badge="GFE Pending"
                    badgeColor={{ bg: "rgba(45,107,127,0.1)", text: "#2D6B7F", border: "rgba(45,107,127,0.2)" }}
                  />
                ))}
                {modelsPendingGFE.length > 5 && (
                  <p className="text-xs text-center pt-1" style={{ color: "rgba(30,37,53,0.4)" }}>+{modelsPendingGFE.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick access */}
      {permittedModules.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Quick Access</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {permittedModules.map(module => {
              const Icon = MODULE_ICONS[module.key] || ClipboardList;
              return (
                <Link
                  key={module.key}
                  to={createPageUrl(module.key)}
                  className="flex items-center gap-3 p-4 rounded-2xl transition-all hover:scale-[1.01]"
                  style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 8px rgba(30,37,53,0.04)", textDecoration: "none" }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.25)" }}>
                    <Icon className="w-4 h-4" style={{ color: "#4a6b10" }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "#1e2535" }}>{module.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
