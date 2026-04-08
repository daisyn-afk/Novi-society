import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Save, CheckCircle, User, MapPin, Phone, Heart, AlertTriangle } from "lucide-react";

export default function PatientProfile() {
  const { data: me, refetch } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const [form, setForm] = useState({});

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
    onSuccess: () => refetch(),
  });

  const initials = me?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "P";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(218,106,99,0.9)" }}>Patient</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "rgba(255,255,255,0.95)" }}>My Profile</h1>
      </div>

      {/* Avatar + name card */}
      <div className="rounded-3xl p-6 flex items-center gap-5" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.3)" }}>
        <Avatar className="w-16 h-16 flex-shrink-0">
          <AvatarFallback style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)", color: "white", fontSize: 20, fontWeight: 700 }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-bold text-white text-lg">{me?.full_name}</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{me?.email}</p>
          <span className="mt-1 inline-block text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "rgba(200,230,60,0.2)", color: "#C8E63C", border: "1px solid rgba(200,230,60,0.3)" }}>Patient</span>
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
        <div key={section.title} className="rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.3)" }}>
          <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
            <section.icon className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} />
            <p className="font-bold text-sm text-white">{section.title}</p>
            {section.subtitle && <p className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>{section.subtitle}</p>}
          </div>
          <div className="p-6 grid gap-4" style={{ gridTemplateColumns: section.fields.length > 2 ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {section.fields.map(f => (
              <div key={f.key}>
                <Label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.7)" }}>{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={form[f.key] || ""}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    rows={2}
                    className="bg-white/90 text-slate-800"
                  />
                ) : f.type === "select" ? (
                  <Select value={form[f.key] || ""} onValueChange={v => setForm({ ...form, [f.key]: v })}>
                    <SelectTrigger className="bg-white/90 text-slate-800"><SelectValue placeholder="Select..." /></SelectTrigger>
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
                    className="bg-white/90 text-slate-800"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button className="w-full h-12 font-bold text-base rounded-2xl" style={{ background: "#FA6F30", color: "#fff" }}
        onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Profile</>}
      </Button>
      {save.isSuccess && (
        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "#C8E63C" }}>
          <CheckCircle className="w-4 h-4" /> Profile saved successfully
        </div>
      )}
    </div>
  );
}