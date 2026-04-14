import { useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Trash2, Users } from "lucide-react";
import { adminCoursesApi } from "@/api/adminCoursesApi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const menuItems = [
  { key: "users", label: "Users", icon: Users, to: "/admin/users" },
  { key: "courses", label: "Courses", icon: BookOpen, to: "/admin/courses" }
];

function AdminSection({ title }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">
        This is the {title.toLowerCase()} section. You can wire your tables/forms here.
      </p>
    </div>
  );
}

export function AdminUsersSection() {
  return <AdminSection title="Users" />;
}

const categoryOptions = ["botox", "fillers", "prp", "laser", "chemical_peel", "microneedling", "kybella", "skincare", "other"];
const levelOptions = ["beginner", "intermediate", "advanced"];
const typeOptions = ["template", "scheduled"];
const materialTypeOptions = ["pdf", "video", "link", "text"];

const emptyForm = {
  title: "",
  type: "template",
  template_id: "",
  category: "other",
  level: "beginner",
  tags: [],
  is_active: true,
  is_featured: false,
  description: "",
  syllabus: "",
  requirements: "",
  what_to_bring: "",
  getting_ready_info: "",
  pre_course_materials: [],
  price: "",
  duration_hours: "",
  location: "",
  max_seats: "",
  available_seats: "",
  session_dates: [],
  cover_image_url: "",
  instructor_name: "",
  instructor_bio: "",
  certifications_awarded: [],
  certification_name: "",
  linked_service_type_ids: [],
  platform_coverage: []
};

