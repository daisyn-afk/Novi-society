import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Send, Sparkles, Package, Calendar, AlertTriangle, CheckCircle, MessageSquare } from "lucide-react";

export default function AftercarePlanDialog({ open, onClose, treatmentRecord }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    immediate_care: [],
    daily_routine: [],
    dos_and_donts: { dos: [], donts: [] },
    recommended_products: [],
    suggested_treatments: [],
    expected_timeline: [],
    red_flags: [],
    follow_up_date: "",
    provider_notes: "",
    checkin_questions: [],
    checkin_recovery_days: 14,
  });

  // Fetch provider's active services for treatment recommendations
  const { data: providerServices = [] } = useQuery({
    queryKey: ["provider-services", treatmentRecord?.provider_id],
    queryFn: async () => {
      if (!treatmentRecord?.provider_id) return [];
      const subs = await base44.entities.MDSubscription.filter({
        provider_id: treatmentRecord.provider_id,
        status: "active",
      });
      return subs;
    },
    enabled: !!treatmentRecord?.provider_id && open,
  });

  // Check if plan already exists
  const { data: existingPlan } = useQuery({
    queryKey: ["aftercare-plan", treatmentRecord?.id],
    queryFn: async () => {
      const plans = await base44.entities.AftercarePlan.filter({ treatment_record_id: treatmentRecord.id });
      return plans[0];
    },
    enabled: !!treatmentRecord?.id && open,
  });

  useEffect(() => {
    if (existingPlan && open) {
      setForm({
        immediate_care: existingPlan.immediate_care || [],
        daily_routine: existingPlan.daily_routine || [],
        dos_and_donts: existingPlan.dos_and_donts || { dos: [], donts: [] },
        recommended_products: existingPlan.recommended_products || [],
        suggested_treatments: existingPlan.suggested_treatments || [],
        expected_timeline: existingPlan.expected_timeline || [],
        red_flags: existingPlan.red_flags || [],
        follow_up_date: existingPlan.follow_up_date || "",
        provider_notes: existingPlan.provider_notes || "",
        checkin_questions: existingPlan.checkin_questions || [],
        checkin_recovery_days: existingPlan.checkin_recovery_days || 14,
      });
    }
  }, [existingPlan, open]);

  const handleAIGenerate = async () => {
    setGenerating(true);
    try {
      const servicesList = providerServices.map(s => s.service_type_name).join(", ");
      
      const prompt = `You are creating a post-treatment aftercare plan for a patient who just received "${treatmentRecord.service}" treatment.

Treatment details:
- Service performed: ${treatmentRecord.service}
- Areas treated: ${treatmentRecord.areas_treated?.join(", ") || "multiple areas"}
- Units/Amount used: ${treatmentRecord.units_used || "standard"} ${treatmentRecord.units_label || "units"}
- Products used: ${treatmentRecord.products_used?.map(p => p.product_name).join(", ") || "standard products"}
- Clinical notes: ${treatmentRecord.clinical_notes || "standard procedure"}

Provider's available services for follow-up recommendations: ${servicesList || "various aesthetic services"}

IMPORTANT: Base ALL recommendations specifically on "${treatmentRecord.service}" treatment protocols and the actual treatment details above.

Create a comprehensive aftercare plan that:
1. Immediate care (first 24-48 hours) - 3-5 bullet points
2. Daily routine (1-2 weeks) - 3-5 bullet points  
3. Dos and Don'ts - 3-4 of each
4. Recommended products - 2-4 products this provider can offer (cleanser, moisturizer, serum, SPF)
5. Suggested follow-up treatments - 1-3 treatments from the provider's service list that complement this procedure
6. Expected timeline - 3-4 stages (e.g. "1-3 days: initial swelling", "7-10 days: results emerging")
7. Red flags - 3-4 warning signs requiring immediate contact

Make it specific to ${treatmentRecord.service} and personalized to their treatment.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            immediate_care: { type: "array", items: { type: "string" } },
            daily_routine: { type: "array", items: { type: "string" } },
            dos: { type: "array", items: { type: "string" } },
            donts: { type: "array", items: { type: "string" } },
            recommended_products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_name: { type: "string" },
                  product_type: { type: "string" },
                  reason: { type: "string" }
                }
              }
            },
            suggested_treatments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  treatment_name: { type: "string" },
                  timing: { type: "string" },
                  reason: { type: "string" }
                }
              }
            },
            expected_timeline: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  days: { type: "string" },
                  what_to_expect: { type: "string" }
                }
              }
            },
            red_flags: { type: "array", items: { type: "string" } }
          }
        }
      });

      setForm(f => ({
        ...f,
        immediate_care: res.immediate_care || [],
        daily_routine: res.daily_routine || [],
        dos_and_donts: { dos: res.dos || [], donts: res.donts || [] },
        recommended_products: (res.recommended_products || []).map(p => ({ ...p, provider_carries: true, purchase_url: "" })),
        suggested_treatments: (res.suggested_treatments || []).map(t => {
          const matchingSvc = providerServices.find(s => s.service_type_name.toLowerCase().includes(t.treatment_name.toLowerCase()));
          return { ...t, service_type_id: matchingSvc?.service_type_id || "" };
        }),
        expected_timeline: res.expected_timeline || [],
        red_flags: res.red_flags || [],
      }));
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setGenerating(false);
    }
  };

  const savePlan = useMutation({
    mutationFn: async (shouldSend) => {
      const payload = {
        treatment_record_id: treatmentRecord.id,
        provider_id: treatmentRecord.provider_id,
        provider_name: treatmentRecord.provider_name,
        provider_email: treatmentRecord.provider_email,
        patient_id: treatmentRecord.patient_id,
        patient_email: treatmentRecord.patient_email,
        patient_name: treatmentRecord.patient_name,
        service: treatmentRecord.service,
        treatment_date: treatmentRecord.treatment_date,
        status: shouldSend ? "sent" : "draft",
        sent_at: shouldSend ? new Date().toISOString() : undefined,
        ...form,
      };

      let plan;
      if (existingPlan) {
        plan = await base44.entities.AftercarePlan.update(existingPlan.id, payload);
      } else {
        plan = await base44.entities.AftercarePlan.create(payload);
      }

      // Mark treatment record as having aftercare sent
      if (shouldSend) {
        await base44.entities.TreatmentRecord.update(treatmentRecord.id, {
          aftercare_plan_sent: true,
          aftercare_plan_sent_at: new Date().toISOString(),
        });

        // Notify patient
        await base44.entities.Notification.create({
          user_id: treatmentRecord.patient_id,
          user_email: treatmentRecord.patient_email,
          type: "general",
          message: `Your aftercare plan for ${treatmentRecord.service} is ready to view`,
          link_page: "PatientJourney",
        });
      }

      return plan;
    },
    onSuccess: () => {
      qc.invalidateQueries(["aftercare-plan"]);
      qc.invalidateQueries(["treatment-records"]);
      onClose();
    },
  });

  const addItem = (key, value = "") => {
    if (key.includes(".")) {
      const [parent, child] = key.split(".");
      setForm(f => ({ ...f, [parent]: { ...f[parent], [child]: [...f[parent][child], value] } }));
    } else {
      setForm(f => ({ ...f, [key]: [...f[key], value] }));
    }
  };

  const removeItem = (key, index) => {
    if (key.includes(".")) {
      const [parent, child] = key.split(".");
      setForm(f => ({ ...f, [parent]: { ...f[parent], [child]: f[parent][child].filter((_, i) => i !== index) } }));
    } else {
      setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== index) }));
    }
  };

  const updateItem = (key, index, value) => {
    if (key.includes(".")) {
      const [parent, child] = key.split(".");
      setForm(f => ({ ...f, [parent]: { ...f[parent], [child]: f[parent][child].map((item, i) => i === index ? value : item) } }));
    } else {
      setForm(f => ({ ...f, [key]: f[key].map((item, i) => i === index ? value : item) }));
    }
  };

  if (!treatmentRecord) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
            Aftercare Plan
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl px-4 py-3 space-y-1 mb-4" style={{ background: "#F0EDE8" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: "#243257" }}>{treatmentRecord.service}</span>
            <Badge className="text-xs border-0" style={{ background: "rgba(107,125,179,0.15)", color: "#6B7DB3" }}>
              {treatmentRecord.treatment_date}
            </Badge>
            {treatmentRecord.aftercare_plan_sent && (
              <Badge className="text-xs bg-green-100 text-green-700">Sent to Patient</Badge>
            )}
          </div>
          <p className="text-xs" style={{ color: "#9a8f7e" }}>Patient: {treatmentRecord.patient_name}</p>
        </div>

        <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-4" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#7B8EC8" }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>AI-Assisted Aftercare Plan</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(0,0,0,0.55)" }}>
              Review and customize the AI-generated recommendations below. This plan stays in <strong>draft mode</strong> until you manually send it to the patient.
            </p>
          </div>
        </div>

        {!existingPlan && (
          <Button onClick={handleAIGenerate} disabled={generating} className="w-full mb-4" style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)", color: "#fff" }}>
            <Sparkles className="w-4 h-4 mr-2" />
            {generating ? "Generating personalized plan..." : "AI-Generate Personalized Plan"}
          </Button>
        )}

        <Tabs defaultValue="instructions">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
            <TabsTrigger value="checkin">Check-Ins</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="treatments">Treatments</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="instructions" className="space-y-5 pt-4">
            {/* Immediate Care */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Immediate Care (24-48hrs)</Label>
                <button onClick={() => addItem("immediate_care", "")} className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {form.immediate_care.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={item} onChange={e => updateItem("immediate_care", i, e.target.value)} placeholder="e.g. Apply ice for 10 minutes every hour" />
                  <button onClick={() => removeItem("immediate_care", i)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Daily Routine */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Daily Routine (1-2 weeks)</Label>
                <button onClick={() => addItem("daily_routine", "")} className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {form.daily_routine.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={item} onChange={e => updateItem("daily_routine", i, e.target.value)} placeholder="e.g. Gentle cleansing twice daily" />
                  <button onClick={() => removeItem("daily_routine", i)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Dos and Don'ts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-widest text-green-600">Do</Label>
                  <button onClick={() => addItem("dos_and_donts.dos", "")} className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {form.dos_and_donts.dos.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={item} onChange={e => updateItem("dos_and_donts.dos", i, e.target.value)} placeholder="e.g. Sleep elevated" className="text-sm" />
                    <button onClick={() => removeItem("dos_and_donts.dos", i)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-widest text-red-600">Don't</Label>
                  <button onClick={() => addItem("dos_and_donts.donts", "")} className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {form.dos_and_donts.donts.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={item} onChange={e => updateItem("dos_and_donts.donts", i, e.target.value)} placeholder="e.g. No strenuous exercise" className="text-sm" />
                    <button onClick={() => removeItem("dos_and_donts.donts", i)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Red Flags */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1" style={{ color: "#DA6A63" }}>
                  <AlertTriangle className="w-3.5 h-3.5" /> Red Flags (Contact Immediately)
                </Label>
                <button onClick={() => addItem("red_flags", "")} className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {form.red_flags.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={item} onChange={e => updateItem("red_flags", i, e.target.value)} placeholder="e.g. Severe asymmetry or vision changes" />
                  <button onClick={() => removeItem("red_flags", i)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Provider Notes */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Custom Notes</Label>
              <Textarea
                value={form.provider_notes}
                onChange={e => setForm(f => ({ ...f, provider_notes: e.target.value }))}
                placeholder="Any personalized notes for this patient..."
                rows={3}
              />
            </div>
          </TabsContent>

          {/* ── CHECK-IN QUESTIONS TAB ── */}
          <TabsContent value="checkin" className="space-y-5 pt-4">
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)", color: "rgba(30,37,53,0.75)" }}>
              <strong>Treatment-specific questions</strong> — These questions appear in the patient's daily check-in form, tailored to this treatment. The AI will use the answers to give smarter recovery feedback.
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Recovery Window</Label>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1} max={90}
                value={form.checkin_recovery_days}
                onChange={e => setForm(f => ({ ...f, checkin_recovery_days: parseInt(e.target.value) || 14 }))}
                className="w-24"
              />
              <span className="text-sm" style={{ color: "rgba(0,0,0,0.55)" }}>days of check-ins recommended post-treatment</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Custom Questions</Label>
              <button
                onClick={() => {
                  const newQ = { id: Date.now().toString(), question: "", type: "scale", scale_low_label: "None", scale_high_label: "Severe", options: [], required: false };
                  setForm(f => ({ ...f, checkin_questions: [...f.checkin_questions, newQ] }));
                }}
                className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                <Plus className="w-3 h-3" /> Add Question
              </button>
            </div>

            {form.checkin_questions.length === 0 && (
              <div className="text-center py-6 rounded-xl" style={{ background: "rgba(0,0,0,0.03)", border: "1px dashed rgba(0,0,0,0.12)" }}>
                <MessageSquare className="w-6 h-6 mx-auto mb-2" style={{ color: "rgba(0,0,0,0.25)" }} />
                <p className="text-sm" style={{ color: "rgba(0,0,0,0.4)" }}>No custom questions yet</p>
                <p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.3)" }}>Add questions specific to this treatment (e.g. "Any numbness?" for filler, "Energy levels today?" for IV therapy)</p>
              </div>
            )}

            {form.checkin_questions.map((q, i) => (
              <div key={q.id || i} className="rounded-xl p-4 space-y-3" style={{ background: "#F0EDE8" }}>
                <div className="flex items-start justify-between gap-2">
                  <Input
                    value={q.question}
                    onChange={e => {
                      const updated = [...form.checkin_questions];
                      updated[i] = { ...q, question: e.target.value };
                      setForm(f => ({ ...f, checkin_questions: updated }));
                    }}
                    placeholder="e.g. Any numbness or tingling at the injection site?"
                    className="flex-1"
                  />
                  <button onClick={() => setForm(f => ({ ...f, checkin_questions: f.checkin_questions.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-600 flex-shrink-0 mt-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <Label className="text-xs mb-1 block" style={{ color: "rgba(0,0,0,0.5)" }}>Answer type</Label>
                    <select
                      value={q.type}
                      onChange={e => {
                        const updated = [...form.checkin_questions];
                        updated[i] = { ...q, type: e.target.value };
                        setForm(f => ({ ...f, checkin_questions: updated }));
                      }}
                      className="text-xs px-2 py-1.5 rounded-lg border"
                      style={{ borderColor: "rgba(0,0,0,0.15)", background: "#fff" }}
                    >
                      <option value="scale">Scale (0–5)</option>
                      <option value="boolean">Yes / No</option>
                      <option value="text">Free text</option>
                      <option value="multi_select">Multiple choice</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer mt-4">
                    <input type="checkbox" checked={q.required} onChange={e => {
                      const updated = [...form.checkin_questions];
                      updated[i] = { ...q, required: e.target.checked };
                      setForm(f => ({ ...f, checkin_questions: updated }));
                    }} />
                    <span className="text-xs" style={{ color: "rgba(0,0,0,0.55)" }}>Required</span>
                  </label>
                </div>

                {q.type === "scale" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={q.scale_low_label || ""} onChange={e => {
                      const updated = [...form.checkin_questions];
                      updated[i] = { ...q, scale_low_label: e.target.value };
                      setForm(f => ({ ...f, checkin_questions: updated }));
                    }} placeholder="Low label (e.g. None)" className="text-xs" />
                    <Input value={q.scale_high_label || ""} onChange={e => {
                      const updated = [...form.checkin_questions];
                      updated[i] = { ...q, scale_high_label: e.target.value };
                      setForm(f => ({ ...f, checkin_questions: updated }));
                    }} placeholder="High label (e.g. Severe)" className="text-xs" />
                  </div>
                )}

                {q.type === "multi_select" && (
                  <div className="space-y-2">
                    <Label className="text-xs" style={{ color: "rgba(0,0,0,0.5)" }}>Options (one per line)</Label>
                    <textarea
                      value={(q.options || []).join("\n")}
                      onChange={e => {
                        const updated = [...form.checkin_questions];
                        updated[i] = { ...q, options: e.target.value.split("\n").filter(Boolean) };
                        setForm(f => ({ ...f, checkin_questions: updated }));
                      }}
                      rows={3}
                      placeholder={"Option A\nOption B\nOption C"}
                      className="w-full text-xs rounded-lg px-3 py-2 resize-none border"
                      style={{ borderColor: "rgba(0,0,0,0.15)", background: "#fff" }}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* AI suggestion button */}
            <Button
              variant="outline"
              className="w-full gap-2 text-sm"
              onClick={async () => {
                setGenerating(true);
                try {
                  const res = await base44.integrations.Core.InvokeLLM({
                    prompt: `Generate 4-6 specific daily check-in questions for a patient who just received "${treatmentRecord.service}" aesthetic treatment. Questions should track treatment-specific recovery signals (NOT generic swelling/bruising which are already asked). Consider: symptoms unique to this treatment, functional concerns, energy/mood for wellness treatments, etc.`,
                    response_json_schema: {
                      type: "object",
                      properties: {
                        questions: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              question: { type: "string" },
                              type: { type: "string", enum: ["scale", "boolean", "text", "multi_select"] },
                              scale_low_label: { type: "string" },
                              scale_high_label: { type: "string" },
                              options: { type: "array", items: { type: "string" } }
                            }
                          }
                        }
                      }
                    }
                  });
                  const generated = (res.questions || []).map((q, idx) => ({ ...q, id: `ai_${Date.now()}_${idx}`, required: false, options: q.options || [] }));
                  setForm(f => ({ ...f, checkin_questions: [...f.checkin_questions, ...generated] }));
                } catch(e) { console.error(e); }
                finally { setGenerating(false); }
              }}
              disabled={generating}
            >
              <Sparkles className="w-4 h-4" style={{ color: "#7B8EC8" }} />
              {generating ? "Generating..." : `AI-suggest questions for "${treatmentRecord.service}"`}
            </Button>
          </TabsContent>

          <TabsContent value="products" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Recommended Products</Label>
              <button onClick={() => addItem("recommended_products", { product_name: "", product_type: "", reason: "", purchase_url: "", provider_carries: true })}
                className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                <Plus className="w-3 h-3" /> Add Product
              </button>
            </div>
            {form.recommended_products.map((prod, i) => (
              <div key={i} className="rounded-xl p-4 space-y-3" style={{ background: "#F0EDE8" }}>
                <div className="flex items-start justify-between">
                  <Package className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: "#7B8EC8" }} />
                  <button onClick={() => removeItem("recommended_products", i)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input value={prod.product_name} onChange={e => updateItem("recommended_products", i, { ...prod, product_name: e.target.value })}
                    placeholder="Product name" />
                  <Input value={prod.product_type} onChange={e => updateItem("recommended_products", i, { ...prod, product_type: e.target.value })}
                    placeholder="Type (cleanser, serum...)" />
                </div>
                <Textarea value={prod.reason} onChange={e => updateItem("recommended_products", i, { ...prod, reason: e.target.value })}
                  placeholder="Why this product?" rows={2} />
                <Input value={prod.purchase_url} onChange={e => updateItem("recommended_products", i, { ...prod, purchase_url: e.target.value })}
                  placeholder="Purchase URL (optional)" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={prod.provider_carries} onChange={e => updateItem("recommended_products", i, { ...prod, provider_carries: e.target.checked })} />
                  <span className="text-xs">I carry this product</span>
                </label>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="treatments" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Suggested Follow-Up Treatments</Label>
              <button onClick={() => addItem("suggested_treatments", { treatment_name: "", timing: "", reason: "", service_type_id: "" })}
                className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                <Plus className="w-3 h-3" /> Add Treatment
              </button>
            </div>
            {form.suggested_treatments.map((treat, i) => (
              <div key={i} className="rounded-xl p-4 space-y-3" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.2)" }}>
                <div className="flex items-start justify-between">
                  <Calendar className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: "#5a7a20" }} />
                  <button onClick={() => removeItem("suggested_treatments", i)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input value={treat.treatment_name} onChange={e => updateItem("suggested_treatments", i, { ...treat, treatment_name: e.target.value })}
                    placeholder="Treatment name" />
                  <Input value={treat.timing} onChange={e => updateItem("suggested_treatments", i, { ...treat, timing: e.target.value })}
                    placeholder="Timing (e.g. 4-6 weeks)" />
                </div>
                <Textarea value={treat.reason} onChange={e => updateItem("suggested_treatments", i, { ...treat, reason: e.target.value })}
                  placeholder="Why this treatment complements what they just received?" rows={2} />
              </div>
            ))}
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(123,142,200,0.08)", color: "rgba(30,37,53,0.75)" }}>
              💡 These treatments will be shown in patient's daily check-ins as personalized recommendations from you
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Expected Recovery Timeline</Label>
              <button onClick={() => addItem("expected_timeline", { days: "", what_to_expect: "" })}
                className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                <Plus className="w-3 h-3" /> Add Stage
              </button>
            </div>
            {form.expected_timeline.map((stage, i) => (
              <div key={i} className="flex gap-3 items-start">
                <Input value={stage.days} onChange={e => updateItem("expected_timeline", i, { ...stage, days: e.target.value })}
                  placeholder="Days (e.g. 1-3)" className="w-24" />
                <Input value={stage.what_to_expect} onChange={e => updateItem("expected_timeline", i, { ...stage, what_to_expect: e.target.value })}
                  placeholder="What to expect..." className="flex-1" />
                <button onClick={() => removeItem("expected_timeline", i)} className="text-red-400 hover:text-red-600 mt-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="space-y-2 pt-3">
              <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Follow-Up Appointment Date</Label>
              <Input type="date" value={form.follow_up_date} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 justify-end pt-4" style={{ borderTop: "1px solid rgba(198,190,168,0.3)" }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => savePlan.mutate(false)} disabled={savePlan.isPending}>
            Save Draft
          </Button>
          <Button style={{ background: "#FA6F30", color: "#fff" }} onClick={() => savePlan.mutate(true)} disabled={savePlan.isPending}>
            <Send className="w-4 h-4 mr-2" />
            Send to Patient
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}