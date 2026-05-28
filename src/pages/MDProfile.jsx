import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminApiRequest } from "@/api/adminApiRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Save,
  CheckCircle,
  User,
  Phone,
  MapPin,
  Stethoscope,
  Camera,
  Layers,
} from "lucide-react";
import MDServiceOfferingsSection from "@/components/md/MDServiceOfferingsSection";
import { formatUsPhoneInput, usPhoneValidationError } from "@/lib/phoneValidation";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

const glassCard = {
  background: "rgba(255,255,255,0.75)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.9)",
  borderRadius: 20,
  boxShadow: "0 4px 16px rgba(31,38,135,0.06)",
};

const heading = { fontFamily: "'DM Serif Display', serif", color: "#1e2535" };
const bodyMuted = { color: "rgba(30,37,53,0.62)" };
const labelStyle = { color: "rgba(30,37,53,0.75)" };
const sectionBorder = { borderBottom: "1px solid rgba(30,37,53,0.08)" };

export default function MDProfile() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["md-profile-me"],
    queryFn: () => adminApiRequest("/admin/md-profile/me", { method: "GET" }),
  });
  const { data: serviceOfferings } = useQuery({
    queryKey: ["md-service-offerings-me"],
    queryFn: () => adminApiRequest("/admin/md-service-offerings/me", { method: "GET" }),
  });

  const [form, setForm] = useState({});
  const [licensedStates, setLicensedStates] = useState([]);
  const [nationwide, setNationwide] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      phone: profile.phone || "",
      city: profile.city || "",
      state: profile.state || "",
      bio: profile.bio || "",
      specialty: profile.specialty || "",
      avatar_url: profile.avatar_url || "",
      npi: profile.npi || "",
      medical_license_number: profile.medical_license_number || "",
      license_state: profile.license_state || "",
      board_certifications: profile.board_certifications || "",
    });
    const states = profile.licensed_states || [];
    setLicensedStates(states);
    setNationwide(states.length === 0);
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      adminApiRequest("/admin/md-profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          licensed_states: nationwide ? [] : licensedStates,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["md-profile-me"] });
      setErrors({});
      setSubmitAttempted(false);
    },
  });

  useEffect(() => {
    if (!save.isSuccess) return undefined;
    const timer = setTimeout(() => save.reset(), 3000);
    return () => clearTimeout(timer);
  }, [save.isSuccess, save]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, avatar_url: file_url }));
    } finally {
      setUploading(false);
    }
  };

  function toggleLicensedState(code) {
    setNationwide(false);
    setLicensedStates((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return [...next].sort();
    });
  }

  useEffect(() => {
    if (!submitAttempted) return;
    setErrors(validateForm(form));
  }, [licensedStates, nationwide, serviceOfferings, submitAttempted]); // eslint-disable-line react-hooks/exhaustive-deps

  const requiredFieldKeys = new Set([
    "phone",
    "city",
    "state",
    "specialty",
    "npi",
    "medical_license_number",
  ]);

  const validateForm = (data) => {
    const nextErrors = {};
    const requiredMessage = "This field is required";

    if (!data.phone?.trim()) nextErrors.phone = requiredMessage;
    else {
      const phoneError = usPhoneValidationError(data.phone, { required: true });
      if (phoneError) nextErrors.phone = phoneError;
    }

    if (!data.city?.trim()) nextErrors.city = requiredMessage;
    if (!data.state?.trim()) nextErrors.state = requiredMessage;
    if (!data.specialty?.trim()) nextErrors.specialty = requiredMessage;
    if (!data.npi?.trim()) nextErrors.npi = requiredMessage;
    if (!data.medical_license_number?.trim()) nextErrors.medical_license_number = requiredMessage;

    if (!nationwide && licensedStates.length === 0) {
      nextErrors.licensed_states = "Select at least one state or enable Nationwide.";
    }

    if (!serviceOfferings?.service_type_ids?.length) {
      nextErrors.service_type_ids = "Select at least one supervised service and save it.";
    }

    return nextErrors;
  };

  const handleFieldChange = (key, value) => {
    const normalizedValue = key === "phone" ? formatUsPhoneInput(value) : value;
    const nextForm = { ...form, [key]: normalizedValue };
    setForm(nextForm);
    if (submitAttempted) {
      setErrors(validateForm(nextForm));
    }
  };

  const handleSave = () => {
    setSubmitAttempted(true);
    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    save.mutate();
  };

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MD";

  const sections = [
    {
      title: "Contact",
      icon: Phone,
      fields: [
        { label: "Phone", key: "phone", type: "tel", placeholder: "(555) 123-4567" },
        { label: "City", key: "city", placeholder: "Austin" },
        { label: "State", key: "state", placeholder: "TX" },
      ],
    },
    {
      title: "Medical credentials",
      icon: Stethoscope,
      fields: [
        { label: "Specialty", key: "specialty", placeholder: "e.g. Aesthetic medicine, dermatology" },
        { label: "NPI", key: "npi", placeholder: "National Provider Identifier" },
        { label: "Medical license #", key: "medical_license_number", placeholder: "License number" },
        { label: "License state", key: "license_state", placeholder: "TX" },
        {
          label: "Board certifications",
          key: "board_certifications",
          type: "textarea",
          placeholder: "List board certifications and dates…",
        },
      ],
    },
    {
      title: "About you",
      icon: User,
      fields: [
        {
          label: "Bio",
          key: "bio",
          type: "textarea",
          placeholder: "Brief professional background for providers and NOVI staff…",
        },
      ],
    },
  ];

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-sm text-slate-500">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(218,106,99,0.9)" }}>
          Medical Director
        </p>
        <h1 className="text-3xl italic font-normal" style={heading}>
          My Profile
        </h1>
        <p className="text-sm mt-1" style={bodyMuted}>
          Your details and the services you supervise are used when NOVI assigns you to providers.
        </p>
      </div>

      <div className="p-6 flex items-center gap-5" style={glassCard}>
        <div className="relative group flex-shrink-0">
          <Avatar className="w-16 h-16">
            <AvatarImage src={form.avatar_url} />
            <AvatarFallback
              className="text-xl font-bold text-white"
              style={{ background: "linear-gradient(135deg, #2D6B7F, #7B8EC8)" }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
            <Camera className="w-5 h-5 text-white" />
            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
          </label>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div>
          <p className="font-bold text-lg text-slate-900">{profile?.full_name || "Medical Director"}</p>
          <p className="text-sm text-slate-500">{profile?.email}</p>
          <span
            className="mt-2 inline-block text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: "rgba(45,107,127,0.12)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.2)" }}
          >
            Medical Director
          </span>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="overflow-hidden" style={glassCard}>
          <div className="px-6 py-4 flex items-center gap-2" style={sectionBorder}>
            <section.icon className="w-4 h-4 text-slate-500" />
            <p className="font-bold text-sm text-slate-900">{section.title}</p>
          </div>
          <div className="p-6 grid gap-4">
            {section.fields.map((f) => (
              <div key={f.key}>
                <Label className="text-xs font-semibold mb-1.5 block" style={labelStyle}>
                  {f.label}
                  {requiredFieldKeys.has(f.key) ? " *" : ""}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={form[f.key] || ""}
                    onChange={(e) => handleFieldChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={3}
                    className="bg-white border-slate-200 text-slate-900"
                  />
                ) : (
                  <Input
                    type={f.type || "text"}
                    value={form[f.key] || ""}
                    onChange={(e) => handleFieldChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="bg-white border-slate-200 text-slate-900"
                  />
                )}
                {errors[f.key] && (
                  <p className="text-xs text-red-600 mt-1">{errors[f.key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="overflow-hidden" style={glassCard}>
        <div className="px-6 py-4 flex items-center gap-2" style={sectionBorder}>
          <MapPin className="w-4 h-4 text-slate-500" />
          <p className="font-bold text-sm text-slate-900">Supervision coverage by state *</p>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500" style={{ lineHeight: 1.6 }}>
            Leave empty for nationwide coverage. Select states only if you limit where you can supervise (when state matching is enabled).
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={nationwide}
              onCheckedChange={(checked) => {
                setNationwide(Boolean(checked));
                if (checked) setLicensedStates([]);
              }}
            />
            <span className="text-sm text-slate-800 font-medium">Nationwide (all states)</span>
          </label>
          {!nationwide && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
              {US_STATES.map((code) => (
                <label key={code} className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                  <Checkbox
                    checked={licensedStates.includes(code)}
                    onCheckedChange={() => toggleLicensedState(code)}
                  />
                  {code}
                </label>
              ))}
            </div>
          )}
          {errors.licensed_states && (
            <p className="text-xs text-red-600">{errors.licensed_states}</p>
          )}
        </div>
      </div>

      <div className="overflow-hidden" style={glassCard}>
        <div className="px-6 py-4 flex items-center gap-2" style={sectionBorder}>
          <Layers className="w-4 h-4 text-slate-500" />
          <div>
            <p className="font-bold text-sm text-slate-900">Services I supervise *</p>
            <p className="text-xs mt-0.5 text-slate-500">
              Providers are auto-assigned to you only for services you select here.
            </p>
          </div>
        </div>
        <div className="p-6">
          <MDServiceOfferingsSection />
          {errors.service_type_ids && (
            <p className="text-xs text-red-600 mt-3">{errors.service_type_ids}</p>
          )}
        </div>
      </div>

      <Button
        className="w-full h-12 font-bold text-base rounded-2xl"
        style={{ background: "#FA6F30", color: "#fff" }}
        onClick={handleSave}
        disabled={save.isPending}
      >
        {save.isPending ? "Saving…" : (
          <>
            <Save className="w-4 h-4 mr-2" /> Save profile
          </>
        )}
      </Button>
      {save.isSuccess && (
        <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 font-medium">
          <CheckCircle className="w-4 h-4" /> Profile saved
        </div>
      )}
      {save.isError && (
        <p className="text-sm text-center text-red-600">{String(save.error?.message || "Save failed.")}</p>
      )}
    </div>
  );
}
