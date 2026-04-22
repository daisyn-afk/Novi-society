import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminCoursesApi } from "@/api/adminCoursesApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Clock, Search, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS = {
  paid: { bg: "rgba(123,142,200,0.15)", color: "#7B8EC8", label: "Paid" },
  confirmed: { bg: "rgba(200,230,60,0.15)", color: "#a8cc20", label: "Confirmed" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", label: status };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, borderRadius: 20, padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function EnrollmentRow({ enrollment, courseTitle, preOrder }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.1)" }}>
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setExpanded((e) => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <p className="font-semibold text-sm truncate" style={{ color: "#1e2535" }}>{enrollment.provider_name || "Provider"}</p>
            <StatusBadge status={enrollment.status} />
          </div>
          <p className="text-xs truncate" style={{ color: "rgba(30,37,53,0.55)" }}>
            {enrollment.provider_email} · {courseTitle}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-bold" style={{ color: "#1e2535" }}>${enrollment.amount_paid?.toLocaleString() || "—"}</span>
          <span className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>
            {enrollment.created_date ? format(new Date(enrollment.created_date), "MMM d, yyyy") : ""}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} />}
        </div>
      </div>
      {expanded && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>Provider</p>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{enrollment.provider_name || "—"}</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>{enrollment.provider_email || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>Course</p>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{courseTitle}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>Payment</p>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>${enrollment.amount_paid?.toLocaleString() || "—"}</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>{enrollment.status?.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>License</p>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{preOrder?.license_type || "—"}</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>{preOrder?.license_number || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>Phone</p>
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>{preOrder?.phone || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>Session Date</p>
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>
                {enrollment.session_date
                  ? new Date(enrollment.session_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                  : "—"}
              </p>
            </div>
          </div>
          {preOrder?.notes && (
            <div className="mt-4 p-3 rounded-xl" style={{ background: "rgba(30,37,53,0.05)" }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>Notes from applicant</p>
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>{preOrder.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminEnrollments() {
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => base44.entities.Enrollment.list("-created_date"),
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-courses-enrollments"],
    queryFn: () => adminCoursesApi.list(),
  });
  const { data: preOrders = [] } = useQuery({
    queryKey: ["pre-orders-enrollments"],
    queryFn: () => base44.entities.PreOrder.list("-created_date", 300),
  });

  const courseMap = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c])), [courses]);
  const preOrderMap = useMemo(() => Object.fromEntries(preOrders.map((p) => [p.id, p])), [preOrders]);
  const paidEnrollments = useMemo(() => {
    const direct = enrollments.filter((e) => e.status === "paid" || e.status === "confirmed");
    const existingPreOrderIds = new Set(direct.map((e) => e.pre_order_id).filter(Boolean));
    const derivedFromPreOrders = preOrders
      .filter((p) => p.order_type === "course" && (p.status === "paid" || p.status === "confirmed" || p.status === "completed"))
      .filter((p) => !existingPreOrderIds.has(p.id))
      .map((p) => ({
        id: `preorder-${p.id}`,
        pre_order_id: p.id,
        course_id: p.course_id,
        provider_name: p.customer_name,
        provider_email: p.customer_email,
        status: p.status === "completed" ? "confirmed" : p.status,
        session_date: p.course_date,
        amount_paid: p.amount_paid,
        created_date: p.created_date,
      }));
    return [...direct, ...derivedFromPreOrders];
  }, [enrollments, preOrders]);
  const searchable = (value) => String(value || "").toLowerCase();
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return paidEnrollments.filter((e) => {
      const courseTitle = courseMap[e.course_id]?.title || "Unknown Course";
      const byCourse = courseFilter === "all" || String(e.course_id) === String(courseFilter);
      const bySearch = !term
        || searchable(e.provider_name).includes(term)
        || searchable(e.provider_email).includes(term)
        || searchable(courseTitle).includes(term);
      return byCourse && bySearch;
    });
  }, [paidEnrollments, courseMap, courseFilter, search]);

  const courseOptions = useMemo(() => {
    const ids = [...new Set(paidEnrollments.map((e) => e.course_id).filter(Boolean))];
    return ids
      .map((id) => ({ id: String(id), title: courseMap[id]?.title || `Course ${String(id).slice(0, 8)}` }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [paidEnrollments, courseMap]);

  return (
    <div className="space-y-6 max-w-5xl w-full">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(218,106,99,0.9)", letterSpacing: "0.14em" }}>Admin</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.15 }}>Enrollments</h1>
        <p style={{ color: "rgba(30,37,53,0.6)", fontSize: 13, marginTop: 4 }}>Paid and confirmed course enrollments</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
          <Input className="pl-9" placeholder="Search by name, email, or course..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "rgba(30,37,53,0.1)", borderTopColor: "#C8E63C" }} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Paid / Confirmed", value: paidEnrollments.length, color: "#7B8EC8" },
              { label: "Filtered Results", value: filtered.length, color: "#FA6F30" },
              { label: "Unique Courses", value: courseOptions.length, color: "rgba(30,37,53,0.7)" },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.5)", boxShadow: "0 2px 16px rgba(30,37,53,0.07)" }}>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: s.color, lineHeight: 1, fontWeight: 400 }}>{s.value}</p>
                <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.55)" }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap mt-3">
            {[{ id: "all", title: "All" }, ...courseOptions].map((c) => (
              <button
                key={c.id}
                onClick={() => setCourseFilter(c.id)}
                className="px-4 py-2 rounded-full text-xs font-bold transition-all"
                style={{
                  background: courseFilter === c.id ? "rgba(200,230,60,0.2)" : "rgba(30,37,53,0.07)",
                  color: courseFilter === c.id ? "#5a7a20" : "rgba(30,37,53,0.6)",
                  border: courseFilter === c.id ? "1px solid rgba(200,230,60,0.4)" : "1px solid rgba(30,37,53,0.1)",
                }}
              >
                {c.title}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }}>
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#1e2535" }} />
              <p style={{ color: "rgba(30,37,53,0.4)" }}>No paid enrollments found</p>
            </div>
          ) : (
            <div>
              {filtered.map((e) => (
                <EnrollmentRow
                  key={e.id}
                  enrollment={e}
                  courseTitle={courseMap[e.course_id]?.title || "Unknown Course"}
                  preOrder={preOrderMap[e.pre_order_id]}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}