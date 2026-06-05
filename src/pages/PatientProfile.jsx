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
import { formatUsPhoneInput, usPhoneValidationError } from "@/lib/phoneValidation";

export default function PatientProfile() {
  const queryClient = useQueryClient();
  const { data: me, refetch } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [banner, setBanner] = useState(null); // { type: "success" | "error", message: string }

  const glassCardStyle = {
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(123,142,200,0.2)",
    boxShadow: "0 2px 16px rgba(30,37,53,0.07)",
  };
  const inputClassName = "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus-visible:ring-[#7B8EC8] focus-visible:border-[#7B8EC8] disabled:bg-white disabled:text-slate-900 disabled:opacity-100";
  const selectTriggerClassName = `${inputClassName} data-[disabled]:opacity-100 data-[disabled]:text-slate-900 data-[disabled]:bg-white`;
  const labelClassName = "text-xs font-semibold mb-1.5 block text-slate-700";
  const requiredFieldKeys = new Set([
    "phone",
    "city",
    "state",
    "date_of_birth",
  ]);

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

  const isAtLeast18 = (dateValue) => {
    if (!dateValue) return false;
    const dob = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(dob.getTime())) return false;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age >= 18;
  };

  const validateForm = (data) => {
    const nextErrors = {};
    const requiredMessage = "This field is required";

    if (!data.phone?.trim()) {
      nextErrors.phone = requiredMessage;
    } else {
      const phoneError = usPhoneValidationError(data.phone, { required: true });
      if (phoneError) nextErrors.phone = phoneError;
    }

    if (!data.city?.trim()) nextErrors.city = requiredMessage;
    if (!data.state?.trim()) nextErrors.state = requiredMessage;

    if (!data.date_of_birth?.trim()) {
      nextErrors.date_of_birth = requiredMessage;
    } else if (!isAtLeast18(data.date_of_birth)) {
      nextErrors.date_of_birth = "You must be at least 18 years old";
    }

    if (data.emergency_contact_phone?.trim()) {
      const emergencyPhoneError = usPhoneValidationError(data.emergency_contact_phone);
      if (emergencyPhoneError) nextErrors.emergency_contact_phone = emergencyPhoneError;
    }

    return nextErrors;
  };

  const save = useMutation({
    mutationFn: () => base44.auth.updateMe(form),
    onSuccess: (updatedMe) => {
      queryClient.setQueryData(["me"], updatedMe);
      refetch();
      setErrors({});
      setSubmitAttempted(false);
      setIsEditing(false);
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
  const maxDob = new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0];

  const handleSave = () => {
    setSubmitAttempted(true);
    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    save.mutate();
  };

  const handleEdit = () => {
    setIsEditing(true);
    setSubmitAttempted(false);
    setErrors({});
    save.reset();
  };

  const handleFieldChange = (key, value) => {
    const normalizedValue = (key === "phone" || key === "emergency_contact_phone")
      ? formatUsPhoneInput(value)
      : value;
    const nextForm = { ...form, [key]: normalizedValue };
    setForm(nextForm);
    if (submitAttempted) {
      setErrors(validateForm(nextForm));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
            { label: "Phone", key: "phone", type: "tel", placeholder: "(555) 123-4567" },
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
            { label: "Phone", key: "emergency_contact_phone", type: "tel", placeholder: "(555) 123-4567" },
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
                <Label className={labelClassName}>
                  {f.label}
                  {requiredFieldKeys.has(f.key) ? " *" : ""}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={form[f.key] || ""}
                    onChange={e => handleFieldChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={2}
                    disabled={!isEditing}
                    className={inputClassName}
                  />
                ) : f.type === "select" ? (
                  <Select value={form[f.key] || ""} onValueChange={v => handleFieldChange(f.key, v)} disabled={!isEditing}>
                    <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select..." /></SelectTrigger>
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
                    onChange={e => handleFieldChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    max={f.key === "date_of_birth" ? maxDob : undefined}
                    disabled={!isEditing}
                    className={inputClassName}
                  />
                )}
                {isEditing && errors[f.key] && (
                  <p className="text-xs text-red-600 mt-1">{errors[f.key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {isEditing ? (
        <Button
          className="w-full h-12 font-bold text-base rounded-2xl"
          style={{
            background: save.isSuccess ? "#16a34a" : "#FA6F30",
            color: "#fff",
            transition: "background 0.3s"
          }}
          onClick={handleSave}
          disabled={save.isPending}
        >
          {save.isPending
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block" /> Saving...</>
            : save.isSuccess
              ? <><CheckCircle className="w-4 h-4 mr-2 inline" /> Saved!</>
              : <><Save className="w-4 h-4 mr-2 inline" /> Save Profile</>}
        </Button>
      ) : (
        <Button
          className="w-full h-12 font-bold text-base rounded-2xl"
          style={{
            background: "#243257",
            color: "#fff",
            transition: "background 0.3s"
          }}
          onClick={handleEdit}
        >
          Edit Profile
        </Button>
      )}
    </div>
  );
}
