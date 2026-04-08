import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Save, CheckCircle, MapPin, Phone, Globe, Instagram, User, DollarSign,
  Camera, Lock, Facebook, Twitter, Mail, Building2, Award,
  Plus, X, ChevronDown, ChevronUp, ShieldCheck, Eye, Star, Clock, Shield, Copy, Link
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const GLASS_STYLE = {
  background: "rgba(255,255,255,0.5)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
};

const GlassCard = ({ children, className = "" }) => (
  <div className={`rounded-2xl overflow-hidden ${className}`} style={GLASS_STYLE}>
    {children}
  </div>
);

const CardHeader = ({ label, color = "#b91c1c" }) => (
  <div className="px-6 py-3.5" style={{ borderBottom: "1px solid rgba(30,37,53,0.07)" }}>
    <p className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{label}</p>
  </div>
);

const FieldLabel = ({ children }) => (
  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>{children}</p>
);

const GlassInput = ({ className = "", ...props }) => (
  <input
    {...props}
    className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all ${className}`}
    style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535", ...props.style }}
  />
);

const GlassTextarea = ({ className = "", ...props }) => (
  <textarea
    {...props}
    className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all resize-none ${className}`}
    style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535", ...props.style }}
  />
);

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = ["8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM","7:00 PM","8:00 PM"];

const LANGUAGES = ["English", "Spanish", "French", "Mandarin", "Portuguese", "Arabic", "Hindi", "Korean"];

