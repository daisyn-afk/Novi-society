import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";

const CONSENT_TEMPLATE = `INFORMED CONSENT FOR AESTHETIC TREATMENT

I hereby consent to the aesthetic treatment as discussed with my provider. I understand:

1. The nature and purpose of the procedure
2. Potential risks, complications, and side effects
3. Alternative treatment options
4. Expected results and recovery time
5. The importance of following post-treatment care instructions

I confirm that I have disclosed all relevant medical history, medications, and allergies. I understand that results may vary and are not guaranteed.

I authorize the provider to perform the agreed-upon treatment and take necessary photographs for medical records.`;

export default function ConsentFormDialog({ open, onClose, appointment, onComplete }) {
  const qc = useQueryClient();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  const [medHistory, setMedHistory] = useState({
    allergies: "",
    current_medications: "",
    previous_treatments: "",
    medical_conditions: "",
    pregnancy_status: "",
  });

  const startDrawing = (e) => {
    setIsDrawing(true);
    setHasSigned(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const saveConsent = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      const signatureData = canvas.toDataURL();
      const user = await base44.auth.me();

      await base44.entities.ConsentForm.create({
        appointment_id: appointment.id,
        patient_id: user.id,
        patient_email: user.email,
        patient_name: user.full_name,
        provider_id: appointment.provider_id,
        service_type: appointment.service,
        consent_text: CONSENT_TEMPLATE,
        medical_history: medHistory,
        signature_data: signatureData,
        signed_at: new Date().toISOString(),
        status: "signed",
      });

      await base44.entities.Appointment.update(appointment.id, { 
        consent_signed: true,
        status: 'confirmed'
      });

      // Notify provider that consent is complete
      await base44.entities.Notification.create({
        user_id: appointment.provider_id,
        user_email: appointment.provider_email,
        type: 'general',
        message: `${user.full_name} completed their consent form for ${appointment.service} appointment`,
        link_page: 'ProviderAppointments'
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(["patient-appointments"]);
      onComplete?.();
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informed Consent Form</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Treatment: {appointment?.service}</p>
            <p className="text-sm text-slate-500">Provider: {appointment?.provider_name}</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-600 whitespace-pre-line max-h-48 overflow-y-auto border border-slate-200">
            {CONSENT_TEMPLATE}
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Medical History</h3>
            
            <div>
              <Label>Allergies</Label>
              <Input value={medHistory.allergies} onChange={e => setMedHistory({...medHistory, allergies: e.target.value})} placeholder="Any known allergies..." />
            </div>

            <div>
              <Label>Current Medications</Label>
              <Textarea value={medHistory.current_medications} onChange={e => setMedHistory({...medHistory, current_medications: e.target.value})} placeholder="List all medications you're currently taking..." rows={2} />
            </div>

            <div>
              <Label>Previous Aesthetic Treatments</Label>
              <Textarea value={medHistory.previous_treatments} onChange={e => setMedHistory({...medHistory, previous_treatments: e.target.value})} placeholder="Any previous botox, fillers, or other treatments..." rows={2} />
            </div>

            <div>
              <Label>Medical Conditions</Label>
              <Textarea value={medHistory.medical_conditions} onChange={e => setMedHistory({...medHistory, medical_conditions: e.target.value})} placeholder="Any medical conditions we should know about..." rows={2} />
            </div>

            <div>
              <Label>Pregnancy Status</Label>
              <Input value={medHistory.pregnancy_status} onChange={e => setMedHistory({...medHistory, pregnancy_status: e.target.value})} placeholder="Are you pregnant or breastfeeding?" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Electronic Signature *</Label>
              <Button variant="ghost" size="sm" onClick={clearSignature} className="text-xs">Clear</Button>
            </div>
            <canvas
              ref={canvasRef}
              width={600}
              height={150}
              className="border-2 border-dashed border-slate-300 rounded-xl w-full cursor-crosshair bg-white"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={() => setIsDrawing(false)}
              onMouseLeave={() => setIsDrawing(false)}
            />
            <p className="text-xs text-slate-400 mt-1">Sign above with your mouse or touchscreen</p>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => saveConsent.mutate()}
              disabled={!hasSigned || saveConsent.isPending}
              style={{ background: "#1e2535", color: "#fff" }}
              className="gap-2"
            >
              {saveConsent.isPending ? "Saving..." : "Sign & Submit"}
              {hasSigned && <CheckCircle2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}