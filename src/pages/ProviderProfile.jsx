import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProviderAccess } from "@/components/useProviderAccess";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, Camera, CheckCircle, Globe, Instagram, XCircle } from "lucide-react";
import { isValidUsPhone, usPhoneValidationError } from "@/lib/phoneValidation";

export default function ProviderProfile() {
  const { status: accessStatus } = useProviderAccess();
  const queryClient = useQueryClient();
  const { data: me, refetch } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState(null); // { type: "success" | "error", message: string }

  const inputClassName = "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus-visible:ring-[#7B8EC8] focus-visible:border-[#7B8EC8] disabled:bg-slate-100 disabled:text-slate-500";
  const labelClassName = "text-slate-700 text-xs font-semibold mb-1.5 block";

  const showBanner = (type, message) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), type === "error" ? 6000 : 4000);
  };

  useEffect(() => {
    if (me) setForm({
      bio: me.bio || "",
      phone: me.phone || "",
      specialty: me.specialty || "",
      city: me.city || "",
      state: me.state || "",
      avatar_url: me.avatar_url || "",
      website_url: me.website_url || "",
      instagram_handle: me.instagram_handle || "",
    });
  }, [me]);

  const validateForm = () => {
    const phoneErr = usPhoneValidationError(form.phone, { required: true });
    if (phoneErr) return phoneErr;

    if (form.website_url) {
      try {
        const u = new URL(form.website_url);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad_protocol");
      } catch {
        return "Website URL must start with http:// or https://";
      }
    }
    return null;
  };

  const save = useMutation({
    mutationFn: async () => {
      const err = validateForm();
      if (err) throw new Error(err);
      return base44.auth.updateMe(form);
    },
    onSuccess: (updatedMe) => {
      queryClient.setQueryData(["me"], updatedMe);
      refetch();
      showBanner("success", "Profile updated successfully.");
      setTimeout(() => save.reset(), 1250);
    },
    onError: (error) => {
      showBanner("error", String(error?.message || "Could not save profile. Please try again."));
    },
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const updated = { ...form, avatar_url: file_url };
      setForm(updated);
      const updatedMe = await base44.auth.updateMe({ avatar_url: file_url });
      queryClient.setQueryData(["me"], updatedMe);
      refetch();
      showBanner("success", "Profile photo updated.");
    } catch (error) {
      showBanner("error", String(error?.message || "Photo upload failed. Please try another image."));
    } finally {
      setUploading(false);
    }
  };

  const profileContent = (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
          Account Profile
        </h2>
        <p className="text-sm mt-1" style={{ color: "#6B7DB3" }}>
          Your personal account info — name, photo, bio, and social links. This appears on your public marketplace listing.
        </p>
      </div>

      {/* Save / error banner */}
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

      <Card style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(123,142,200,0.2)", backdropFilter: "blur(14px)", boxShadow: "0 2px 16px rgba(30,37,53,0.07)" }}>
        <CardContent className="pt-6 space-y-5">

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="w-20 h-20">
                <AvatarImage src={form.avatar_url} />
                <AvatarFallback style={{ background: "#FA6F30", color: "#fff" }} className="text-2xl font-bold">
                  {me?.full_name?.[0] || "P"}
                </AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Camera className="w-5 h-5 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
              </label>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{me?.full_name}</p>
              <p className="text-sm text-slate-500">{me?.email}</p>
              <p className="text-xs mt-1" style={{ color: "#6B7DB3" }}>
                {uploading ? "Uploading photo…" : "Hover photo to change"}
              </p>
            </div>
          </div>

          {/* Fields */}
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={labelClassName}>City</Label>
                <Input className={inputClassName} value={form.city || ""} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Austin" />
              </div>
              <div>
                <Label className={labelClassName}>State</Label>
                <Input className={inputClassName} value={form.state || ""} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="TX" />
              </div>
            </div>

            <div>
              <Label className={labelClassName}>Phone *</Label>
              <Input
                type="tel"
                className={inputClassName}
                value={form.phone || ""}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 123-4567"
                style={
                  form.phone && !isValidUsPhone(form.phone)
                    ? { borderColor: "#f87171" }
                    : undefined
                }
              />
              {form.phone && !isValidUsPhone(form.phone) && (
                <p className="text-xs mt-1 text-red-600">Enter a valid US phone number (10 digits).</p>
              )}
            </div>

            <div>
              <Label className={labelClassName}>Specialty</Label>
              <Input className={inputClassName} value={form.specialty || ""} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="e.g. Botox, Fillers, PRP" />
            </div>

            <div>
              <Label className={labelClassName}>Bio</Label>
              <Textarea className={inputClassName} value={form.bio || ""} onChange={e => setForm({ ...form, bio: e.target.value })} rows={4} placeholder="Tell patients about yourself..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={`${labelClassName} flex items-center gap-1`}><Globe className="w-3.5 h-3.5" /> Website</Label>
                <Input className={inputClassName} value={form.website_url || ""} onChange={e => setForm({ ...form, website_url: e.target.value })} placeholder="https://yoursite.com" />
              </div>
              <div>
                <Label className={`${labelClassName} flex items-center gap-1`}><Instagram className="w-3.5 h-3.5" /> Instagram</Label>
                <Input className={inputClassName} value={form.instagram_handle || ""} onChange={e => setForm({ ...form, instagram_handle: e.target.value })} placeholder="@yourhandle" />
              </div>
            </div>
          </div>

          {/* Save button */}
          <Button
            className="w-full h-12 font-bold text-base rounded-2xl"
            style={{
              background: save.isSuccess ? "#16a34a" : "#FA6F30",
              color: "#fff",
              transition: "background 0.3s",
            }}
            onClick={() => save.mutate()}
            disabled={save.isPending || uploading || Boolean(usPhoneValidationError(form.phone, { required: true }))}
          >
            {save.isPending
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block" /> Saving...</>
              : save.isSuccess
                ? <><CheckCircle className="w-4 h-4 mr-2 inline" /> Saved!</>
                : <><Save className="w-4 h-4 mr-2 inline" /> Save Profile</>}
          </Button>

        </CardContent>
      </Card>
    </div>
  );

  return (
    <ProviderSalesLock feature="profile" applicationStatus={accessStatus} requiredTier="none">
      {profileContent}
    </ProviderSalesLock>
  );
}