function BookingLinkCard({ me }) {
  const [copied, setCopied] = useState(false);
  const bookingUrl = me ? `${window.location.origin}/PatientMarketplace?provider=${me.id}` : "";
  const copy = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <GlassCard>
      <div className="px-6 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Link className="w-4 h-4" style={{ color: "#7B8EC8" }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>Your Booking Link</p>
        </div>
        <p className="text-xs mb-3" style={{ color: "rgba(30,37,53,0.5)" }}>Drop this in your Instagram bio, texts, anywhere. Patients tap it and book directly with you.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 rounded-xl text-xs font-mono truncate" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.12)", color: "rgba(30,37,53,0.6)" }}>
            {bookingUrl || "Save your profile first to generate your link"}
          </div>
          <button onClick={copy} disabled={!bookingUrl}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0"
            style={{ background: copied ? "rgba(200,230,60,0.2)" : "rgba(123,142,200,0.15)", color: copied ? "#4a6b10" : "#7B8EC8", border: `1px solid ${copied ? "rgba(200,230,60,0.4)" : "rgba(123,142,200,0.25)"}` }}>
            <Copy className="w-3.5 h-3.5" />{copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

export default function PracticeProfileTab({ form, setForm, me, onSave, saving, saved, serviceTypes = [], activeServiceIds = new Set(), manufacturerApplications = [] }) {
  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ hours: true, specialties: true });
  const [previewOpen, setPreviewOpen] = useState(false);

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const schedule = form.schedule || {};
  const specialties = form.specialties || [];
  const languages = form.languages || [];
  const credentials = form.credentials || [];
  const [newCredential, setNewCredential] = useState({ title: "", institution: "", year: "" });

  const updateDay = (day, field, val) => {
    f("schedule", { ...schedule, [day]: { ...schedule[day], [field]: val } });
  };

  const toggleSpecialty = (s) => {
    f("specialties", specialties.includes(s) ? specialties.filter(x => x !== s) : [...specialties, s]);
  };

  const toggleLanguage = (l) => {
    f("languages", languages.includes(l) ? languages.filter(x => x !== l) : [...languages, l]);
  };

  const addCredential = () => {
    if (!newCredential.title) return;
    f("credentials", [...credentials, newCredential]);
    setNewCredential({ title: "", institution: "", year: "" });
  };

  const removeCredential = (i) => f("credentials", credentials.filter((_, idx) => idx !== i));

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    f("avatar_url", file_url);
    setUploadingPhoto(false);
  };

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Profile Preview ── */}
      <GlassCard>
        <div className="px-6 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(30,37,53,0.07)" }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(250,111,48,0.9)" }}>Patient-Facing Profile Preview</p>
          <button
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
            style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.25)" }}
          >
            <Eye className="w-3.5 h-3.5" /> View as Patient
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-start gap-5">
            {/* Avatar with upload */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-bold text-white"
                style={{ background: form.avatar_url ? "transparent" : "#FA6F30", boxShadow: "0 4px 14px rgba(250,111,48,0.35)" }}>
                {form.avatar_url
                  ? <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : (form.practice_name || me?.full_name || "P")[0]
                }
              </div>
              <label className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80" style={{ background: "#FA6F30" }}>
                {uploadingPhoto ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 font-bold text-xl leading-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>
                {form.practice_name || me?.full_name || "Your Practice Name"}
              </p>
              <p className="text-gray-500 text-sm mt-0.5">{me?.full_name}</p>
              {(form.city || form.state) && (
                <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{[form.city, form.state].filter(Boolean).join(", ")}
                </p>
              )}
              {specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {specialties.slice(0, 4).map(id => {
                      const st = serviceTypes.find(s => s.id === id);
                      return (
                        <span key={id} className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-orange-50 text-orange-700 border border-orange-100">{st?.name || id}</span>
                      );
                    })}
                    {specialties.length > 4 && <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">+{specialties.length - 4} more</span>}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: form.accepts_new_patients ? "#dcfce7" : "#f3f4f6", color: form.accepts_new_patients ? "#16a34a" : "#6b7280", border: `1px solid ${form.accepts_new_patients ? "#bbf7d0" : "#e5e7eb"}` }}>
                {form.accepts_new_patients ? "✦ Accepting Patients" : "Closed"}
              </span>
              {form.consultation_fee && (
                <span className="text-xs text-gray-500">Consult: <strong className="text-gray-800">${form.consultation_fee}</strong></span>
              )}
            </div>
          </div>
          {form.bio && <p className="text-gray-600 text-sm mt-4 leading-relaxed line-clamp-3">{form.bio}</p>}
        </div>
      </GlassCard>

      {/* ── Practice Info ── */}
      <GlassCard>
        <CardHeader label="Practice Information" />
        <div className="px-6 py-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldLabel><Building2 className="w-3.5 h-3.5" /> Practice / Business Name</FieldLabel>
              <GlassInput placeholder="e.g. Glow by Ashlan" value={form.practice_name} onChange={e => f("practice_name", e.target.value)} />
            </div>
            <div>
              <FieldLabel><Mail className="w-3.5 h-3.5" /> Contact Email</FieldLabel>
              <GlassInput placeholder="practice@email.com" value={form.contact_email || ""} onChange={e => f("contact_email", e.target.value)} />
            </div>
            <div>
              <FieldLabel><Phone className="w-3.5 h-3.5" /> Phone Number</FieldLabel>
              <GlassInput placeholder="(555) 000-0000" value={form.phone} onChange={e => f("phone", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel><MapPin className="w-3.5 h-3.5" /> Street Address</FieldLabel>
              <GlassInput placeholder="123 Main St, Suite 100" value={form.address || ""} onChange={e => f("address", e.target.value)} />
            </div>
            <div>
              <FieldLabel>City</FieldLabel>
              <GlassInput placeholder="Chicago" value={form.city} onChange={e => f("city", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>State</FieldLabel>
                <GlassInput placeholder="IL" value={form.state} onChange={e => f("state", e.target.value)} />
              </div>
              <div>
                <FieldLabel>ZIP</FieldLabel>
                <GlassInput placeholder="60601" value={form.zip || ""} onChange={e => f("zip", e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <FieldLabel><User className="w-3.5 h-3.5" /> Bio / About Your Practice</FieldLabel>
            <GlassTextarea
              placeholder="Tell patients about your background, approach, and what makes your practice unique..."
              className="h-32"
              value={form.bio}
              onChange={e => f("bio", e.target.value)}
            />
            <p className="text-xs mt-1 text-gray-400">{form.bio?.length || 0} / 500 characters</p>
          </div>
        </div>
      </GlassCard>

      {/* ── Social & Web Presence ── */}
      <GlassCard>
        <CardHeader label="Online Presence" />
        <div className="px-6 py-5 grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel><Globe className="w-3.5 h-3.5" /> Website</FieldLabel>
            <GlassInput placeholder="https://yourwebsite.com" value={form.website} onChange={e => f("website", e.target.value)} />
          </div>
          <div>
            <FieldLabel><Instagram className="w-3.5 h-3.5" /> Instagram</FieldLabel>
            <GlassInput placeholder="@yourhandle" value={form.instagram} onChange={e => f("instagram", e.target.value)} />
          </div>
          <div>
            <FieldLabel><Facebook className="w-3.5 h-3.5" /> Facebook</FieldLabel>
            <GlassInput placeholder="facebook.com/yourpage" value={form.facebook || ""} onChange={e => f("facebook", e.target.value)} />
          </div>
          <div>
            <FieldLabel><Twitter className="w-3.5 h-3.5" /> TikTok / Twitter</FieldLabel>
            <GlassInput placeholder="@yourhandle" value={form.tiktok || ""} onChange={e => f("tiktok", e.target.value)} />
          </div>
        </div>
      </GlassCard>

      {/* ── Booking Link ── */}
      <BookingLinkCard me={me} />

      {/* ── Pricing & Availability ── */}
      <GlassCard>
        <CardHeader label="Pricing & Availability" />
        <div className="px-6 py-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel><DollarSign className="w-3.5 h-3.5" /> Consultation Fee ($)</FieldLabel>
              <GlassInput type="number" placeholder="0" value={form.consultation_fee} onChange={e => f("consultation_fee", e.target.value)} />
            </div>
            <div>
              <FieldLabel><DollarSign className="w-3.5 h-3.5" /> Starting Price ($)</FieldLabel>
              <GlassInput type="number" placeholder="e.g. 200" value={form.starting_price || ""} onChange={e => f("starting_price", e.target.value)} />
            </div>
            <div>
              <FieldLabel><DollarSign className="w-3.5 h-3.5" /> Booking Deposit (%)</FieldLabel>
              <GlassInput type="number" placeholder="e.g. 25" value={form.deposit_percent || ""} onChange={e => f("deposit_percent", e.target.value)} />
              <p className="text-xs mt-1 text-gray-400">Collected upfront to hold the appointment</p>
            </div>
            <div>
              <FieldLabel><Clock className="w-3.5 h-3.5" /> Cancellation Window (hours)</FieldLabel>
              <GlassInput type="number" placeholder="e.g. 24" value={form.cancellation_hours || ""} onChange={e => f("cancellation_hours", e.target.value)} />
              <p className="text-xs mt-1 text-gray-400">How far in advance they must cancel</p>
            </div>
          </div>
          <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.1)" }}>
            <Switch id="new-patients" checked={form.accepts_new_patients} onCheckedChange={val => f("accepts_new_patients", val)} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Accepting New Patients</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>Patients can only book if this is on</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: form.accepts_new_patients ? "#dcfce7" : "#f3f4f6", color: form.accepts_new_patients ? "#16a34a" : "#6b7280" }}>
              {form.accepts_new_patients ? "Open" : "Closed"}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* ── Office Hours ── */}
      <GlassCard>
        <button className="w-full px-6 py-3.5 flex items-center justify-between border-b border-gray-100" onClick={() => toggleSection("hours")}>
          <p className="text-xs font-bold uppercase tracking-widest text-red-600">Office Hours</p>
          {expandedSections.hours ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {expandedSections.hours && (
          <div className="px-6 py-4 space-y-2">
            {DAYS.map(day => {
              const d = schedule[day] || {};
              return (
                <div key={day} className="flex items-center gap-3">
                  <div className="w-28 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Switch checked={!!d.open} onCheckedChange={val => updateDay(day, "open", val)} className="scale-75" />
                      <p className="text-sm font-medium" style={{ color: "#1e2535" }}>{day.slice(0,3)}</p>
                    </div>
                  </div>
                  {d.open ? (
                    <div className="flex items-center gap-2 flex-1">
                      <select value={d.start || "9:00 AM"} onChange={e => updateDay(day, "start", e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                        style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}>
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>–</span>
                      <select value={d.end || "5:00 PM"} onChange={e => updateDay(day, "end", e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                        style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}>
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ) : (
                    <p className="text-xs italic" style={{ color: "rgba(30,37,53,0.35)" }}>Closed</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* ── Specialties (driven by approved active service types) ── */}
      <GlassCard>
        <button className="w-full px-6 py-3.5 flex items-center justify-between border-b border-gray-100" onClick={() => toggleSection("specialties")}>
          <p className="text-xs font-bold uppercase tracking-widest text-red-600">Specialties & Services</p>
          {expandedSections.specialties ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {expandedSections.specialties && (
          <div className="px-6 py-4 space-y-4">
            {serviceTypes.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No services configured yet.</p>
            ) : (
              <>
                {/* Active / approved services — selectable */}
                {serviceTypes.filter(st => activeServiceIds.has(st.id)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                      <p className="text-xs font-semibold text-green-700">Approved & Active — click to show on profile</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {serviceTypes.filter(st => activeServiceIds.has(st.id)).map(st => {
                        const selected = specialties.includes(st.id);
                        return (
                          <button key={st.id} onClick={() => toggleSpecialty(st.id)}
                            className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5"
                            style={selected
                              ? { background: "#FA6F30", color: "#fff" }
                              : { background: "rgba(255,255,255,0.65)", color: "#1e2535", border: "1px solid rgba(30,37,53,0.12)" }
                            }>
                            {selected && <CheckCircle className="w-3 h-3" />}
                            {st.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Inactive / not approved — locked */}
                {serviceTypes.filter(st => !activeServiceIds.has(st.id)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-xs font-semibold text-gray-400">Requires MD Coverage Activation</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {serviceTypes.filter(st => !activeServiceIds.has(st.id)).map(st => (
                        <span key={st.id} className="text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 cursor-not-allowed bg-gray-100 text-gray-400 border border-gray-200">
                          <Lock className="w-3 h-3" /> {st.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </GlassCard>

      {/* ── Languages ── */}
      <GlassCard>
        <CardHeader label="Languages Spoken" />
        <div className="px-6 py-4 flex flex-wrap gap-2">
          {LANGUAGES.map(l => {
            const active = languages.includes(l);
            return (
              <button key={l} onClick={() => toggleLanguage(l)}
                className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                style={active
                  ? { background: "#7B8EC8", color: "#fff" }
                  : { background: "rgba(255,255,255,0.65)", color: "#1e2535", border: "1px solid rgba(30,37,53,0.12)" }
                }>
                {l}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* ── Credentials & Education ── */}
      <GlassCard>
        <CardHeader label="Credentials & Education" />
        <div className="px-6 py-4 space-y-4">
          {credentials.length > 0 && (
            <div className="space-y-2">
              {credentials.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.1)" }}>
                  <div className="flex items-center gap-2.5">
                    <Award className="w-4 h-4 flex-shrink-0 text-orange-500" />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{c.title}</p>
                      {(c.institution || c.year) && (
                        <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{[c.institution, c.year].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => removeCredential(i)} className="hover:text-red-400 transition-colors" style={{ color: "rgba(30,37,53,0.25)" }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <GlassInput placeholder="Degree / Certification" value={newCredential.title} onChange={e => setNewCredential(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <GlassInput placeholder="Institution" value={newCredential.institution} onChange={e => setNewCredential(p => ({ ...p, institution: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <GlassInput placeholder="Year" value={newCredential.year} onChange={e => setNewCredential(p => ({ ...p, year: e.target.value }))} />
              <Button onClick={addCredential} disabled={!newCredential.title} size="sm" className="flex-shrink-0 gap-1 font-bold" style={{ background: "#FA6F30", color: "#fff" }}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>

      <Button onClick={() => onSave()} disabled={saving} className="font-bold gap-2 px-8" style={{ background: "#FA6F30", color: "#fff", borderRadius: 12 }}>
        {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Profile</>}
      </Button>

      {/* ── Patient Profile Preview Modal ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#f5f3ef", borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" style={{ color: "#7B8EC8" }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>Patient View Preview</p>
            </div>
            <p className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.2)" }}>
              This is what patients see
            </p>
          </div>

          {/* Hero / top */}
          <div className="px-6 pt-6 pb-4" style={{ background: "#fff" }}>
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center text-2xl font-bold text-white"
                style={{ background: form.avatar_url ? "transparent" : "#FA6F30", boxShadow: "0 4px 14px rgba(250,111,48,0.25)" }}>
                {form.avatar_url
                  ? <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : (form.practice_name || me?.full_name || "P")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xl leading-tight" style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}>
                  {form.practice_name || me?.full_name || "Your Practice"}
                </p>
                <p className="text-sm mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{me?.full_name}</p>
                {(form.city || form.state) && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "rgba(30,37,53,0.45)" }}>
                    <MapPin className="w-3 h-3" />{[form.city, form.state].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ background: form.accepts_new_patients ? "#dcfce7" : "#f3f4f6", color: form.accepts_new_patients ? "#16a34a" : "#6b7280" }}>
                {form.accepts_new_patients ? "✦ Accepting" : "Closed"}
              </span>
            </div>

            {/* Specialties */}
            {form.specialties?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {form.specialties.slice(0, 5).map(id => {
                  const st = serviceTypes.find(s => s.id === id);
                  return <span key={id} className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ background: "#fff5f0", color: "#FA6F30", border: "1px solid #fed7c7" }}>{st?.name || id}</span>;
                })}
              </div>
            )}

            {/* Bio */}
            {form.bio && (
              <p className="text-sm mt-3 leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>{form.bio}</p>
            )}
          </div>

          {/* Trust badges */}
          <div className="px-6 py-3 flex flex-wrap gap-2" style={{ background: "#f9f8f6", borderTop: "1px solid rgba(30,37,53,0.06)", borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.2)" }}>
              <Shield className="w-3 h-3" /> NOVI Verified
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(200,230,60,0.1)", color: "#5a7a20", border: "1px solid rgba(200,230,60,0.25)" }}>
              <ShieldCheck className="w-3 h-3" /> MD Board Supervised
            </span>
            {manufacturerApplications.some(a => a.status === "approved") && (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(45,107,127,0.1)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.2)" }}>
                <CheckCircle className="w-3 h-3" /> FDA-Approved US Products
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="px-6 py-4 space-y-4" style={{ background: "#fff" }}>
            {/* Pricing */}
            {(form.consultation_fee || form.starting_price) && (
              <div className="grid grid-cols-2 gap-3">
                {form.consultation_fee && (
                  <div className="px-4 py-3 rounded-xl text-center" style={{ background: "#f9f8f6", border: "1px solid rgba(30,37,53,0.07)" }}>
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Consultation</p>
                    <p className="font-bold text-lg" style={{ color: "#1e2535" }}>${form.consultation_fee}</p>
                  </div>
                )}
                {form.starting_price && (
                  <div className="px-4 py-3 rounded-xl text-center" style={{ background: "#f9f8f6", border: "1px solid rgba(30,37,53,0.07)" }}>
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Starting at</p>
                    <p className="font-bold text-lg" style={{ color: "#1e2535" }}>${form.starting_price}</p>
                  </div>
                )}
              </div>
            )}

            {/* Hours snippet */}
            {Object.keys(form.schedule || {}).some(d => form.schedule[d]?.open) && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>Office Hours</p>
                <div className="space-y-1">
                  {DAYS.filter(d => form.schedule?.[d]?.open).map(d => (
                    <div key={d} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg" style={{ background: "#f9f8f6" }}>
                      <span style={{ color: "rgba(30,37,53,0.6)" }}>{d}</span>
                      <span className="font-medium" style={{ color: "#1e2535" }}>{form.schedule[d].start || "9:00 AM"} – {form.schedule[d].end || "5:00 PM"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {form.languages?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>Languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {form.languages.map(l => (
                    <span key={l} className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.15)" }}>{l}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Credentials */}
            {form.credentials?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>Credentials</p>
                <div className="space-y-1.5">
                  {form.credentials.map((c, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: "#f9f8f6" }}>
                      <Award className="w-4 h-4 flex-shrink-0" style={{ color: "#FA6F30" }} />
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{c.title}</p>
                        {(c.institution || c.year) && <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>{[c.institution, c.year].filter(Boolean).join(" · ")}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Social */}
            {(form.website || form.instagram) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {form.website && <a href={form.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: "#f9f8f6", color: "rgba(30,37,53,0.6)", border: "1px solid rgba(30,37,53,0.08)" }}><Globe className="w-3 h-3" /> Website</a>}
                {form.instagram && <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: "#f9f8f6", color: "rgba(30,37,53,0.6)", border: "1px solid rgba(30,37,53,0.08)" }}><Instagram className="w-3 h-3" /> {form.instagram}</span>}
              </div>
            )}
          </div>

          <div className="px-6 pb-5">
            <button className="w-full py-3 rounded-2xl font-bold text-sm" style={{ background: "#FA6F30", color: "#fff" }}>
              Book an Appointment
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}