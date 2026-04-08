import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import PracticeProfileTab from "@/components/practice/PracticeProfileTab.jsx";
import PracticeTreatmentsTab from "@/components/practice/PracticeTreatmentsTab.jsx";
import PracticeAppointmentsTab from "@/components/practice/PracticeAppointmentsTab.jsx";
import PracticePatientsTab from "@/components/practice/PracticePatientsTab.jsx";
import PracticeAnalyticsTab from "@/components/practice/PracticeAnalyticsTab.jsx";
import { Stethoscope, Sparkles, Calendar, Users, AlertTriangle, Star, MessageSquare, CheckCircle, TrendingUp, Rocket, ArrowRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-4 h-4 ${i <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
      ))}
    </div>
  );
}

export default function ProviderPractice() {
  const { status: accessStatus } = useProviderAccess();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({
    practice_name: "", bio: "", city: "", state: "", phone: "",
    consultation_fee: "", accepts_new_patients: true, avatar_url: "",
    instagram: "", website: "",
  });
  const [initialized, setInitialized] = useState(false);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: appointments = [] } = useQuery({
    queryKey: ["my-appointments"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Appointment.filter({ provider_id: user.id }, "-appointment_date");
    },
  });

  const { data: mdSubs = [] } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: user.id });
    },
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  useEffect(() => {
    if (me && !initialized) {
      setForm({
        practice_name: me.practice_name || "",
        bio: me.bio || "",
        city: me.city || "",
        state: me.state || "",
        phone: me.phone || "",
        consultation_fee: me.consultation_fee || "",
        accepts_new_patients: me.accepts_new_patients ?? true,
        avatar_url: me.avatar_url || "",
        instagram: me.instagram || "",
        website: me.website || "",
      });
      setInitialized(true);
    }
  }, [me, initialized]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      qc.invalidateQueries(["me"]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleSave = (extra = {}) => saveMutation.mutate({ ...form, ...extra });

  const { data: reviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Review.filter({ provider_id: user.id }, "-created_date");
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

  const activeServiceIds = new Set(
    mdSubs.filter(s => s.status === "active").map(s => s.service_type_id)
  );

  const pendingCount = appointments.filter(a => a.status === "requested").length;

  const { data: treatmentRecords = [] } = useQuery({
    queryKey: ["treatment-records"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.TreatmentRecord.filter({ provider_id: user.id }, "-created_date");
    },
  });

  const { data: manufacturerApplications = [] } = useQuery({
    queryKey: ["my-manufacturer-applications-practice"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.ManufacturerApplication.filter({ provider_id: user.id });
    },
    enabled: !!me,
  });

  const flaggedRecords = treatmentRecords.filter(r => r.status === "flagged" || r.status === "changes_requested");

  const patients = Object.values(
    appointments.reduce((acc, a) => {
      const key = a.patient_id || a.patient_email;
      if (!acc[key]) {
        acc[key] = { id: a.patient_id, name: a.patient_name, email: a.patient_email, appointments: [] };
      }
      acc[key].appointments.push(a);
      return acc;
    }, {})
  );

  const NAV_ITEMS = [
    { value: "profile", label: "Profile", icon: Sparkles, desc: "Your public page" },
    { value: "treatments", label: "Treatments", icon: Stethoscope, desc: "Services & pricing" },
    { value: "appointments", label: "Appointments", icon: Calendar, desc: "Your schedule", badge: pendingCount },
    { value: "patients", label: "Patients", icon: Users, desc: "Your patient list", badge: flaggedRecords.length, badgeRed: true },
    { value: "performance", label: "Performance", icon: TrendingUp, desc: "Reviews & analytics" },
  ];

  const practiceContent = (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#DA6A63" }}>Provider</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "#1e2535", lineHeight: 1.15 }}>My Practice</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(30,37,53,0.5)" }}>
          Everything you need to run your practice, all in one place.
        </p>
      </div>

      {flaggedRecords.length > 0 && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl mb-5" style={{ background: "rgba(250,111,48,0.1)", border: "1px solid rgba(250,111,48,0.35)" }}>
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#FA6F30" }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>
              Action Required: {flaggedRecords.length} treatment record{flaggedRecords.length > 1 ? "s" : ""} need{flaggedRecords.length === 1 ? "s" : ""} attention
            </p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
              Your MD has flagged or requested changes. Open the Patients tab to review and resubmit.
            </p>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>

        {/* Icon nav grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
          {NAV_ITEMS.map(({ value, label, icon: Icon, desc, badge, badgeRed }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className="relative flex flex-col items-center justify-center gap-1.5 px-2 py-3.5 rounded-2xl text-center transition-all cursor-pointer outline-none"
                style={{
                  background: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
                  border: isActive ? "2px solid rgba(200,230,60,0.5)" : "1.5px solid rgba(30,37,53,0.07)",
                  boxShadow: isActive ? "0 4px 16px rgba(30,37,53,0.1)" : "none",
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isActive ? "rgba(200,230,60,0.18)" : "rgba(30,37,53,0.05)" }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: isActive ? "#4a6b10" : "rgba(30,37,53,0.45)", width: 18, height: 18 }} />
                </div>
                <p className="text-xs font-bold leading-tight" style={{ color: isActive ? "#1e2535" : "rgba(30,37,53,0.5)" }}>{label}</p>
                <p className="text-[10px] leading-tight hidden sm:block" style={{ color: isActive ? "rgba(30,37,53,0.5)" : "rgba(30,37,53,0.35)" }}>{desc}</p>
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ background: badgeRed ? "#dc2626" : "#FA6F30" }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        <TabsContent value="profile" className="pt-1">
          <PracticeProfileTab form={form} setForm={setForm} me={me} onSave={handleSave} saving={saveMutation.isPending} saved={saved} serviceTypes={serviceTypes} activeServiceIds={activeServiceIds} manufacturerApplications={manufacturerApplications} />
        </TabsContent>
        <TabsContent value="treatments" className="pt-1">
          <PracticeTreatmentsTab me={me} serviceTypes={serviceTypes} activeServiceIds={activeServiceIds} mdSubs={mdSubs} onSave={handleSave} saving={saveMutation.isPending} saved={saved} />
        </TabsContent>
        <TabsContent value="appointments" className="pt-1">
          <PracticeAppointmentsTab appointments={appointments} />
        </TabsContent>
        <TabsContent value="patients" className="pt-1">
          <PracticePatientsTab patients={patients} appointments={appointments} />
        </TabsContent>
        <TabsContent value="performance" className="pt-1">
          <div className="space-y-8 max-w-3xl">
            {/* Launch Pad nudge when no appointments */}
            {appointments.length === 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1e2535 0%, #2a3550 100%)", boxShadow: "0 4px 24px rgba(30,37,53,0.15)" }}>
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.2)" }}>
                      <Rocket className="w-6 h-6" style={{ color: "#C8E63C" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "rgba(200,230,60,0.7)" }}>Your numbers are quiet</p>
                      <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#fff", lineHeight: 1.25 }}>Let's build your practice before patients arrive.</h3>
                      <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                        Your Launch Pad has tools to help you set your pricing, create social media content, and get personalized business coaching — all before your first booking comes in.
                      </p>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { label: "ROI Calculator", desc: "Find the right price for every service" },
                          { label: "Creative Studio", desc: "Get Instagram-ready captions instantly" },
                          { label: "Ask Your Mentor", desc: "AI coaching for any business question" },
                        ].map(item => (
                          <div key={item.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <p className="text-xs font-bold" style={{ color: "#C8E63C" }}>{item.label}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{item.desc}</p>
                          </div>
                        ))}
                      </div>
                      <a href="/ProviderLaunchPad" className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                        style={{ background: "#C8E63C", color: "#1e2535" }}>
                        Open Launch Pad <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Analytics first */}
            <PracticeAnalyticsTab appointments={appointments} reviews={reviews} />

            {/* Reviews */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(30,37,53,0.35)" }}>Patient Reviews</p>
              {avgRating && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.08)" }}>
                  <div className="text-center">
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 28, color: "#1e2535", lineHeight: 1 }}>{avgRating}</p>
                    <StarRating rating={Math.round(avgRating)} />
                  </div>
                  <div className="h-8 w-px" style={{ background: "rgba(30,37,53,0.1)" }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                      {reviews.filter(r => r.response).length} responded · {reviews.filter(r => r.is_verified).length} verified
                    </p>
                  </div>
                </div>
              )}
              {loadingReviews ? (
                <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.4)" }} />)}</div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-10 rounded-2xl" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(30,37,53,0.08)" }}>
                  <Star className="w-7 h-7 mx-auto mb-2" style={{ color: "rgba(30,37,53,0.2)" }} />
                  <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>No reviews yet</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.45)" }}>Reviews appear here after patients complete appointments.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map(r => (
                    <div key={r.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(30,37,53,0.07)" }}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "rgba(123,142,200,0.15)", color: "#7B8EC8" }}>{(r.patient_name || "A")[0]}</div>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>{r.patient_name || "Anonymous"}</p>
                            <StarRating rating={r.rating} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {r.is_verified && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5" /> Verified</span>}
                          <span className="text-[10px]" style={{ color: "rgba(30,37,53,0.35)" }}>{r.created_date ? format(new Date(r.created_date), "MMM d") : ""}</span>
                        </div>
                      </div>
                      {r.comment && <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>{r.comment}</p>}
                      {r.response ? (
                        <div className="mt-2 rounded-lg px-2.5 py-2" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)" }}>
                          <p className="text-[10px] font-bold mb-0.5" style={{ color: "#7B8EC8" }}>Your response</p>
                          <p className="text-xs" style={{ color: "rgba(30,37,53,0.65)" }}>{r.response}</p>
                        </div>
                      ) : replyingTo === r.id ? (
                        <div className="mt-2 space-y-2">
                          <Textarea placeholder="Write a response..." value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} className="text-xs" />
                          <div className="flex gap-2">
                            <Button size="sm" style={{ background: "#FA6F30", color: "#fff" }} onClick={() => replyMutation.mutate({ id: r.id })} disabled={!replyText.trim() || replyMutation.isPending}>
                              {replyMutation.isPending ? "Posting..." : "Post Reply"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setReplyText(""); }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <button className="mt-1.5 text-[10px] font-semibold flex items-center gap-1 hover:underline" style={{ color: "rgba(30,37,53,0.4)" }} onClick={() => { setReplyingTo(r.id); setReplyText(""); }}>
                          <MessageSquare className="w-3 h-3" /> Reply
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <ProviderSalesLock feature="practice" applicationStatus={accessStatus} requiredTier="full">
      {practiceContent}
    </ProviderSalesLock>
  );
}