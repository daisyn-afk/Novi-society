import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText } from "lucide-react";
import { appointmentServiceLabel, formatAppointmentDate } from "@/lib/appointmentDisplay";

function patientKey(appt) {
  return String(appt?.patient_id || appt?.patient_email || "").trim();
}

function buildPatientsFromAppointments(appointments) {
  const byKey = new Map();
  for (const appt of appointments || []) {
    if (String(appt?.status || "").toLowerCase() !== "completed") continue;
    const key = patientKey(appt);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        id: appt.patient_id,
        name: appt.patient_name || appt.patient_email || "Patient",
        email: appt.patient_email,
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function formatApptOptionLabel(appt, hasRecord) {
  const service = appointmentServiceLabel(appt) || "Appointment";
  const date = formatAppointmentDate(appt.appointment_date, "MMM d, yyyy");
  const time = appt.appointment_time ? ` · ${appt.appointment_time}` : "";
  const suffix = hasRecord ? " (has record)" : "";
  return `${service} — ${date}${time}${suffix}`;
}

export default function QuickLogTreatmentDialog({
  open,
  onClose,
  appointments = [],
  treatmentRecords = [],
  onStartDocumenting,
}) {
  const [selectedPatientKey, setSelectedPatientKey] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");

  const documentedApptIds = useMemo(
    () => new Set((treatmentRecords || []).map((r) => r.appointment_id).filter(Boolean)),
    [treatmentRecords]
  );

  const patients = useMemo(
    () => buildPatientsFromAppointments(appointments),
    [appointments]
  );

  const completedForPatient = useMemo(() => {
    if (!selectedPatientKey) return [];
    return (appointments || [])
      .filter(
        (a) =>
          String(a?.status || "").toLowerCase() === "completed" &&
          patientKey(a) === selectedPatientKey
      )
      .sort((a, b) => {
        const av = a.appointment_date || "";
        const bv = b.appointment_date || "";
        return av < bv ? 1 : av > bv ? -1 : 0;
      });
  }, [appointments, selectedPatientKey]);

  const selectedAppointment = useMemo(
    () => completedForPatient.find((a) => String(a.id) === selectedAppointmentId) || null,
    [completedForPatient, selectedAppointmentId]
  );

  const existingRecord = useMemo(() => {
    if (!selectedAppointmentId) return null;
    return (treatmentRecords || []).find((r) => r.appointment_id === selectedAppointmentId) || null;
  }, [treatmentRecords, selectedAppointmentId]);

  useEffect(() => {
    if (!open) {
      setSelectedPatientKey("");
      setSelectedAppointmentId("");
    }
  }, [open]);

  useEffect(() => {
    setSelectedAppointmentId("");
  }, [selectedPatientKey]);

  const canStart = Boolean(selectedPatientKey && selectedAppointmentId && selectedAppointment);

  const handleStart = () => {
    if (!canStart || !onStartDocumenting) return;
    onStartDocumenting(selectedAppointment, existingRecord);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}>
            Log a Treatment
          </DialogTitle>
          <p className="text-sm text-slate-500 pt-1">
            Select the patient and appointment you&apos;d like to document.
          </p>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              1. Select Patient
            </Label>
            {patients.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">
                No completed appointments yet. Mark an appointment complete first, then return here to document it.
              </p>
            ) : (
              <Select value={selectedPatientKey} onValueChange={setSelectedPatientKey}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="— Choose a patient —" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              2. Select Appointment
            </Label>
            <Select
              value={selectedAppointmentId}
              onValueChange={setSelectedAppointmentId}
              disabled={!selectedPatientKey || completedForPatient.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="— Choose an appointment —" />
              </SelectTrigger>
              <SelectContent>
                {completedForPatient.map((appt) => (
                  <SelectItem key={appt.id} value={String(appt.id)}>
                    {formatApptOptionLabel(appt, documentedApptIds.has(appt.id))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPatientKey && completedForPatient.length === 0 && (
              <p className="text-xs text-slate-500">No completed appointments for this patient.</p>
            )}
          </div>

          <Button
            className="w-full gap-2"
            style={{ background: canStart ? "#FA6F30" : undefined, color: canStart ? "#fff" : undefined }}
            disabled={!canStart}
            onClick={handleStart}
          >
            <FileText className="w-4 h-4" />
            {existingRecord ? "Open Treatment Record" : "Start Documenting"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
