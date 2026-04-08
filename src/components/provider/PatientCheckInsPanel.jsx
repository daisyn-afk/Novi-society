import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, AlertTriangle, TrendingUp, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO } from "date-fns";

function CheckInDetail({ checkin, patientName }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <button 
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-600 text-white flex items-center justify-center text-xs font-bold">
            D{checkin.day_number}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{format(parseISO(checkin.date), "MMM d, yyyy")}</p>
            <p className="text-xs text-slate-500">{patientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {checkin.ai_recovery_stage && (
            <Badge variant="outline" className="bg-lime-50 text-lime-700 border-lime-200">
              {checkin.ai_recovery_stage}
            </Badge>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t bg-slate-50">
          {checkin.photo_url && (
            <img src={checkin.photo_url} alt="check-in" className="w-full max-h-48 object-cover rounded-lg mt-3" />
          )}
          
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-lime-600">{checkin.comfort_level ?? "—"}</p>
              <p className="text-xs text-slate-500">Comfort</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-orange-600">{checkin.swelling_level ?? "—"}</p>
              <p className="text-xs text-slate-500">Swelling</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-red-600">{checkin.bruising_level ?? "—"}</p>
              <p className="text-xs text-slate-500">Bruising</p>
            </div>
          </div>
          
          {checkin.symptoms?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Symptoms</p>
              <div className="flex flex-wrap gap-1">
                {checkin.symptoms.map(s => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}
          
          {checkin.ai_feedback && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <p className="text-xs font-bold text-blue-700 mb-1">AI Analysis</p>
              <p className="text-sm text-slate-700">{checkin.ai_feedback}</p>
            </div>
          )}
          
          {checkin.notes && (
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">Patient Notes</p>
              <p className="text-sm text-slate-700 italic">"{checkin.notes}"</p>
            </div>
          )}
          
          {checkin.ai_texture_score != null && (
            <div className="bg-white rounded-lg p-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-600">Recovery Progress</span>
                <span className="font-bold text-blue-600">{checkin.ai_texture_score}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-lime-500 rounded-full"
                  style={{ width: `${checkin.ai_texture_score}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PatientCheckInsPanel({ treatmentRecordId }) {
  const { data: treatmentRecord, isLoading } = useQuery({
    queryKey: ["treatment-record-checkins", treatmentRecordId],
    queryFn: () => base44.entities.TreatmentRecord.get(treatmentRecordId),
    enabled: !!treatmentRecordId,
  });

  const checkins = treatmentRecord?.patient_checkins || [];
  const flaggedCheckins = checkins.filter(c => 
    (c.swelling_level >= 4 || c.bruising_level >= 4 || c.comfort_level <= 2) &&
    c.day_number <= 7
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          Loading check-ins...
        </CardContent>
      </Card>
    );
  }

  if (checkins.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Patient Recovery Check-ins
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-slate-500">
          <p>No check-ins submitted yet</p>
          <p className="text-sm mt-1">Premium patients can submit daily recovery check-ins</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Patient Recovery Check-ins
          </CardTitle>
          <Badge variant="outline" className="bg-lime-50">
            {checkins.length} Total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">{checkins.length}</p>
            <p className="text-xs text-slate-600">Check-ins</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{treatmentRecord?.last_checkin_stage || "—"}</p>
            <p className="text-xs text-slate-600">Current Stage</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{flaggedCheckins.length}</p>
            <p className="text-xs text-slate-600">Flagged</p>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">All ({checkins.length})</TabsTrigger>
            <TabsTrigger value="flagged" className="relative">
              Flagged ({flaggedCheckins.length})
              {flaggedCheckins.length > 0 && (
                <AlertTriangle className="w-3 h-3 text-orange-600 absolute -top-1 -right-1" />
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-2 mt-4">
            {[...checkins].reverse().map((checkin, i) => (
              <CheckInDetail 
                key={i} 
                checkin={checkin} 
                patientName={treatmentRecord?.patient_name}
              />
            ))}
          </TabsContent>
          
          <TabsContent value="flagged" className="space-y-2 mt-4">
            {flaggedCheckins.length > 0 ? (
              <>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-900">Red Flags Detected</p>
                      <p className="text-xs text-orange-700 mt-0.5">
                        These check-ins show symptoms outside typical recovery ranges. Medical director has been notified.
                      </p>
                    </div>
                  </div>
                </div>
                {[...flaggedCheckins].reverse().map((checkin, i) => (
                  <CheckInDetail 
                    key={i} 
                    checkin={checkin} 
                    patientName={treatmentRecord?.patient_name}
                  />
                ))}
              </>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>No flagged check-ins</p>
                <p className="text-sm mt-1">All recovery metrics are within normal ranges</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}