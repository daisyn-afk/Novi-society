import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Calendar, Plus } from "lucide-react";

export const EMPTY_SCHEDULED = {
  type: "scheduled",
  template_id: "",
  title: "",
  price: "",
  location: "",
  max_seats: "",
  available_seats: "",
  instructor_name: "",
  session_dates: [],
  is_active: true,
  is_featured: false,
};

export default function ScheduleCourseForm({ open, onOpenChange, form, setForm, onSave, saving, editing, templates }) {
  const [newDate, setNewDate] = useState({ date: "", start_time: "", end_time: "", location: "", label: "" });

  const selectedTemplate = templates.find(t => t.id === form.template_id);

  const handleTemplateSelect = (templateId) => {
    const t = templates.find(x => x.id === templateId);
    setForm(f => ({
      ...f,
      template_id: templateId,
      title: t?.title || f.title,
      price: t?.price || f.price,
      instructor_name: t?.instructor_name || f.instructor_name,
    }));
  };

  const addDate = () => {
    if (!newDate.date) return;
    setForm(f => ({ ...f, session_dates: [...(f.session_dates || []), { ...newDate }] }));
    setNewDate({ date: "", start_time: "", end_time: "", location: "", label: "" });
  };
  const removeDate = (i) => setForm(f => ({ ...f, session_dates: f.session_dates.filter((_, idx) => idx !== i) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Scheduled Course" : "Schedule a Course"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {/* Template picker */}
          <div>
            <Label>Course Template *</Label>
            <Select value={form.template_id} onValueChange={handleTemplateSelect}>
              <SelectTrigger><SelectValue placeholder="Select a template..." /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-xs mt-1.5 px-1" style={{ color: "#8891a8" }}>
                {selectedTemplate.category?.replace("_", " ")} · {selectedTemplate.level} · {selectedTemplate.duration_hours}h
              </p>
            )}
          </div>

          {/* Overrides */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Display Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Defaults to template title" />
            </div>
            <div>
              <Label>Price ($)</Label>
              <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value || "" })} placeholder="Override template price" />
            </div>
            <div>
              <Label>Max Seats</Label>
              <Input type="number" value={form.max_seats} onChange={e => setForm({ ...form, max_seats: e.target.value || "", available_seats: e.target.value || "" })} />
            </div>
            <div className="col-span-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Dallas, TX — overrides template" />
            </div>
            <div className="col-span-2">
              <Label>Instructor</Label>
              <Input value={form.instructor_name} onChange={e => setForm({ ...form, instructor_name: e.target.value })} placeholder="Defaults to template instructor" />
            </div>
          </div>

          {/* Session Dates */}
          <div className="border rounded-xl p-4 space-y-3" style={{ background: "rgba(74,95,160,0.04)", borderColor: "rgba(74,95,160,0.2)" }}>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: "#4a5fa0" }} />
              <p className="font-semibold text-sm" style={{ color: "#1a2540" }}>Class Dates</p>
              <span className="text-xs" style={{ color: "#8891a8" }}>Providers will see all of these</span>
            </div>

            <div className="space-y-2">
              {(form.session_dates || []).sort((a, b) => a.date > b.date ? 1 : -1).map((s, i) => (
                <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border text-sm">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4a5fa0" }} />
                  <div className="flex-1">
                    {s.label && <span className="font-semibold text-xs mr-2" style={{ color: "#4a5fa0" }}>{s.label}</span>}
                    <span className="font-medium" style={{ color: "#1a2540" }}>{s.date}</span>
                    {(s.start_time || s.end_time) && <span className="ml-2" style={{ color: "#8891a8" }}>{s.start_time}{s.end_time ? ` – ${s.end_time}` : ""}</span>}
                    {s.location && <span className="ml-2" style={{ color: "#8891a8" }}>· {s.location}</span>}
                  </div>
                  <button onClick={() => removeDate(i)} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {(form.session_dates || []).length === 0 && (
                <p className="text-xs italic" style={{ color: "#b0b8cc" }}>No dates added yet. Add at least one date.</p>
              )}
            </div>

            {/* Add date form */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={newDate.date} onChange={e => setNewDate(d => ({ ...d, date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Label (optional)</Label>
                <Input placeholder="e.g. Day 1, Morning" value={newDate.label} onChange={e => setNewDate(d => ({ ...d, label: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Start Time</Label>
                <Input type="time" value={newDate.start_time} onChange={e => setNewDate(d => ({ ...d, start_time: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">End Time</Label>
                <Input type="time" value={newDate.end_time} onChange={e => setNewDate(d => ({ ...d, end_time: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Location (overrides course location)</Label>
                <Input placeholder="Optional specific location for this date" value={newDate.location} onChange={e => setNewDate(d => ({ ...d, location: e.target.value }))} />
              </div>
            </div>
            <button onClick={addDate} className="w-full py-2 text-sm font-semibold rounded-xl border-2 border-dashed transition-colors hover:bg-white" style={{ borderColor: "rgba(74,95,160,0.3)", color: "#4a5fa0" }}>
              <Plus className="w-3.5 h-3.5 inline mr-1" /> Add Date
            </button>
          </div>

          <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>Visible to providers</Label></div>
          <div className="flex items-center gap-3"><Switch checked={form.is_featured} onCheckedChange={v => setForm({ ...form, is_featured: v })} /><Label>Featured</Label></div>

          <div className="flex gap-3 pt-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={saving || !form.template_id || (form.session_dates || []).length === 0} style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)", color: "#fff" }}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Schedule Course"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}