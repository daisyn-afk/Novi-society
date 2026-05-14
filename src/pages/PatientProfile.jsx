import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Save, CheckCircle, User, Phone, Heart, AlertTriangle, XCircle } from "lucide-react";

export default function PatientProfile() {
  const queryClient = useQueryClient();
  const { data: me, refetch } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const [form, setForm] = useState({});
  const [banner, setBanner] = useState(null); // { type: "success" | "error", message: string }

  const glassCardStyle = {
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(123,142,200,0.2)",
    boxShadow: "0 2px 16px rgba(30,37,53,0.07)",
  };
  const inputClassName = "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus-visible:ring-[#7B8EC8] focus-visible:border-[#7B8EC8] disabled:bg-slate-100 disabled:text-slate-500";
  const labelClassName = "text-xs font-semibold mb-1.5 block text-slate-700";

  useEffect(() => {
    if (me) setForm({
      phone: me.phone || "",
      city: me.city || "",
      state: me.state || "",
      health_notes: me.health_notes || "",
      date_of_birth: me.date_of_birth || "",
      gender: me.gender || "",
      allergies: me.allergies || "",
      current_medications: me.current_medications || "",
      medical_conditions: me.medical_conditions || "",
      emergency_contact_name: me.emergency_contact_name || "",
      emergency_contact_phone: me.emergency_contact_phone || "",
    });
  }, [me]);

  const save = useMutation({
    mutationFn: () => base44.auth.updateMe(form),
    onSuccess: (updatedMe) => {
      queryClient.setQueryData(["me"], updatedMe);
      refetch();
      setBanner({ type: "success", message: "Profile saved successfully." });
      setTimeout(() => setBanner(null), 4000);
      setTimeout(() => save.reset(), 1250);
    },
    onError: (error) => {
      setBanner({ type: "error", message: String(error?.message || "Could not save. Please try again.") });
      setTimeout(() => setBanner(null), 6000);
    },
  });

  const initials = me?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "P";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(218,106,99,0.9)" }}>Patient</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#243257" }}>My Profile</h1>
      </div>

      {/* Save banner */}
      {banner && (
        <div
          className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-semibold"
          style={
            banner.type === "success"
              ? { background: "#dcfce7", border: "1px solid #86efac", color: "#166534" }
              : { background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b" }
          }
        >
          {banner.type === "success"
            ? <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#16a34a" }} />
            : <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#dc2626" }} />}
          {banner.message}
        </div>
      )}

      {/* Avatar + name card */}
      <div className="rounded-3xl p-6 flex items-center gap-5" style={glassCardStyle}>
        <Avatar className="w-16 h-16 flex-shrink-0">
          <AvatarFallback style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)", color: "white", fontSize: 20, fontWeight: 700 }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-bold text-slate-900 text-lg">{me?.full_name}</p>
          <p className="text-sm text-slate-600">{me?.email}</p>
          <span className="mt-1 inline-block text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "rgba(200,230,60,0.25)", color: "#3D5600", border: "1px solid rgba(200,230,60,0.35)" }}>Patient</span>
        </div>
      </div>

      {[
        {
          title: "Contact Info", icon: Phone,
          fields: [
            { label: "Phone", key: "phone", type: "tel", placeholder: "+1 (555) 000-0000" },
            { label: "City", key: "city", placeholder: "Austin" },
            { label: "State", key: "state", placeholder: "TX" },
          ]
        },
        {
          title: "Personal Info", icon: User,
          fields: [
            { label: "Date of Birth", key: "date_of_birth", type: "date" },
            { label: "Gender", key: "gender", type: "select", options: ["prefer_not_to_say", "female", "male", "non_binary", "other"] },
          ]
        },
        {
          title: "Medical Information", icon: Heart, subtitle: "Shared with providers you book appointments with",
          fields: [
            { label: "Known Allergies", key: "allergies", type: "textarea", placeholder: "e.g. Lidocaine, latex, bee stings..." },
            { label: "Current Medications", key: "current_medications", type: "textarea", placeholder: "List any medications or supplements..." },
            { label: "Medical Conditions", key: "medical_conditions", type: "textarea", placeholder: "Relevant conditions, prior procedures..." },
            { label: "Additional Health Notes", key: "health_notes", type: "textarea", placeholder: "Anything else your provider should know..." },
          ]
        },
        {
          title: "Emergency Contact", icon: AlertTriangle,
          fields: [
            { label: "Name", key: "emergency_contact_name", placeholder: "Full name" },
            { label: "Phone", key: "emergency_contact_phone", type: "tel", placeholder: "+1 (555) 000-0000" },
          ]
        },
      ].map(section => (
        <div key={section.title} className="rounded-3xl overflow-hidden" style={glassCardStyle}>
          <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(123,142,200,0.2)" }}>
            <section.icon className="w-4 h-4" style={{ color: "#6B7DB3" }} />
            <p className="font-bold text-sm text-slate-900">{section.title}</p>
            {section.subtitle && <p className="text-xs ml-2 text-slate-500">{section.subtitle}</p>}
          </div>
          <div className="p-6 grid gap-4" style={{ gridTemplateColumns: section.fields.length > 2 ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {section.fields.map(f => (
              <div key={f.key}>
                <Label className={labelClassName}>{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={form[f.key] || ""}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    rows={2}
                    className={inputClassName}
                  />
                ) : f.type === "select" ? (
                  <Select value={form[f.key] || ""} onValueChange={v => setForm({ ...form, [f.key]: v })}>
                    <SelectTrigger className={inputClassName}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {f.options.map(o => (
                        <SelectItem key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type || "text"}
                    value={form[f.key] || ""}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className={inputClassName}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button
        className="w-full h-12 font-bold text-base rounded-2xl"
        style={{
          background: save.isSuccess ? "#16a34a" : "#FA6F30",
          color: "#fff",
          transition: "background 0.3s"
        }}
        onClick={() => save.mutate()}
        disabled={save.isPending}
      >
        {save.isPending
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block" /> Saving...</>
          : save.isSuccess
            ? <><CheckCircle className="w-4 h-4 mr-2 inline" /> Saved!</>
            : <><Save className="w-4 h-4 mr-2 inline" /> Save Profile</>}
      </Button>
    </div>
  );
}
