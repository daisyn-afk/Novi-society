import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Sparkles, Calendar, User, MapPin, Clock, Award, FileText, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Mode A: Pre-order ID provided (approval flow) ───────────────────────────
function ApprovedPaymentCheckout({ preOrderId }) {
  const navigate = useNavigate();

  const { data: preOrder, isLoading } = useQuery({
    queryKey: ["pre-order", preOrderId],
    queryFn: () => base44.entities.PreOrder.get(preOrderId),
  });

  const checkout = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke("createPreOrderCheckout", {
        pre_order_id: preOrderId,
      });
      if (res.data?.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        throw new Error("Failed to create checkout session");
      }
    },
  });

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: "rgba(45,107,127,0.2)", borderTopColor: "#2D6B7F" }} />
    </div>
  );

  if (!preOrder) return (
    <div className="bg-white rounded-3xl p-12 text-center" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
      <p className="text-lg" style={{ color: "rgba(30,37,53,0.5)" }}>Reservation not found</p>
    </div>
  );

  if (preOrder.status === "paid" || preOrder.status === "confirmed" || preOrder.status === "completed") {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-3xl p-12 text-center" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6" style={{ background: "rgba(200,230,60,0.15)" }}>
          <Sparkles className="w-8 h-8" style={{ color: "#5a7a20" }} />
        </div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.75rem", color: "#1e2535", fontStyle: "italic", marginBottom: 12 }}>
          Already Paid!
        </h2>
        <p className="text-base mb-6" style={{ color: "rgba(30,37,53,0.6)" }}>
          Your enrollment for <strong>{preOrder.course_title || preOrder.service_name}</strong> is confirmed.
        </p>
        <button onClick={() => navigate(createPageUrl("NoviLanding"))} className="px-8 py-3 rounded-full font-bold text-sm" style={{ background: "#C8E63C", color: "#1a2540" }}>
          Back to Home
        </button>
      </div>
    );
  }

  const itemName = preOrder.course_title || preOrder.service_name || "NOVI Society Reservation";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl p-8 lg:p-10" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#DA6A63" }}>
            {preOrder.order_type === "course" ? "Course Enrollment" : "Service Enrollment"}
          </p>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.9rem", color: "#1e2535", fontStyle: "italic", marginBottom: 8 }}>
            {itemName}
          </h2>
          <div className="flex flex-wrap gap-4 text-sm" style={{ color: "rgba(30,37,53,0.55)" }}>
            {preOrder.course_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(preOrder.course_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </span>
            )}
            {preOrder.amount_paid > 0 && (
              <span className="font-bold text-base" style={{ color: "#2D6B7F" }}>
                ${Number(preOrder.amount_paid).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Applicant summary */}
        <div className="p-5 rounded-2xl mb-8" style={{ background: "#f9f8f6", border: "1px solid rgba(0,0,0,0.07)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Your Reservation Details</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><span style={{ color: "rgba(30,37,53,0.5)" }}>Name:</span> <strong style={{ color: "#1e2535" }}>{preOrder.customer_name}</strong></div>
            <div><span style={{ color: "rgba(30,37,53,0.5)" }}>Email:</span> <strong style={{ color: "#1e2535" }}>{preOrder.customer_email}</strong></div>
            <div><span style={{ color: "rgba(30,37,53,0.5)" }}>License:</span> <strong style={{ color: "#1e2535" }}>{preOrder.license_type} {preOrder.license_number}</strong></div>
            {preOrder.license_state && <div><span style={{ color: "rgba(30,37,53,0.5)" }}>State:</span> <strong style={{ color: "#1e2535" }}>{preOrder.license_state}</strong></div>}
          </div>
        </div>

        {/* Approval badge */}
        <div className="flex items-center gap-3 p-4 rounded-xl mb-8" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.2)" }}>
            <Shield className="w-4 h-4" style={{ color: "#5a7a20" }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#3d5a0a" }}>License Verified & Approved</p>
            <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>Your application has been reviewed by the NOVI Society team</p>
          </div>
        </div>

        {checkout.error && (
          <div className="mb-6 px-5 py-4 rounded-2xl" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.25)" }}>
            <p className="text-sm font-semibold" style={{ color: "#DA6A63" }}>{checkout.error.message}</p>
          </div>
        )}

        <button
          onClick={() => checkout.mutate()}
          disabled={checkout.isPending}
          className="w-full py-6 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, #C8E63C, #a8c020)",
            color: "#1a2540",
            boxShadow: "0 8px 32px rgba(200,230,60,0.25)",
          }}
        >
          {checkout.isPending ? (
            <>
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Redirecting to Payment...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Complete Enrollment — ${Number(preOrder.amount_paid || 0).toLocaleString()}
            </>
          )}
        </button>
        <p className="text-center text-xs mt-3" style={{ color: "rgba(30,37,53,0.4)" }}>
          Secure checkout · Powered by Stripe
        </p>
      </div>
    </div>
  );
}

