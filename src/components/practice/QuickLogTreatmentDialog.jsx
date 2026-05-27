import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

const COMMON_AREAS = ["Forehead", "Glabella", "Crow's Feet", "Lip", "Chin", "Jawline", "Cheeks", "Neck", "Nasolabial Folds", "Marionette Lines"];

const emptyForm = {
  patient_name: "",
  patient_email: "",
  service: "",
  treatment_date: new Date().toISOString().slice(0, 10),
  units_used: "",
  units_label: "units",
  clinical_notes: "",
  adverse_reaction: false,
  adverse_reaction_notes: "",
};

export default function QuickLogTreatmentDialog({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [areas, setAreas] = useState([]);
  const [products, setProducts] = useState([{ product_name: "", batch_lot: "", amount: "" }]);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setAreas([]);
      setProducts([{ product_name: "", batch_lot: "", amount: "" }]);
    }
  }, [open]);

  const f = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleArea = (area) => {
    setAreas((prev) => (prev.includes(area) ? prev.filter((item) => item !== area) : [...prev, area]));
  };

  const save = useMutation({
    mutationFn: async (status) => {
      const me = await base44.auth.me();
      const payload = {
        provider_id: me.id,
        provider_name: me.full_name,
        provider_email: me.email,
        patient_name: form.patient_name,
        patient_email: form.patient_email,
        service: form.service,
        treatment_date: form.treatment_date,
        areas_treated: areas,
        products_used: products.filter((product) => product.product_name),
        units_used: form.units_used,
        units_label: form.units_label,
        clinical_notes: form.clinical_notes,
        adverse_reaction: form.adverse_reaction,
        adverse_reaction_notes: form.adverse_reaction_notes,
        before_photo_urls: [],
        after_photo_urls: [],
        status,
      };

      const record = await base44.entities.TreatmentRecord.create(payload);
      if (status === "submitted" && payload.adverse_reaction) {
        await base44.functions.invoke("adverseReactionEscalation", { treatment_record_id: record.id });
      }
      return record;
    },
    onSuccess: () => {
      qc.invalidateQueries(["treatment-records"]);
      qc.invalidateQueries(["my-appointments"]);
      onClose();
    },
  });

  const canSave = form.patient_name.trim() && form.service.trim() && form.treatment_date;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
            Quick Log Treatment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Patient Name</Label>
              <Input value={form.patient_name} onChange={(e) => f("patient_name", e.target.value)} placeholder="Patient name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Patient Email</Label>
              <Input type="email" value={form.patient_email} onChange={(e) => f("patient_email", e.target.value)} placeholder="patient@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Service</Label>
              <Input value={form.service} onChange={(e) => f("service", e.target.value)} placeholder="e.g. Botox, filler, peel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Treatment Date</Label>
              <Input type="date" value={form.treatment_date} onChange={(e) => f("treatment_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Areas Treated</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_AREAS.map((area) => (
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Units / Amount Used</Label>
              <Input type="number" value={form.units_used} onChange={(e) => f("units_used", e.target.value)} placeholder="e.g. 20" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Label</Label>
              <Input value={form.units_label} onChange={(e) => f("units_label", e.target.value)} placeholder="units / mL / syringes" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Products Used</Label>
              <button
                type="button"
                onClick={() => setProducts((prev) => [...prev, { product_name: "", batch_lot: "", amount: "" }])}
                className="text-xs flex items-center gap-1"
                style={{ color: "#FA6F30" }}
              >
                <Plus className="w-3 h-3" /> Add Product
              </button>
            </div>
            {products.map((product, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 items-start">
                <Input placeholder="Product name" className="text-sm h-8" value={product.product_name} onChange={(e) => setProducts((prev) => prev.map((item, i) => i === index ? { ...item, product_name: e.target.value } : item))} />
                <Input placeholder="Batch/Lot #" className="text-sm h-8" value={product.batch_lot} onChange={(e) => setProducts((prev) => prev.map((item, i) => i === index ? { ...item, batch_lot: e.target.value } : item))} />
                <div className="flex gap-1">
                  <Input placeholder="Amount" className="text-sm h-8" value={product.amount} onChange={(e) => setProducts((prev) => prev.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))} />
                  {products.length > 1 && (
                    <button type="button" onClick={() => setProducts((prev) => prev.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Clinical Notes</Label>
            <Textarea
              rows={4}
              value={form.clinical_notes}
              onChange={(e) => f("clinical_notes", e.target.value)}
              placeholder="Describe technique, patient response, follow-up instructions given..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: form.adverse_reaction ? "rgba(239,68,68,0.06)" : "#F0EDE8", border: form.adverse_reaction ? "1px solid rgba(239,68,68,0.2)" : "1px solid transparent" }}>
              <Switch checked={form.adverse_reaction} onCheckedChange={(value) => f("adverse_reaction", value)} />
              <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: form.adverse_reaction ? "#dc2626" : "#243257" }}>
                {form.adverse_reaction && <AlertTriangle className="w-4 h-4" />}
                Adverse Reaction Occurred
              </p>
            </div>
            {form.adverse_reaction && (
              <Textarea
                rows={3}
                value={form.adverse_reaction_notes}
                onChange={(e) => f("adverse_reaction_notes", e.target.value)}
                placeholder="Describe the adverse reaction, severity, and steps taken..."
                className="border-red-200"
              />
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="outline" disabled={!canSave || save.isPending} onClick={() => save.mutate("draft")}>
              Save Draft
            </Button>
            <Button style={{ background: "#FA6F30", color: "#fff" }} disabled={!canSave || save.isPending} onClick={() => save.mutate("submitted")}>
              {save.isPending ? "Saving..." : "Submit for MD Review"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
