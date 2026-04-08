import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BookOpen, Search, CheckCircle } from "lucide-react";
import { format } from "date-fns";

const statusColor = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  paid: "bg-blue-100 text-blue-700",
  confirmed: "bg-blue-100 text-blue-700",
  attended: "bg-indigo-100 text-indigo-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-slate-100 text-slate-600",
};

export default function AdminEnrollments() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const qc = useQueryClient();

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => base44.entities.Enrollment.list("-created_date"),
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => base44.entities.Course.list(),
  });

  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Enrollment.update(id, { status }),
    onSuccess: () => qc.invalidateQueries(["enrollments"]),
  });

  const filtered = enrollments.filter(e => {
    const matchSearch = !search || e.provider_name?.toLowerCase().includes(search.toLowerCase()) || e.provider_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Enrollments</h2>
        <p className="text-slate-500 text-sm mt-1">{enrollments.length} total enrollments</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search by provider..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["pending_payment","paid","confirmed","attended","completed","cancelled","no_show"].map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => {
            const course = courseMap[e.course_id];
            return (
              <Card key={e.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{e.provider_name || e.provider_email}</span>
                        <Badge className={statusColor[e.status]}>{e.status?.replace("_"," ")}</Badge>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{course?.title || "Unknown Course"}</p>
                      <div className="flex gap-3 text-xs text-slate-400 mt-1">
                        {e.amount_paid && <span>${e.amount_paid.toLocaleString()}</span>}
                        {e.created_date && <span>{format(new Date(e.created_date), "MMM d, yyyy")}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {e.status === "paid" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: e.id, status: "confirmed" })}>
                          Confirm
                        </Button>
                      )}
                      {e.status === "confirmed" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: e.id, status: "attended" })}>
                          Mark Attended
                        </Button>
                      )}
                      {e.status === "attended" && (
                        <Button size="sm" style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}
                          onClick={() => updateStatus.mutate({ id: e.id, status: "completed" })}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Complete
                        </Button>
                      )}
                      {!["cancelled","completed","no_show"].includes(e.status) && (
                        <Button size="sm" variant="outline" className="text-red-500" onClick={() => updateStatus.mutate({ id: e.id, status: "cancelled" })}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-slate-400 py-10">No enrollments found</p>}
        </div>
      )}
    </div>
  );
}