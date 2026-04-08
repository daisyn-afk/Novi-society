import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, Search, Sparkles, Heart, ChevronRight } from "lucide-react";
import PatientDetailModal from "@/components/practice/PatientDetailModal.jsx";

const GlassCard = ({ children, onClick }) => (
  <div onClick={onClick} className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg"
    style={{ background: "rgba(255,255,255,0.45)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 2px 16px rgba(30,37,53,0.06)" }}>
    {children}
  </div>
);

export default function PracticePatientsTab({ patients, appointments }) {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  const { data: treatmentRecords = [] } = useQuery({
    queryKey: ["treatment-records"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.TreatmentRecord.filter({ provider_id: me.id }, "-created_date");
    },
  });

  const { data: patientJourneys = [] } = useQuery({
    queryKey: ["patient-journeys-provider"],
    queryFn: () => base44.entities.PatientJourney.list("-created_date", 200),
    enabled: patients.length > 0,
  });

  const filtered = patients.filter(p =>
    !search || (p.name || p.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedJourney = selectedPatient
    ? patientJourneys.find(j => j.patient_id === selectedPatient.id)
    : null;

  const selectedAppts = selectedPatient
    ? appointments.filter(a => a.patient_id === selectedPatient.id || a.patient_email === selectedPatient.email)
    : [];

  return (
    <div className="space-y-4">
      {/* NOVI Premium upsell banner */}
      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "linear-gradient(135deg, rgba(200,230,60,0.12) 0%, rgba(123,142,200,0.1) 100%)", border: "1px solid rgba(200,230,60,0.35)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.2)" }}>
          <Heart style={{ color: "#4a6b10", width: 18, height: 18 }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: "#1e2535" }}>Boost Patient Retention with NOVI Premium</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
            Patients on NOVI Premium receive AI-personalized aftercare plans and daily recovery check-ins after every treatment — keeping them engaged with <em>you</em> between visits.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
        <input
          placeholder="Search patients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.45)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.85)", color: "#1e2535" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
          <p className="text-sm font-medium" style={{ color: "#1e2535" }}>No patients yet</p>
          <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.45)" }}>Patients will appear here once they book with you.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const key = p.id || p.email;
            const journey = patientJourneys.find(j => j.patient_id === p.id);
            const isPremium = journey?.tier === "premium" && journey?.subscription_status === "active";
            const patientRecords = treatmentRecords.filter(r => r.patient_id === p.id);
            const completedAppts = p.appointments.filter(a => a.status === "completed");

            return (
              <GlassCard key={key} onClick={() => setSelectedPatient(p)}>
                <div className="p-4 flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: isPremium ? "linear-gradient(135deg, #C8E63C, #7B8EC8)" : "rgba(123,142,200,0.5)" }}>
                      {(p.name || p.email || "?")[0].toUpperCase()}
                    </div>
                    {isPremium && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#C8E63C", border: "2px solid white" }}>
                        <Sparkles className="w-2 h-2" style={{ color: "#1a2a00" }} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: "#1e2535" }}>{p.name || "Unknown"}</p>
                      {isPremium && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.4)" }}>
                          <Sparkles className="w-2.5 h-2.5" />NOVI+
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: "rgba(30,37,53,0.5)" }}>{p.email}</p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>{completedAppts.length} treatment{completedAppts.length !== 1 ? "s" : ""}</p>
                      <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>{patientRecords.length} documented</p>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: "rgba(30,37,53,0.3)" }} />
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          journey={selectedJourney}
          treatmentRecords={treatmentRecords}
          appointments={selectedAppts}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </div>
  );
}