import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useProviderAccess } from "@/components/useProviderAccess";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, Camera, CheckCircle, Globe, Instagram } from "lucide-react";

export default function ProviderProfile() {
  const { status: accessStatus } = useProviderAccess();
  const { data: me, refetch } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);

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

  const save = useMutation({
    mutationFn: () => base44.auth.updateMe(form),
    onSuccess: () => refetch(),
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const updated = { ...form, avatar_url: file_url };
    setForm(updated);
    await base44.auth.updateMe({ avatar_url: file_url });
    refetch();
    setUploading(false);
  };

  const profileContent = (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>Account Profile</h2>
        <p className="text-sm mt-1" style={{ color: "#6B7DB3" }}>Your personal account info — name, photo, bio, and social links. This appears on your public marketplace listing.</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* Avatar upload */}
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
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              </label>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{me?.full_name}</p>
              <p className="text-sm text-slate-500">{me?.email}</p>
              <p className="text-xs mt-1" style={{ color: "#6B7DB3" }}>Hover photo to change</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>City</Label>
                <Input value={form.city || ""} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Austin" />
              </div>
              <div>
                <Label>State</Label>
                <Input value={form.state || ""} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="TX" />
              </div>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <Label>Specialty</Label>
              <Input value={form.specialty || ""} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="e.g. Botox, Fillers, PRP" />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea value={form.bio || ""} onChange={e => setForm({ ...form, bio: e.target.value })} rows={4} placeholder="Tell patients about yourself..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> Website</Label>
                <Input value={form.website_url || ""} onChange={e => setForm({ ...form, website_url: e.target.value })} placeholder="https://yoursite.com" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Instagram className="w-3.5 h-3.5" /> Instagram</Label>
                <Input value={form.instagram_handle || ""} onChange={e => setForm({ ...form, instagram_handle: e.target.value })} placeholder="@yourhandle" />
              </div>
            </div>
          </div>

          <Button className="w-full" style={{ background: "#FA6F30", color: "#fff" }}
            onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : save.isSuccess ? <><CheckCircle className="w-4 h-4 mr-2" />Saved!</> : <><Save className="w-4 h-4 mr-2" />Save Profile</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <ProviderSalesLock feature="profile" applicationStatus={accessStatus} requiredTier="full">
      {profileContent}
    </ProviderSalesLock>
  );
}