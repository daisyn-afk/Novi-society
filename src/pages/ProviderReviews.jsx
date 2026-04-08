import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import ServiceLockGate from "@/components/ServiceLockGate";

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-4 h-4 ${i <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
      ))}
    </div>
  );
}

export default function ProviderReviews() {
  const qc = useQueryClient();
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Review.filter({ provider_id: me.id }, "-created_date");
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Review.update(id, {
      response: replyText,
      responded_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-reviews"] });
      setReplyingTo(null);
      setReplyText("");
    },
  });

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <ServiceLockGate feature="appointments" bypass>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
              Patient Reviews
            </h2>
            <p className="text-sm mt-1" style={{ color: "#6B7DB3" }}>
              {reviews.length} review{reviews.length !== 1 ? "s" : ""}{avgRating ? ` · ${avgRating} avg rating` : ""}
            </p>
          </div>
          {avgRating && (
            <div className="text-center bg-white rounded-xl px-5 py-3 border border-slate-200 shadow-sm">
              <p className="text-3xl font-bold text-slate-900">{avgRating}</p>
              <StarRating rating={Math.round(avgRating)} />
              <p className="text-xs text-slate-400 mt-1">{reviews.length} reviews</p>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
            <Star className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 font-medium">No reviews yet</p>
            <p className="text-slate-400 text-sm mt-1">Reviews from patients will appear here once they book and complete appointments.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <Card key={r.id}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{r.patient_name || "Anonymous"}</p>
                        {r.is_verified && (
                          <Badge className="bg-green-100 text-green-700 text-xs gap-1">
                            <CheckCircle className="w-3 h-3" /> Verified
                          </Badge>
                        )}
                        {r.is_flagged && (
                          <Badge className="bg-red-100 text-red-700 text-xs">Flagged</Badge>
                        )}
                      </div>
                      <StarRating rating={r.rating} />
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {r.created_date ? format(new Date(r.created_date), "MMM d, yyyy") : ""}
                    </span>
                  </div>

                  {r.comment && <p className="text-slate-700 text-sm">{r.comment}</p>}

                  {r.response ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Your Response</p>
                      <p className="text-sm text-blue-800">{r.response}</p>
                      <p className="text-xs text-blue-400 mt-1">
                        {r.responded_at ? format(new Date(r.responded_at), "MMM d, yyyy") : ""}
                      </p>
                    </div>
                  ) : replyingTo === r.id ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Write a professional response to this review..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          style={{ background: "#FA6F30", color: "#fff" }}
                          onClick={() => replyMutation.mutate({ id: r.id })}
                          disabled={!replyText.trim() || replyMutation.isPending}
                        >
                          {replyMutation.isPending ? "Posting..." : "Post Reply"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => { setReplyingTo(r.id); setReplyText(""); }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Respond
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ServiceLockGate>
  );
}