// ─── Mode B: Direct checkout (service pre-order from landing) ─────────────────
function DirectServiceCheckout({ itemId }) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    customer_name: "", customer_email: "", phone: "", notes: "",
    license_type: "RN", license_number: "", license_state: "",
  });

  const { data: service, isLoading } = useQuery({
    queryKey: ["service", itemId],
    queryFn: () => base44.entities.ServiceType.get(itemId),
    enabled: !!itemId,
  });

  const createPreOrder = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke("createPreOrderCheckout", {
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        phone: form.phone || null,
        order_type: "service",
        notes: form.notes || null,
        service_type_id: itemId,
        license_type: form.license_type,
        license_number: form.license_number,
        license_state: form.license_state || null,
      });
      if (res.data?.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        throw new Error("Failed to create checkout session");
      }
    },
  });

  const item = service;
  const canSubmit = form.customer_name && form.customer_email && form.license_number && !createPreOrder.isPending;

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: "rgba(45,107,127,0.2)", borderTopColor: "#2D6B7F" }} />
    </div>
  );

  return (
    <div className="grid lg:grid-cols-5 gap-8">
      {/* Left summary */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-3xl p-8 lg:sticky lg:top-8" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#DA6A63" }}>Service Reservation</p>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "#1e2535", fontStyle: "italic", marginBottom: 16 }}>{item?.name}</h2>
          {item?.description && <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(30,37,53,0.7)" }}>{item.description}</p>}
          {item?.monthly_fee && (
            <div className="pt-5 border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "rgba(30,37,53,0.5)" }}>Monthly Fee</p>
              <span className="text-4xl font-black" style={{ color: "#2D6B7F" }}>${Number(item.monthly_fee).toLocaleString()}</span>
              <span className="text-lg ml-1" style={{ color: "rgba(30,37,53,0.5)" }}>/month</span>
            </div>
          )}
        </div>
      </div>

      {/* Right form */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-3xl p-8 lg:p-10" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "#1e2535", fontStyle: "italic", marginBottom: 6 }}>Your Information</h3>
          <p className="text-sm mb-8" style={{ color: "rgba(30,37,53,0.6)" }}>Complete your service reservation</p>

          <div className="space-y-5">
            <div>
              <Label className="text-sm font-semibold mb-2 block" style={{ color: "#1e2535" }}>Full Name *</Label>
              <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Jane Smith" className="h-12 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold mb-2 block" style={{ color: "#1e2535" }}>Email *</Label>
                <Input type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} placeholder="jane@example.com" className="h-12 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block" style={{ color: "#1e2535" }}>Phone</Label>
                <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 123-4567" className="h-12 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
              </div>
            </div>

            <div className="pt-5 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <h4 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: "#2D6B7F" }}>
                <Shield className="w-4 h-4" /> Professional License *
              </h4>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block" style={{ color: "#1e2535" }}>License Type *</Label>
                  <Select value={form.license_type} onValueChange={v => setForm(f => ({ ...f, license_type: v }))}>
                    <SelectTrigger className="h-12 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RN">RN - Registered Nurse</SelectItem>
                      <SelectItem value="NP">NP - Nurse Practitioner</SelectItem>
                      <SelectItem value="PA">PA - Physician Assistant</SelectItem>
                      <SelectItem value="MD">MD - Medical Doctor</SelectItem>
                      <SelectItem value="DO">DO - Doctor of Osteopathy</SelectItem>
                      <SelectItem value="esthetician">Licensed Esthetician</SelectItem>
                      <SelectItem value="other">Other Healthcare Professional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block" style={{ color: "#1e2535" }}>License Number *</Label>
                  <Input value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} placeholder="e.g. RN-123456" className="h-12 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block" style={{ color: "#1e2535" }}>Issuing State</Label>
                <Input value={form.license_state} onChange={e => setForm(f => ({ ...f, license_state: e.target.value }))} placeholder="e.g. TX" maxLength={2} className="h-12 rounded-xl uppercase w-28" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block" style={{ color: "#1e2535" }}>Questions or Special Requests</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="rounded-xl resize-none" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
            </div>
          </div>

          {createPreOrder.error && (
            <div className="mt-5 px-5 py-4 rounded-2xl" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.25)" }}>
              <p className="text-sm font-semibold" style={{ color: "#DA6A63" }}>{createPreOrder.error.message}</p>
            </div>
          )}

          <button
            disabled={!canSubmit}
            onClick={() => createPreOrder.mutate()}
            className="w-full mt-8 py-6 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: canSubmit ? "linear-gradient(135deg, #C8E63C, #a8c020)" : "rgba(0,0,0,0.08)", color: canSubmit ? "#1a2540" : "rgba(30,37,53,0.3)", boxShadow: canSubmit ? "0 8px 32px rgba(200,230,60,0.25)" : "none" }}
          >
            {createPreOrder.isPending ? (
              <><div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />Redirecting...</>
            ) : (
              <><Sparkles className="w-5 h-5" />Proceed to Secure Payment</>
            )}
          </button>
          <p className="text-center text-xs mt-3" style={{ color: "rgba(30,37,53,0.4)" }}>Powered by Stripe · License verified on enrollment</p>
        </div>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function PreOrderCheckout() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const preOrderId = params.get("pre_order_id");
  const serviceId = params.get("id");

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: "#f5f3ef" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate(createPageUrl("NoviLanding"))}
          className="flex items-center gap-2 mb-8 px-4 py-2 rounded-xl transition-all hover:translate-x-[-4px]"
          style={{ color: "rgba(30,37,53,0.6)" }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Home</span>
        </button>

        {preOrderId
          ? <ApprovedPaymentCheckout preOrderId={preOrderId} />
          : <DirectServiceCheckout itemId={serviceId} />
        }
      </div>
    </div>
  );
}