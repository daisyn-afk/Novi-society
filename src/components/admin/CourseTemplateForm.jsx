import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Award, FileText, Plus, BookOpen, Users, Clock, DollarSign, ImageIcon } from "lucide-react";
import { adminUploadsApi } from "@/api/adminUploadsApi";

export const EMPTY_TEMPLATE = {
  type: "template",
  title: "", description: "", category: "botox", level: "beginner",
  price: "", duration_hours: "", instructor_name: "", instructor_bio: "",
  cover_image_url: "", syllabus: "", requirements: "",
  what_to_bring: "", getting_ready_info: "",
  certifications_awarded: [], linked_service_type_ids: [],
  pre_course_materials: [], platform_coverage: [],
  session_dates: [],
  tags: [],
  certification_name: "",
  is_active: true, is_featured: false,
};

export default function CourseTemplateForm({ open, onOpenChange, form, setForm, onSave, saving, editing, serviceTypes }) {
  const [newCert, setNewCert] = useState({ service_type_id: "", cert_name: "" });
  const [newMaterial, setNewMaterial] = useState({ title: "", type: "pdf", url: "", content: "", required: true });
  const [newCoverage, setNewCoverage] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState("");

  const eligibleServiceTypes = serviceTypes.filter(s =>
    s.is_active && s.md_agreement_text?.trim() &&
    ((s.scope_rules?.length > 0) || (s.allowed_areas?.length > 0))
  );

  const addCert = () => {
    if (!newCert.service_type_id) return;
    const st = serviceTypes.find(s => s.id === newCert.service_type_id);
    setForm(f => ({
      ...f,
      certifications_awarded: [...(f.certifications_awarded || []), { service_type_id: newCert.service_type_id, service_type_name: st?.name, cert_name: newCert.cert_name || st?.name }],
      // Auto-add to linked_service_type_ids so the ClassDay wizard always fires
      linked_service_type_ids: (f.linked_service_type_ids || []).includes(newCert.service_type_id)
        ? (f.linked_service_type_ids || [])
        : [...(f.linked_service_type_ids || []), newCert.service_type_id],
    }));
    setNewCert({ service_type_id: "", cert_name: "" });
  };
  const removeCert = (i) => setForm(f => ({ ...f, certifications_awarded: f.certifications_awarded.filter((_, idx) => idx !== i) }));

  const addMaterial = () => {
    if (!newMaterial.title) return;
    setForm(f => ({ ...f, pre_course_materials: [...(f.pre_course_materials || []), { ...newMaterial }] }));
    setNewMaterial({ title: "", type: "pdf", url: "", content: "", required: true });
  };
  const removeMaterial = (i) => setForm(f => ({ ...f, pre_course_materials: f.pre_course_materials.filter((_, idx) => idx !== i) }));

  const addCoverage = () => {
    if (!newCoverage.trim()) return;
    setForm(f => ({ ...f, platform_coverage: [...(f.platform_coverage || []), newCoverage.trim()] }));
    setNewCoverage("");
  };
  const removeCoverage = (i) => setForm(f => ({ ...f, platform_coverage: f.platform_coverage.filter((_, idx) => idx !== i) }));

  const toggleServiceType = (id) => setForm(f => {
    const ids = f.linked_service_type_ids || [];
    return { ...f, linked_service_type_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] };
  });

  const uploadCover = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setCoverUploadError("");
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setCoverUploadError("Image must be 2MB or smaller.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setCoverUploadError("Only JPG, PNG, and WEBP images are allowed.");
      return;
    }

    try {
      setUploadingCover(true);
      const { url } = await adminUploadsApi.uploadCourseCoverImage(file);
      setForm((prev) => ({ ...prev, cover_image_url: url }));
    } catch (error) {
      setCoverUploadError(error?.message || "Cover image upload failed.");
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{editing ? "Edit Course Template" : "New Course Template"}</DialogTitle>
          <p className="text-xs text-slate-400 mt-0.5">Templates are reusable blueprints. You'll schedule specific class dates separately.</p>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid md:grid-cols-2 gap-4">

            {/* ── SECTION: Basic Info ── */}
            <div className="md:col-span-2 flex items-center gap-2 pb-1 border-b border-slate-100">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Course Info</span>
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600">Template Title <span className="text-red-400">*</span></Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Advanced Botox Techniques" className="mt-1" />
              <p className="text-xs text-slate-400 mt-1">This is the public-facing name providers will see in the course catalog.</p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600">Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["botox","fillers","prp","laser","chemical_peel","microneedling","kybella","skincare","other"].map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600">Level</Label>
              <Select value={form.level} onValueChange={v => setForm({ ...form, level: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">🟢 Beginner — No prior experience needed</SelectItem>
                  <SelectItem value="intermediate">🟡 Intermediate — Some experience required</SelectItem>
                  <SelectItem value="advanced">🔴 Advanced — Experienced providers only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Default Price ($)</Label>
              <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" className="mt-1" />
              <p className="text-xs text-slate-400 mt-1">Can be overridden when scheduling a specific class.</p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Duration (hours)</Label>
              <Input type="number" value={form.duration_hours} onChange={e => setForm({ ...form, duration_hours: e.target.value })} placeholder="e.g. 8" className="mt-1" />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Users className="w-3 h-3" /> Instructor Name</Label>
              <Input value={form.instructor_name} onChange={e => setForm({ ...form, instructor_name: e.target.value })} placeholder="e.g. Dr. Sarah Mitchell" className="mt-1" />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Cover Image</Label>
              <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadCover} className="mt-1" disabled={uploadingCover} />
              <p className="text-xs text-slate-400 mt-1">Upload JPG, PNG, or WEBP. Max size 2MB. Shown as the course thumbnail in the catalog.</p>
              {uploadingCover && <p className="text-xs mt-1 text-blue-600">Uploading cover image...</p>}
              {coverUploadError && <p className="text-xs mt-1 text-red-500">{coverUploadError}</p>}
              {form.cover_image_url && (
                <div className="mt-2 rounded-xl border border-slate-200 p-2 bg-white space-y-2">
                  <img src={form.cover_image_url} alt="Course cover preview" className="w-full max-h-40 object-cover rounded-lg" />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setForm((prev) => ({ ...prev, cover_image_url: "" }))}
                    >
                      Remove image
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600">Course Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="What will providers learn? What outcomes will they achieve?..." className="mt-1" />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600">Requirements / Prerequisites</Label>
              <Textarea value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} rows={2} placeholder="Who should attend, license types required, prior experience needed..." className="mt-1" />
            </div>

            {/* ── SECTION: Day-of Info ── */}
            <div className="md:col-span-2 flex items-center gap-2 pb-1 border-b border-slate-100 pt-2">
              <span className="text-base">📋</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Day-of Instructions (sent to enrolled providers)</span>
            </div>

            <div className="md:col-span-2 border rounded-xl p-4 space-y-3 bg-blue-50/40">
              <div>
                <Label className="text-xs font-semibold text-slate-600">Getting Ready Info</Label>
                <Textarea value={form.getting_ready_info} onChange={e => setForm({ ...form, getting_ready_info: e.target.value })} rows={3} placeholder="Arrival time, dress code, parking info, what to expect on the day, where to check in..." className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">What to Bring</Label>
                <Textarea value={form.what_to_bring} onChange={e => setForm({ ...form, what_to_bring: e.target.value })} rows={2} placeholder="e.g. Scrubs, valid license copy, payment confirmation, NOVI login on phone..." className="mt-1" />
              </div>
            </div>

            {/* ── SECTION: Services & Certs ── */}
            <div className="md:col-span-2 flex items-center gap-2 pb-1 border-b border-slate-100 pt-2">
              <span className="text-base">🔗</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Scope, Coverage & Certifications</span>
            </div>

            {/* Linked Service Types */}
            <div className="md:col-span-2 border rounded-xl p-4 space-y-3 bg-slate-50">
              <div>
                <p className="font-semibold text-sm text-slate-800">Linked Services (Scope Coverage)</p>
                <p className="text-xs text-slate-500 mt-0.5">Completing this course qualifies providers to apply for MD coverage on these services.</p>
              </div>
              {serviceTypes.length === 0 && (
                <div className="rounded-xl p-3 text-xs text-amber-700 bg-amber-50 border border-amber-200">
                  ⚠️ No service types configured yet. Go to <strong>Service Types</strong> in the admin sidebar first.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {eligibleServiceTypes.map(st => {
                  const selected = (form.linked_service_type_ids || []).includes(st.id);
                  return (
                    <button key={st.id} onClick={() => toggleServiceType(st.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selected ? "border-blue-500 bg-blue-100 text-blue-800" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                      {selected ? "✓ " : ""}{st.name}
                      <span className={`ml-1 opacity-60 capitalize ${selected ? "" : "hidden"}`}>· {st.category?.replace("_"," ")}</span>
                    </button>
                  );
                })}
              </div>

              {/* Show scope preview for selected services */}
              {(form.linked_service_type_ids || []).length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scope Preview (from Service Types)</p>
                  {(form.linked_service_type_ids || []).map(id => {
                    const st = serviceTypes.find(s => s.id === id);
                    if (!st) return null;
                    return (
                      <div key={id} className="rounded-xl bg-white border border-slate-200 px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-slate-800">{st.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium" style={{ background: "rgba(74,95,160,0.08)", color: "#4a5fa0" }}>{st.category?.replace("_"," ")}</span>
                        </div>
                        {st.allowed_areas?.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-400 font-medium mb-1">Allowed Areas</p>
                            <div className="flex flex-wrap gap-1">
                              {st.allowed_areas.map(a => <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{a}</span>)}
                            </div>
                          </div>
                        )}
                        {st.scope_rules?.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-400 font-medium mb-1">Scope Rules</p>
                            <div className="space-y-0.5">
                              {st.scope_rules.map((r, i) => (
                                <p key={i} className="text-xs text-slate-600"><span className="font-semibold">{r.rule_name}:</span> {r.rule_value} {r.unit}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {st.requires_license_types?.length > 0 && (
                          <p className="text-xs text-slate-500">Required licenses: <span className="font-semibold text-slate-700">{st.requires_license_types.join(", ")}</span></p>
                        )}
                        {st.md_agreement_text && (
                          <p className="text-xs text-green-600 flex items-center gap-1">✓ MD agreement text configured</p>
                        )}
                        {st.requires_novi_course && (
                          <p className="text-xs text-blue-600 flex items-center gap-1">✓ Requires NOVI course (this template counts)</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Certifications */}
            {(form.certifications_awarded || []).some(c => !(form.linked_service_type_ids || []).includes(c.service_type_id)) && (
              <div className="md:col-span-2 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(250,111,48,0.1)", border: "1px solid rgba(250,111,48,0.3)", color: "#c2440a" }}>
                ⚠️ Some certifications are not linked to a service type — providers won't trigger the class-day onboarding wizard. Adding a cert now auto-links it.
              </div>
            )}
            <div className="md:col-span-2 border rounded-xl p-4 space-y-3 bg-amber-50/50">
              <div className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-600" /><p className="font-semibold text-sm text-amber-900">Certifications Awarded</p></div>
              <p className="text-xs text-slate-500">These certifications will be issued to providers who complete this course. Typically one per linked service.</p>
              <div className="space-y-2">
                {(form.certifications_awarded || []).map((cert, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border">
                    <Award className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <div className="flex-1"><span className="text-sm font-medium block">{cert.cert_name || cert.service_type_name}</span><span className="text-xs text-slate-400">{cert.service_type_name}</span></div>
                    <button onClick={() => removeCert(i)} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={newCert.service_type_id} onValueChange={v => setNewCert(c => ({ ...c, service_type_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select Service Type *" /></SelectTrigger>
                  <SelectContent>
                    {eligibleServiceTypes.map(st => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Custom cert name (optional)" value={newCert.cert_name} onChange={e => setNewCert(c => ({ ...c, cert_name: e.target.value }))} />
                <Button variant="outline" size="sm" onClick={addCert} className="col-span-2 border-amber-300 text-amber-700">+ Add Cert</Button>
              </div>
            </div>

            {/* Pre-Course Materials */}
            <div className="md:col-span-2 border rounded-xl p-4 space-y-3 bg-slate-50">
              <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-600" /><p className="font-semibold text-sm text-slate-800">Pre-Course Materials</p></div>
              <p className="text-xs text-slate-500">Study materials providers must review before attending. These appear in their enrollment dashboard as required reading before class.</p>

              {/* Existing materials */}
              <div className="space-y-2">
                {(form.pre_course_materials || []).map((m, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${m.type === "video" ? "bg-red-100 text-red-600" : m.type === "pdf" ? "bg-orange-100 text-orange-600" : m.type === "link" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-600"}`}>{m.type.toUpperCase()}</span>
                      <Input
                        value={m.title}
                        onChange={e => setForm(f => ({ ...f, pre_course_materials: f.pre_course_materials.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))}
                        className="flex-1 h-7 text-sm"
                        placeholder="Material title"
                      />
                      <Select value={m.type} onValueChange={v => setForm(f => ({ ...f, pre_course_materials: f.pre_course_materials.map((x, j) => j === i ? { ...x, type: v } : x) }))}>
                        <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="link">Link</SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                        </SelectContent>
                      </Select>
                      <button onClick={() => removeMaterial(i)} className="text-slate-300 hover:text-red-400 flex-shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                    {m.type !== "text" ? (
                      <Input
                        value={m.url}
                        onChange={e => setForm(f => ({ ...f, pre_course_materials: f.pre_course_materials.map((x, j) => j === i ? { ...x, url: e.target.value } : x) }))}
                        className="h-7 text-xs font-mono"
                        placeholder="https://..."
                      />
                    ) : (
                      <Textarea
                        value={m.content}
                        onChange={e => setForm(f => ({ ...f, pre_course_materials: f.pre_course_materials.map((x, j) => j === i ? { ...x, content: e.target.value } : x) }))}
                        rows={2}
                        className="text-xs"
                        placeholder="Text content..."
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id={`req-${i}`} checked={m.required !== false} onChange={e => setForm(f => ({ ...f, pre_course_materials: f.pre_course_materials.map((x, j) => j === i ? { ...x, required: e.target.checked } : x) }))} className="rounded" />
                      <label htmlFor={`req-${i}`} className="text-xs text-slate-500 cursor-pointer">Required (provider must open before class)</label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new material */}
              <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Add New Material</p>
                <div className="flex items-center gap-2">
                  <Input placeholder="Title *" value={newMaterial.title} onChange={e => setNewMaterial(m => ({ ...m, title: e.target.value }))} className="flex-1 h-8 text-sm" />
                  <Select value={newMaterial.type} onValueChange={v => setNewMaterial(m => ({ ...m, type: v }))}>
                    <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newMaterial.type !== "text"
                  ? <Input placeholder="URL (https://...)" value={newMaterial.url} onChange={e => setNewMaterial(m => ({ ...m, url: e.target.value }))} className="h-8 text-sm font-mono" />
                  : <Textarea placeholder="Text content..." value={newMaterial.content} onChange={e => setNewMaterial(m => ({ ...m, content: e.target.value }))} rows={2} className="text-sm" />
                }
                <Button variant="outline" size="sm" onClick={addMaterial} disabled={!newMaterial.title} className="w-full border-slate-300 text-slate-600 hover:bg-slate-50">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Material
                </Button>
              </div>
            </div>



            {/* ── Tags & legacy cert name (schema) ── */}
            <div className="md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600">Tags (comma separated)</Label>
              <Input
                className="mt-1"
                value={(form.tags || []).join(", ")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                  })
                }
                placeholder="e.g. hands-on, certification"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600">Certification name (legacy)</Label>
              <Input
                className="mt-1"
                value={form.certification_name || ""}
                onChange={(e) => setForm({ ...form, certification_name: e.target.value })}
                placeholder="Optional single cert label for older flows"
              />
            </div>

            {/* ── SECTION: Visibility ── */}
            <div className="md:col-span-2 flex items-center gap-2 pb-1 border-b border-slate-100 pt-2">
              <span className="text-base">👁</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Visibility</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Active</p>
                <p className="text-xs text-slate-400">Show this template to staff when scheduling classes</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            </div>
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">Featured</p>
                <p className="text-xs text-amber-600">Highlight this course at the top of the catalog</p>
              </div>
              <Switch checked={form.is_featured} onCheckedChange={v => setForm({ ...form, is_featured: v })} />
            </div>
          </div>

          <div className="flex gap-3 pt-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={saving || !form.title} style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)", color: "#fff" }}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}