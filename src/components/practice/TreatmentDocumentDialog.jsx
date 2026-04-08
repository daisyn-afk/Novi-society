import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Upload, CheckCircle, AlertTriangle } from "lucide-react";
import AftercarePlanDialog from "./AftercarePlanDialog";

const COMMON_AREAS = ["Forehead", "Glabella", "Crow's Feet", "Lip", "Chin", "Jawline", "Cheeks", "Neck", "Nasolabial Folds", "Marionette Lines"];

export default function TreatmentDocumentDialog({ open, onClose, appointment, existingRecord }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({});
  const [products, setProducts] = useState([{ product_name: "", batch_lot: "", amount: "" }]);
  const [areas, setAreas] = useState([]);
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [uploading, setUploading] = useState({ before: false, after: false });
  const [showAftercarePlan, setShowAftercarePlan] = useState(false);
  const [savedRecord, setSavedRecord] = useState(null);
  const [patientJourney, setPatientJourney] = useState(null);

  // Check if patient is premium (has PatientJourney)
  useEffect(() => {
    const checkPremium = async () => {
      if (!appointment?.patient_id || !open) return;
      try {
        const journeys = await base44.entities.PatientJourney.filter({ patient_id: appointment.patient_id });
        setPatientJourney(journeys[0] || null);
      } catch (e) {
        setPatientJourney(null);
      }
    };
    checkPremium();
  }, [appointment?.patient_id, open]);

  // Autofill from appointment
  useEffect(() => {
    if (!open) return;
    if (existingRecord) {
      setForm({
        units_used: existingRecord.units_used || "",
        units_label: existingRecord.units_label || "units",
        clinical_notes: existingRecord.clinical_notes || "",
        adverse_reaction: existingRecord.adverse_reaction || false,
        adverse_reaction_notes: existingRecord.adverse_reaction_notes || "",
      });
      setProducts(existingRecord.products_used?.length ? existingRecord.products_used : [{ product_name: "", batch_lot: "", amount: "" }]);
      setAreas(existingRecord.areas_treated || []);
      setBeforePhotos(existingRecord.before_photo_urls || []);
      setAfterPhotos(existingRecord.after_photo_urls || []);
    } else if (appointment) {
      setForm({ units_used: "", units_label: "units", clinical_notes: "", adverse_reaction: false, adverse_reaction_notes: "" });
      setProducts([{ product_name: "", batch_lot: "", amount: "" }]);
      setAreas([]);
      setBeforePhotos([]);
      setAfterPhotos([]);
    }
  }, [open, appointment, existingRecord]);

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleArea = (area) => {
    setAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };

  const uploadPhoto = async (file, type) => {
    setUploading(u => ({ ...u, [type]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (type === "before") setBeforePhotos(p => [...p, file_url]);
    else setAfterPhotos(p => [...p, file_url]);
    setUploading(u => ({ ...u, [type]: false }));
  };

  const save = useMutation({
    mutationFn: async (status) => {
      const me = await base44.auth.me();
      const payload = {
        appointment_id: appointment.id,
        provider_id: appointment.provider_id,
        provider_name: appointment.provider_name,
        provider_email: appointment.provider_email,
        patient_id: appointment.patient_id,
        patient_name: appointment.patient_name,
        patient_email: appointment.patient_email,
        service: appointment.service,
        treatment_date: appointment.appointment_date,
        areas_treated: areas,
        products_used: products.filter(p => p.product_name),
        before_photo_urls: beforePhotos,
        after_photo_urls: afterPhotos,
        status,
        ...form,
      };
      let record;
      if (existingRecord) {
        record = await base44.entities.TreatmentRecord.update(existingRecord.id, payload);
      } else {
        record = await base44.entities.TreatmentRecord.create(payload);
      }
      // Escalate adverse reactions automatically
      if (status === 'submitted' && payload.adverse_reaction) {
        await base44.functions.invoke('adverseReactionEscalation', { treatment_record_id: record.id });
      }
      return record;
    },
    onSuccess: (record) => {
      qc.invalidateQueries(["treatment-records"]);
      // Only show aftercare dialog for premium patients
      if (patientJourney) {
        setSavedRecord(record);
        setShowAftercarePlan(true);
      } else {
        onClose();
      }
    },
  });

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
            Document Treatment
          </DialogTitle>
        </DialogHeader>

        {/* Autofilled header */}
        <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: "#F0EDE8" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: "#243257" }}>{appointment.service}</span>
            <Badge className="text-xs border-0" style={{ background: "rgba(107,125,179,0.15)", color: "#6B7DB3" }}>{appointment.appointment_date}</Badge>
            {patientJourney && (
              <Badge className="text-xs font-bold border-0" style={{ background: "rgba(200,230,60,0.2)", color: "#5a7a20", border: "1px solid rgba(200,230,60,0.35)" }}>
                Premium Patient
              </Badge>
            )}
          </div>
          <p className="text-xs" style={{ color: "#9a8f7e" }}>Patient: {appointment.patient_name || appointment.patient_email}</p>
        </div>

        {/* Premium Aftercare Notice */}
        {patientJourney && (
          <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.2)" }}>
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#5a7a20" }} />
            <div className="flex-1">
              <p className="text-xs font-semibold" style={{ color: "#5a7a20" }}>Aftercare Plan Available</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(0,0,0,0.55)" }}>
                After submitting this treatment record, you'll be able to create a personalized aftercare plan with AI-generated recommendations for this premium patient.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5 pt-1">
          {/* Areas Treated */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Areas Treated</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_AREAS.map(area => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={areas.includes(area)
                    ? { background: "#FA6F30", color: "#fff" }
                    : { background: "rgba(198,190,168,0.3)", color: "#6B7DB3" }}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          {/* Units */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Units / Amount Used</Label>
              <Input type="number" placeholder="e.g. 20" value={form.units_used || ""} onChange={e => f("units_used", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Label</Label>
              <Input placeholder="units / mL / syringes" value={form.units_label || ""} onChange={e => f("units_label", e.target.value)} />
            </div>
          </div>

          {/* Products Used */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Products Used</Label>
              <button type="button" onClick={() => setProducts(p => [...p, { product_name: "", batch_lot: "", amount: "" }])}
                className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                <Plus className="w-3 h-3" /> Add Product
              </button>
            </div>
            {products.map((p, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 items-start">
                <Input placeholder="Product name" className="text-sm h-8" value={p.product_name} onChange={e => setProducts(prev => prev.map((x, j) => j === i ? { ...x, product_name: e.target.value } : x))} />
                <Input placeholder="Batch/Lot #" className="text-sm h-8" value={p.batch_lot} onChange={e => setProducts(prev => prev.map((x, j) => j === i ? { ...x, batch_lot: e.target.value } : x))} />
                <div className="flex gap-1">
                  <Input placeholder="Amount" className="text-sm h-8" value={p.amount} onChange={e => setProducts(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                  {products.length > 1 && (
                    <button type="button" onClick={() => setProducts(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Clinical Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Clinical Notes</Label>
            <Textarea
              placeholder="Describe technique, patient response, follow-up instructions given..."
              rows={4}
              value={form.clinical_notes || ""}
              onChange={e => f("clinical_notes", e.target.value)}
            />
          </div>

          {/* Adverse Reaction */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: form.adverse_reaction ? "rgba(239,68,68,0.06)" : "#F0EDE8", border: form.adverse_reaction ? "1px solid rgba(239,68,68,0.2)" : "1px solid transparent" }}>
              <Switch checked={form.adverse_reaction || false} onCheckedChange={v => f("adverse_reaction", v)} />
              <div className="flex-1">
                <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: form.adverse_reaction ? "#dc2626" : "#243257" }}>
                  {form.adverse_reaction && <AlertTriangle className="w-4 h-4" />}
                  Adverse Reaction Occurred
                </p>
              </div>
            </div>
            {form.adverse_reaction && (
              <Textarea
                placeholder="Describe the adverse reaction, severity, and steps taken..."
                rows={3}
                value={form.adverse_reaction_notes || ""}
                onChange={e => f("adverse_reaction_notes", e.target.value)}
                className="border-red-200"
              />
            )}
          </div>

          {/* Photos */}
          <div className="grid grid-cols-2 gap-4">
            {["before", "after"].map(type => {
              const photos = type === "before" ? beforePhotos : afterPhotos;
              const isUploading = uploading[type];
              return (
                <div key={type} className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-widest capitalize" style={{ color: "#DA6A63" }}>{type} Photos</Label>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((url, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => type === "before" ? setBeforePhotos(p => p.filter((_, j) => j !== i)) : setAfterPhotos(p => p.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-white text-[10px]"
                        >×</button>
                      </div>
                    ))}
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                      style={{ borderColor: "#C6BEA8" }}>
                      {isUploading ? <span className="text-[10px] text-center" style={{ color: "#9a8f7e" }}>...</span> : <Upload className="w-4 h-4" style={{ color: "#C6BEA8" }} />}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadPhoto(e.target.files[0], type)} />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Show MD feedback if flagged/changes_requested */}
        {existingRecord?.md_review_notes && ["flagged","changes_requested"].includes(existingRecord?.status) && (
          <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(250,111,48,0.06)", border: "1px solid rgba(250,111,48,0.25)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#FA6F30" }}>MD Feedback ({existingRecord.status === "flagged" ? "Flagged" : "Changes Requested"})</p>
            <p className="text-sm" style={{ color: "#243257" }}>{existingRecord.md_review_notes}</p>
            <p className="text-xs mt-1" style={{ color: "#9a8f7e" }}>Address the feedback above then resubmit.</p>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2" style={{ borderTop: "1px solid rgba(198,190,168,0.3)" }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => save.mutate("draft")} disabled={save.isPending}>
            Save Draft
          </Button>
          <Button style={{ background: "#FA6F30", color: "#fff" }} onClick={() => save.mutate("submitted")} disabled={save.isPending}>
            <CheckCircle className="w-4 h-4 mr-1.5" />
            {existingRecord?.status === "flagged" || existingRecord?.status === "changes_requested" ? "Resubmit for MD Review" : "Save & Review Aftercare"}
          </Button>
        </div>
      </DialogContent>

      {/* Aftercare Plan Dialog - opens after successful save */}
      {savedRecord && (
        <AftercarePlanDialog
          open={showAftercarePlan}
          onClose={() => {
            setShowAftercarePlan(false);
            setSavedRecord(null);
            onClose();
          }}
          treatmentRecord={savedRecord}
        />
      )}
    </Dialog>
  );
}