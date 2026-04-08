import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { format } from "date-fns";

const statusColor = { pending: "bg-yellow-100 text-yellow-700", active: "bg-green-100 text-green-700", suspended: "bg-red-100 text-red-700", terminated: "bg-slate-100 text-slate-600" };

export default function MDProviders() {
  const { data: relationships = [], isLoading } = useQuery({
    queryKey: ["md-relationships"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.MedicalDirectorRelationship.filter({ medical_director_id: me.id });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Providers</h2>
        <p className="text-slate-500 text-sm mt-1">{relationships.length} providers under supervision</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
      ) : relationships.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400">No providers assigned yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {relationships.map(r => (
            <Card key={r.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback style={{ background: "var(--novi-gold)", color: "#1A1A2E" }} className="font-bold">
                      {r.provider_name?.[0] || "P"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{r.provider_name}</span>
                      <Badge className={statusColor[r.status]}>{r.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">{r.provider_email}</p>
                    <div className="flex gap-3 text-xs text-slate-400 mt-1">
                      {r.start_date && <span>Since {format(new Date(r.start_date), "MMM d, yyyy")}</span>}
                      {r.next_review_date && <span>Next review: {format(new Date(r.next_review_date), "MMM d, yyyy")}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}