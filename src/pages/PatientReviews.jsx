import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, Plus } from "lucide-react";
import { format } from "date-fns";

export default function PatientReviews() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ rating: 5, comment: "" });
  const [selectedAppt, setSelectedAppt] = useState(null);
  const qc = useQueryClient();

  const { data: appointments = [] } = useQuery({
    queryKey: ["patient-appointments"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Appointment.filter({ patient_id: me.id });
    },
  });

  const { data: myReviews = [], isLoading } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Review.filter({ patient_id: me.id }, "-created_date");
    },
  });

  const reviewedApptIds = new Set(myReviews.map(r => r.appointment_id));
  const completedUnreviewed = appointments.filter(a => a.status === "completed" && !reviewedApptIds.has(a.id));

  const create = useMutation({
    mutationFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Review.create({
        patient_id: me.id,
        patient_name: me.full_name,
        provider_id: selectedAppt.provider_id,
        appointment_id: selectedAppt.id,
        rating: form.rating,
        comment: form.comment,
      });
    },
    onSuccess: () => { qc.invalidateQueries(["my-reviews"]); setOpen(false); setForm({ rating: 5, comment: "" }); setSelectedAppt(null); },
  });

  const renderStars = (rating, interactive = false) => Array.from({ length: 5 }, (_, i) => (
    <Star key={i}
      className={`w-5 h-5 cursor-${interactive ? "pointer" : "default"} ${i < rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
      onClick={interactive ? () => setForm({ ...form, rating: i + 1 }) : undefined}
    />
  ));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Reviews</h2>
        <p className="text-slate-500 text-sm mt-1">{myReviews.length} reviews written</p>
      </div>

      {completedUnreviewed.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <p className="font-semibold text-amber-800 mb-3">Leave a Review ({completedUnreviewed.length})</p>
            <div className="space-y-2">
              {completedUnreviewed.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.service}</p>
                    <p className="text-xs text-slate-500">with {a.provider_name}</p>
                  </div>
                  <Button size="sm" style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}
                    onClick={() => { setSelectedAppt(a); setOpen(true); }}>
                    <Star className="w-3.5 h-3.5 mr-1" /> Review
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
      ) : myReviews.length === 0 ? (
        <div className="text-center py-10 text-slate-400">No reviews yet. Complete an appointment to leave a review.</div>
      ) : (
        <div className="space-y-3">
          {myReviews.map(r => (
            <Card key={r.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex gap-2 mb-1">{renderStars(r.rating)}</div>
                <p className="text-sm text-slate-700">{r.comment}</p>
                <p className="text-xs text-slate-400 mt-1">{r.created_date ? format(new Date(r.created_date), "MMM d, yyyy") : ""}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Leave a Review</DialogTitle></DialogHeader>
          {selectedAppt && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-sm">
                <p className="font-medium text-slate-800">{selectedAppt.service}</p>
                <p className="text-slate-500">with {selectedAppt.provider_name}</p>
              </div>
              <div>
                <Label>Rating</Label>
                <div className="flex gap-1 mt-1">{renderStars(form.rating, true)}</div>
              </div>
              <div>
                <Label>Comment</Label>
                <Textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} rows={3} placeholder="Share your experience..." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button style={{ background: "var(--novi-gold)", color: "#1A1A2E" }} onClick={() => create.mutate()} disabled={create.isPending}>
                  Submit Review
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}