function parseTagInput(value) {
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function normalizePayload(form) {
  return {
    ...form,
    template_id: form.type === "scheduled" ? form.template_id : null,
    price: form.price === "" ? null : Number(form.price),
    duration_hours: form.duration_hours === "" ? null : Number(form.duration_hours),
    max_seats: form.max_seats === "" ? null : Number(form.max_seats),
    available_seats: form.available_seats === "" ? null : Number(form.available_seats),
    tags: Array.isArray(form.tags) ? form.tags : [],
    linked_service_type_ids: Array.isArray(form.linked_service_type_ids) ? form.linked_service_type_ids : [],
    platform_coverage: Array.isArray(form.platform_coverage) ? form.platform_coverage : []
  };
}

export function AdminCoursesSection() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");

  const { data: courses = [], isLoading, error: listError } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => adminCoursesApi.list()
  });

  const templates = useMemo(() => courses.filter((c) => c.type === "template"), [courses]);

  const filteredCourses = useMemo(() => {
    if (activeTab === "templates") return courses.filter((c) => c.type === "template");
    if (activeTab === "scheduled") return courses.filter((c) => c.type === "scheduled");
    return courses;
  }, [activeTab, courses]);

  const createMutation = useMutation({
    mutationFn: (payload) => adminCoursesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => adminCoursesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminCoursesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-courses"] })
  });

  const onCreate = () => {
    setErrorMessage("");
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const onEdit = (course) => {
    setErrorMessage("");
    setEditingId(course.id);
    setForm({
      ...emptyForm,
      ...course,
      template_id: course.template_id || "",
      price: course.price ?? "",
      duration_hours: course.duration_hours ?? "",
      max_seats: course.max_seats ?? "",
      available_seats: course.available_seats ?? ""
    });
    setDialogOpen(true);
  };

  const validate = () => {
    if (!form.title?.trim()) return "Title is required";
    if (!typeOptions.includes(form.type)) return "Type must be template or scheduled";
    if (form.type === "scheduled" && !form.template_id) return "Template is required for scheduled courses";
    const maxSeats = form.max_seats === "" ? null : Number(form.max_seats);
    const availableSeats = form.available_seats === "" ? null : Number(form.available_seats);
    if (maxSeats !== null && availableSeats !== null && availableSeats > maxSeats) {
      return "Available seats cannot exceed max seats";
    }
    return "";
  };

  const onSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage("");
    const payload = normalizePayload(form);
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (error) {
      const details = Array.isArray(error?.details) ? ` (${error.details.join(", ")})` : "";
      setErrorMessage(`${error?.message || "Failed to save course"}${details}`);
    }
  };

  const addArrayItem = (field, item) => setForm((prev) => ({ ...prev, [field]: [...(prev[field] || []), item] }));
  const removeArrayItem = (field, index) =>
    setForm((prev) => ({ ...prev, [field]: prev[field].filter((_, idx) => idx !== index) }));

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Courses</h2>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Create
        </Button>
      </div>

      <div className="flex gap-2">
        {[
          { key: "all", label: "All" },
          { key: "templates", label: "Templates" },
          { key: "scheduled", label: "Scheduled Courses" }
        ].map((tab) => (
          <Button key={tab.key} variant={activeTab === tab.key ? "default" : "outline"} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Price</th>
              <th className="px-3 py-2 text-left">Available Seats</th>
              <th className="px-3 py-2 text-left">Active</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading &&
              filteredCourses.map((course) => (
                <tr key={course.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{course.title}</td>
                  <td className="px-3 py-2 capitalize">{course.type}</td>
                  <td className="px-3 py-2 capitalize">{String(course.category || "").replaceAll("_", " ")}</td>
                  <td className="px-3 py-2">{course.price ?? "-"}</td>
                  <td className="px-3 py-2">{course.available_seats ?? "-"}</td>
                  <td className="px-3 py-2">{course.is_active ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(course)}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(course.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Course" : "Create Course"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>

            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(value) => setForm((p) => ({ ...p, type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{typeOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {form.type === "scheduled" && (
              <div>
                <Label>Template</Label>
                <Select
                  value={form.template_id}
                  onValueChange={(value) => setForm((p) => ({ ...p, template_id: value }))}
                  disabled={templates.length === 0}
                >
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    No template courses found. Create a template first, or paste a template ID below.
                  </p>
                )}
                <Input
                  className="mt-2"
                  placeholder="Template ID (manual fallback)"
                  value={form.template_id}
                  onChange={(e) => setForm((p) => ({ ...p, template_id: e.target.value }))}
                />
              </div>
            )}

            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm((p) => ({ ...p, category: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categoryOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label>Level</Label>
              <Select value={form.level} onValueChange={(value) => setForm((p) => ({ ...p, level: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{levelOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label>Tags (comma separated)</Label>
              <Input value={(form.tags || []).join(", ")} onChange={(e) => setForm((p) => ({ ...p, tags: parseTagInput(e.target.value) }))} />
            </div>

            <div className="flex items-center gap-3"><Label>Is Active</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} /></div>
            <div className="flex items-center gap-3"><Label>Is Featured</Label><Switch checked={form.is_featured} onCheckedChange={(v) => setForm((p) => ({ ...p, is_featured: v }))} /></div>

            <div className="md:col-span-2"><Label>Description (rich text)</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Syllabus (rich text)</Label><Textarea rows={4} value={form.syllabus} onChange={(e) => setForm((p) => ({ ...p, syllabus: e.target.value }))} /></div>
            <div><Label>Requirements</Label><Textarea rows={3} value={form.requirements} onChange={(e) => setForm((p) => ({ ...p, requirements: e.target.value }))} /></div>
            <div><Label>What to Bring</Label><Textarea rows={3} value={form.what_to_bring} onChange={(e) => setForm((p) => ({ ...p, what_to_bring: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Getting Ready Info</Label><Textarea rows={3} value={form.getting_ready_info} onChange={(e) => setForm((p) => ({ ...p, getting_ready_info: e.target.value }))} /></div>

            <div><Label>Instructor Name</Label><Input value={form.instructor_name} onChange={(e) => setForm((p) => ({ ...p, instructor_name: e.target.value }))} /></div>
            <div><Label>Instructor Bio</Label><Textarea rows={3} value={form.instructor_bio} onChange={(e) => setForm((p) => ({ ...p, instructor_bio: e.target.value }))} /></div>

            <div>
              <Label>Cover Image Upload</Label>
              <Input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setForm((p) => ({ ...p, cover_image_url: URL.createObjectURL(file) }));
              }} />
            </div>
            <div><Label>Cover Image URL</Label><Input value={form.cover_image_url} onChange={(e) => setForm((p) => ({ ...p, cover_image_url: e.target.value }))} /></div>

            <div><Label>Price</Label><Input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} /></div>
            <div><Label>Duration Hours</Label><Input type="number" value={form.duration_hours} onChange={(e) => setForm((p) => ({ ...p, duration_hours: e.target.value }))} /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} /></div>
            <div><Label>Max Seats</Label><Input type="number" value={form.max_seats} onChange={(e) => setForm((p) => ({ ...p, max_seats: e.target.value }))} /></div>
            <div><Label>Available Seats</Label><Input type="number" value={form.available_seats} onChange={(e) => setForm((p) => ({ ...p, available_seats: e.target.value }))} /></div>
            <div><Label>Certification Name (legacy)</Label><Input value={form.certification_name} onChange={(e) => setForm((p) => ({ ...p, certification_name: e.target.value }))} /></div>

            <div className="md:col-span-2 space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between"><Label>Pre Course Materials</Label><Button size="sm" variant="outline" onClick={() => addArrayItem("pre_course_materials", { title: "", type: "pdf", url: "", content: "", required: true })}>Add</Button></div>
              {(form.pre_course_materials || []).map((item, idx) => (
                <div key={`m-${idx}`} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-2">
                  <Input placeholder="title" value={item.title || ""} onChange={(e) => setForm((p) => ({ ...p, pre_course_materials: p.pre_course_materials.map((x, i) => i === idx ? { ...x, title: e.target.value } : x) }))} />
                  <Select value={item.type || "pdf"} onValueChange={(value) => setForm((p) => ({ ...p, pre_course_materials: p.pre_course_materials.map((x, i) => i === idx ? { ...x, type: value } : x) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{materialTypeOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="url" value={item.url || ""} onChange={(e) => setForm((p) => ({ ...p, pre_course_materials: p.pre_course_materials.map((x, i) => i === idx ? { ...x, url: e.target.value } : x) }))} />
                  <Input placeholder="content" value={item.content || ""} onChange={(e) => setForm((p) => ({ ...p, pre_course_materials: p.pre_course_materials.map((x, i) => i === idx ? { ...x, content: e.target.value } : x) }))} />
                  <div className="flex items-center gap-3"><Label>Required</Label><Switch checked={item.required ?? true} onCheckedChange={(value) => setForm((p) => ({ ...p, pre_course_materials: p.pre_course_materials.map((x, i) => i === idx ? { ...x, required: value } : x) }))} /></div>
                  <Button size="sm" variant="destructive" onClick={() => removeArrayItem("pre_course_materials", idx)}>Remove</Button>
                </div>
              ))}
            </div>

            <div className="md:col-span-2 space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between"><Label>Session Dates</Label><Button size="sm" variant="outline" onClick={() => addArrayItem("session_dates", { date: "", start_time: "", end_time: "", location: "", label: "" })}>Add</Button></div>
              {(form.session_dates || []).map((item, idx) => (
                <div key={`d-${idx}`} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-2">
                  <Input type="date" value={item.date || ""} onChange={(e) => setForm((p) => ({ ...p, session_dates: p.session_dates.map((x, i) => i === idx ? { ...x, date: e.target.value } : x) }))} />
                  <Input placeholder="label" value={item.label || ""} onChange={(e) => setForm((p) => ({ ...p, session_dates: p.session_dates.map((x, i) => i === idx ? { ...x, label: e.target.value } : x) }))} />
                  <Input placeholder="start_time" value={item.start_time || ""} onChange={(e) => setForm((p) => ({ ...p, session_dates: p.session_dates.map((x, i) => i === idx ? { ...x, start_time: e.target.value } : x) }))} />
                  <Input placeholder="end_time" value={item.end_time || ""} onChange={(e) => setForm((p) => ({ ...p, session_dates: p.session_dates.map((x, i) => i === idx ? { ...x, end_time: e.target.value } : x) }))} />
                  <Input placeholder="location" value={item.location || ""} onChange={(e) => setForm((p) => ({ ...p, session_dates: p.session_dates.map((x, i) => i === idx ? { ...x, location: e.target.value } : x) }))} />
                  <Button size="sm" variant="destructive" onClick={() => removeArrayItem("session_dates", idx)}>Remove</Button>
                </div>
              ))}
            </div>

            <div className="md:col-span-2 space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between"><Label>Certifications Awarded</Label><Button size="sm" variant="outline" onClick={() => addArrayItem("certifications_awarded", { service_type_id: "", service_type_name: "", cert_name: "" })}>Add</Button></div>
              {(form.certifications_awarded || []).map((item, idx) => (
                <div key={`c-${idx}`} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-3">
                  <Input placeholder="service_type_id" value={item.service_type_id || ""} onChange={(e) => setForm((p) => ({ ...p, certifications_awarded: p.certifications_awarded.map((x, i) => i === idx ? { ...x, service_type_id: e.target.value } : x) }))} />
                  <Input placeholder="service_type_name" value={item.service_type_name || ""} onChange={(e) => setForm((p) => ({ ...p, certifications_awarded: p.certifications_awarded.map((x, i) => i === idx ? { ...x, service_type_name: e.target.value } : x) }))} />
                  <Input placeholder="cert_name" value={item.cert_name || ""} onChange={(e) => setForm((p) => ({ ...p, certifications_awarded: p.certifications_awarded.map((x, i) => i === idx ? { ...x, cert_name: e.target.value } : x) }))} />
                  <Button size="sm" variant="destructive" onClick={() => removeArrayItem("certifications_awarded", idx)} className="md:col-span-3">Remove</Button>
                </div>
              ))}
            </div>

            <div className="md:col-span-2"><Label>Linked Service Type IDs (comma separated)</Label><Input value={(form.linked_service_type_ids || []).join(", ")} onChange={(e) => setForm((p) => ({ ...p, linked_service_type_ids: parseTagInput(e.target.value) }))} /></div>
            <div className="md:col-span-2"><Label>Platform Coverage (comma separated)</Label><Input value={(form.platform_coverage || []).join(", ")} onChange={(e) => setForm((p) => ({ ...p, platform_coverage: parseTagInput(e.target.value) }))} /></div>
          </div>

          {(errorMessage || listError) && (
            <p className="text-sm text-red-600">
              {errorMessage || listError?.message || "Failed to load courses"}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={onSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "Save Changes" : "Create Course"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminPortal() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="w-64 shrink-0 rounded-xl border border-slate-200 bg-white p-4">
          <h1 className="mb-4 text-lg font-semibold text-slate-900">Admin</h1>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

