import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Calendar, FileText, Image as ImageIcon, Activity, Sparkles } from "lucide-react";
import { format } from "date-fns";
import PatientCheckInsPanel from "./PatientCheckInsPanel";
import PatientAIInsightsTab from "./PatientAIInsightsTab";

export default function PatientChartView({ patientId }) {
  const { data: patient } = useQuery({
    queryKey: ["patient-chart", patientId],
    queryFn: () => base44.entities.User.get(patientId),
  });

  const { data: journey } = useQuery({
    queryKey: ["patient-journey", patientId],
    queryFn: async () => {
      const j = await base44.entities.PatientJourney.filter({ patient_id: patientId });
      return j[0] || null;
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["patient-appointments-history", patientId],
    queryFn: () => base44.entities.Appointment.filter({ patient_id: patientId }, "-appointment_date"),
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ["patient-treatments", patientId],
    queryFn: () => base44.entities.TreatmentRecord.filter({ patient_id: patientId }, "-treatment_date"),
  });

  const { data: consents = [] } = useQuery({
    queryKey: ["patient-consents", patientId],
    queryFn: () => base44.entities.ConsentForm.filter({ patient_id: patientId }),
  });

  if (!patient) return <div className="text-center py-8 text-slate-400">Loading patient chart...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Patient Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="font-semibold">{patient.full_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-sm">{patient.email}</p>
            </div>
            {patient.phone && (
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="text-sm">{patient.phone}</p>
              </div>
            )}
            {patient.date_of_birth && (
              <div>
                <p className="text-xs text-slate-500">Date of Birth</p>
                <p className="text-sm">{format(new Date(patient.date_of_birth), "MMM d, yyyy")}</p>
              </div>
            )}
            {patient.address && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500">Address</p>
                <p className="text-sm">{patient.address}, {patient.city}, {patient.state} {patient.zip}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="journey">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="ai_insights" className="flex items-center gap-1"><Sparkles className="w-3 h-3" />AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="ai_insights">
          <PatientAIInsightsTab patientId={patientId} treatments={treatments} journey={journey} />
        </TabsContent>

        <TabsContent value="journey" className="space-y-4">
          {journey ? (
            <>
              {journey.skin_concerns && journey.skin_concerns.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm font-semibold mb-2">Skin Concerns</p>
                    <div className="flex gap-2 flex-wrap">
                      {journey.skin_concerns.map(c => (
                        <Badge key={c} variant="outline">{c}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {journey.treatment_goals && journey.treatment_goals.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm font-semibold mb-2">Treatment Goals</p>
                    <div className="flex gap-2 flex-wrap">
                      {journey.treatment_goals.map(g => (
                        <Badge key={g} variant="outline">{g}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {journey.scans && journey.scans.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm font-semibold mb-2">Skin Scans</p>
                    <div className="grid grid-cols-2 gap-2">
                      {journey.scans.map((scan, i) => (
                        <div key={i} className="relative">
                          <img src={scan.scan_url} alt={scan.label || "Scan"} className="rounded-xl w-full h-32 object-cover border" />
                          <p className="text-xs text-slate-500 mt-1">{scan.label} | {scan.scanned_at ? format(new Date(scan.scanned_at), "MMM d") : ""}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {journey.tier === "premium" && (
                <Card>
                  <CardContent className="pt-4">
                    <Badge style={{ background: "#C8E63C", color: "#1e2535" }}>Novi Premium Member</Badge>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-center py-8 text-slate-400">No journey data available</p>
          )}
        </TabsContent>

        <TabsContent value="checkins" className="space-y-3">
          {treatments.length > 0 ? (
            treatments.map(t => (
              <PatientCheckInsPanel key={t.id} treatmentRecordId={t.id} />
            ))
          ) : (
            <p className="text-center py-8 text-slate-400">No treatments to track check-ins for</p>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {appointments.length === 0 ? (
            <p className="text-center py-8 text-slate-400">No appointment history</p>
          ) : (
            appointments.map(a => (
              <Card key={a.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{a.service}</span>
                    <Badge variant="outline">{a.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    {a.appointment_date ? format(new Date(a.appointment_date), "MMM d, yyyy") : ""} {a.appointment_time && `at ${a.appointment_time}`}
                  </p>
                  {a.patient_notes && <p className="text-xs text-slate-600 mt-1">Notes: {a.patient_notes}</p>}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="treatments" className="space-y-3">
          {treatments.length === 0 ? (
            <p className="text-center py-8 text-slate-400">No treatment records</p>
          ) : (
            treatments.map(t => (
              <Card key={t.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{t.service}</p>
                      <p className="text-xs text-slate-500">{t.treatment_date ? format(new Date(t.treatment_date), "MMM d, yyyy") : ""}</p>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {(t.before_photo_urls?.length || 0) + (t.after_photo_urls?.length || 0)} photos
                    </Badge>
                  </div>
                  {t.areas_treated && t.areas_treated.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {t.areas_treated.map(area => (
                        <Badge key={area} variant="outline" className="text-xs">{area}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="consents" className="space-y-3">
          {consents.length === 0 ? (
            <p className="text-center py-8 text-slate-400">No consent forms signed</p>
          ) : (
            consents.map(c => (
              <Card key={c.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{c.service_type}</p>
                      <p className="text-xs text-slate-500">
                        Signed: {c.signed_at ? format(new Date(c.signed_at), "MMM d, yyyy h:mm a") : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-600">Signed</Badge>
                  </div>
                  {c.medical_history && (
                    <div className="mt-2 pt-2 border-t text-xs space-y-1">
                      {c.medical_history.allergies && <p><span className="font-semibold">Allergies:</span> {c.medical_history.allergies}</p>}
                      {c.medical_history.current_medications && <p><span className="font-semibold">Medications:</span> {c.medical_history.current_medications}</p>}
                      {c.medical_history.medical_conditions && <p><span className="font-semibold">Conditions:</span> {c.medical_history.medical_conditions}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}