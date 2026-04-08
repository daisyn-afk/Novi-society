import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Search, Flag, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export default function AdminReviews() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews"],
    queryFn: () => base44.entities.Review.list("-created_date"),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Review.update(id, data),
    onSuccess: () => qc.invalidateQueries(["reviews"]),
  });

  const filtered = reviews.filter(r => !search || r.patient_name?.toLowerCase().includes(search.toLowerCase()) || r.comment?.toLowerCase().includes(search.toLowerCase()));

  const renderStars = (rating) => Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
  ));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Reviews</h2>
        <p className="text-slate-500 text-sm mt-1">{reviews.filter(r => r.is_flagged && !r.is_verified).length} flagged for review</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Search reviews..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className={r.is_flagged && !r.is_verified ? "border-red-200" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{r.patient_name || "Anonymous"}</span>
                      <div className="flex">{renderStars(r.rating)}</div>
                      {r.is_flagged && <Badge className="bg-red-100 text-red-700 text-xs"><Flag className="w-3 h-3 mr-1" />Flagged</Badge>}
                      {r.is_verified && <Badge className="bg-green-100 text-green-700 text-xs">Verified</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{r.comment}</p>
                    {r.flag_reason && <p className="text-xs text-red-500 mt-1">Flag reason: {r.flag_reason}</p>}
                    <p className="text-xs text-slate-400 mt-1">{r.created_date ? format(new Date(r.created_date), "MMM d, yyyy") : ""}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!r.is_verified && (
                      <Button size="sm" variant="outline" className="text-green-600"
                        onClick={() => update.mutate({ id: r.id, data: { is_verified: true, is_flagged: false } })}>
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                    )}
                    {!r.is_flagged && (
                      <Button size="sm" variant="outline" className="text-red-500"
                        onClick={() => update.mutate({ id: r.id, data: { is_flagged: true, flag_reason: "Admin flagged" } })}>
                        <Flag className="w-3.5 h-3.5 mr-1" /> Flag
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-red-500"
                      onClick={() => base44.entities.Review.delete(r.id).then(() => qc.invalidateQueries(["reviews"]))}>
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center text-slate-400 py-10">No reviews found</p>}
        </div>
      )}
    </div>
  );
}