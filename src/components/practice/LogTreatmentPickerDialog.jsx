import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

function patientKey(p) {
  return p.id || p.email;
}

function appointmentNeedsDocs(appt, treatmentRecords) {
  const record = treatmentRecords.find((r) => r.appointment_id === appt.id);
  if (!record) return true;
  return record.status === "draft";
}

export default function LogTreatmentPickerDialog({
  open,
  onClose,
  patients,
  appointments,
  treatmentRecords,
  onStartDocumenting,
}) {
  const [selectedPatientKey, setSelectedPatientKey] = useState("");
  const [selectedApptId, setSelectedApptId] = useState("");

  useEffect(() => {
    if (!open) {
      setSelectedPatientKey("");
      setSelectedApptId("");
    }
  }, [open]);

  const selectedPatient = useMemo(
    () => patients.find((p) => patientKey(p) === selectedPatientKey),
    [patients, selectedPatientKey]
  );

  const patientAppointments = useMemo(() => {
    if (!selectedPatient) return [];
    const key = patientKey(selectedPatient);
    return appointments
      .filter((a) => {
        const apptKey = a.patient_id || a.patient_email;
        if (apptKey !== key) return false;
        return ["completed", "confirmed"].includes(a.status);
      })
      .sort((a, b) => (b.appointment_date || "").localeCompare(a.appointment_date || ""));
  }, [appointments, selectedPatient]);

  useEffect(() => {
    if (!selectedPatientKey) {
      setSelectedApptId("");
      return;
    }
    const stillValid = patientAppointments.some((a) => a.id === selectedApptId);
    if (!stillValid) {
      const preferred = patientAppointments.find((a) => appointmentNeedsDocs(a, treatmentRecords));
      setSelectedApptId(preferred?.id || patientAppointments[0]?.id || "");
    }
  }, [selectedPatientKey, patientAppointments, selectedApptId, treatmentRecords]);

  const selectedAppt = patientAppointments.find((a) => a.id === selectedApptId);
  const existingRecord = selectedAppt
    ? treatmentRecords.find((r) => r.appointment_id === selectedAppt.id) || null
    : null;

  const handleStart = () => {
    if (!selectedAppt) return;
    onStartDocumenting(selectedAppt, existingRecord);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535", fontSize: 22 }}>
            Log a Treatment
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm -mt-1" style={{ color: "rgba(30,37,53,0.55)" }}>
          Select the patient and appointment you&apos;d like to document.
        </p>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>
              1. Select patient
            </label>
            <select
              value={selectedPatientKey}
              onChange={(e) => setSelectedPatientKey(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}
            >
              <option value="">-- Choose a patient --</option>
              {patients.map((p) => {
                const key = patientKey(p);
                return (
                  <option key={key} value={key}>
                    {p.name || p.email || "Unknown patient"}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedPatientKey && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>
                2. Select appointment
              </label>
              {patientAppointments.length === 0 ? (
                <p className="text-xs rounded-xl px-3 py-2.5" style={{ background: "rgba(250,111,48,0.08)", color: "rgba(30,37,53,0.6)" }}>
                  No completed or confirmed appointments for this patient yet.
                </p>
              ) : (
                <select
                  value={selectedApptId}
                  onChange={(e) => setSelectedApptId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}
                >
                  {patientAppointments.map((a) => {
                    const record = treatmentRecords.find((r) => r.appointment_id === a.id);
                    const needsDocs = appointmentNeedsDocs(a, treatmentRecords);
                    const suffix = needsDocs
                      ? " · needs docs"
                      : record?.status === "draft"
                        ? " · draft"
                        : "";
                    return (
                      <option key={a.id} value={a.id}>
                        {a.service} · {a.appointment_date || "—"}{suffix}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          <Button
            className="w-full gap-2 h-11 rounded-xl font-bold"
            style={{ background: selectedAppt ? "#FA6F30" : "rgba(30,37,53,0.12)", color: selectedAppt ? "#fff" : "rgba(30,37,53,0.35)" }}
            disabled={!selectedAppt}
            onClick={handleStart}
          >
            <FileText className="w-4 h-4" />
            Start Documenting
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
