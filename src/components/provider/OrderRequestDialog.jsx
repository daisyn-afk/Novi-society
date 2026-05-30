import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Send, CheckCircle, Package } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { resolveRepDisplay } from "@/components/provider/SaveRepContactForm";

export default function OrderRequestDialog({ open, onClose, manufacturer, me, savedRep = null }) {
  const qc = useQueryClient();
  const [items, setItems] = useState([{ product_name: "", quantity: "", unit: "units", notes: "" }]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const mfrProducts = manufacturer?.products || [];
  const rep = resolveRepDisplay(savedRep, manufacturer);
  const hasRepEmail = !!rep.rep_email;

  const addItem = () => setItems(prev => [...prev, { product_name: "", quantity: "", unit: "units", notes: "" }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSend = async () => {
    const validItems = items
      .map((i) => ({
        ...i,
        product_name: i.product_name === "__other__" ? (i._customName || "").trim() : i.product_name,
      }))
      .filter((i) => i.product_name && i.quantity);
    if (!validItems.length) return;
    setSending(true);
    try {
      await base44.functions.invoke("sendRepContactEmail", {
        manufacturer_id: manufacturer.id,
        type: "order",
        subject: `Order Request — NOVI Provider ${me?.full_name || ""}`,
        message: message || "",
        order_items: validItems.map((i) => ({ ...i, quantity: parseFloat(i.quantity) || 0 })),
      });
      qc.invalidateQueries({ queryKey: ["my-order-requests"] });
      qc.invalidateQueries({ queryKey: ["my-inventory"] });
      qc.invalidateQueries({ queryKey: ["all-provider-inventory"] });
      qc.invalidateQueries({ queryKey: ["manufacturer-order-inventory"] });
      setSent(true);
    } catch (err) {
      window.alert(err?.message || "Could not send order request. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setItems([{ product_name: "", quantity: "", unit: "units", notes: "" }]);
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}>
            Order Request — {manufacturer?.name}
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(200,230,60,0.2)" }}>
              <CheckCircle className="w-7 h-7" style={{ color: "#4a6b10" }} />
            </div>
            <p className="font-bold text-lg" style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}>Order Request Sent!</p>
            <p className="text-sm mt-1 mb-2" style={{ color: "rgba(30,37,53,0.55)" }}>
              Sent to {rep.rep_email}. A copy was sent to your email.
            </p>
            <p className="text-xs mb-5" style={{ color: "rgba(30,37,53,0.4)" }}>
              Your order details and basic contact info were included — no license or MD coverage attachments.
            </p>
            <Button onClick={handleClose} style={{ background: "#1e2535", color: "#fff" }}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Rep info */}
            {hasRepEmail && (
              <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(250,111,48,0.06)", border: "1px solid rgba(250,111,48,0.2)", color: "rgba(30,37,53,0.6)" }}>
                Sending to: <strong style={{ color: "#FA6F30" }}>{rep.rep_name}</strong> · {rep.rep_email}
              </div>
            )}

            <div className="px-3 py-2.5 rounded-xl text-xs flex items-start gap-2" style={{ background: "rgba(200,230,60,0.07)", border: "1px solid rgba(200,230,60,0.2)" }}>
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#5a7a20" }} />
              <p style={{ color: "rgba(30,37,53,0.65)" }}>Your name, email, phone, practice, and order lines will be sent — credentials were shared when you activated access.</p>
            </div>

            {/* Order items */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "rgba(30,37,53,0.45)" }}>Products to Order</label>
              <div className="space-y-3">
                {items.map((item, i) => {
                  const displayName = item.product_name === "__other__" ? (item._customName || "").trim() : item.product_name;
                  const hasQty = item.quantity && parseFloat(item.quantity) > 0;
                  return (
                    <div key={i} className="rounded-xl overflow-hidden" style={{ background: "rgba(30,37,53,0.03)", border: "1px solid rgba(30,37,53,0.08)" }}>
                      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(123,142,200,0.12)" }}>
                            <Package className="w-3.5 h-3.5" style={{ color: "#7B8EC8" }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(30,37,53,0.4)" }}>Line {i + 1}</p>
                            {displayName && (
                              <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>{displayName}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {hasQty && displayName && (
                            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10" }}>
                              {item.quantity} {item.unit}
                            </span>
                          )}
                          {items.length > 1 && (
                            <button onClick={() => removeItem(i)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" aria-label="Remove item">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-3 space-y-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: "rgba(30,37,53,0.4)" }}>Product</label>
                          {mfrProducts.length > 0 ? (
                            <select
                              value={item.product_name}
                              onChange={e => updateItem(i, "product_name", e.target.value)}
                              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                              style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}>
                              <option value="">Select product...</option>
                              {mfrProducts.map(p => <option key={p} value={p}>{p}</option>)}
                              <option value="__other__">Other (type below)</option>
                            </select>
                          ) : (
                            <Input value={item.product_name} onChange={e => updateItem(i, "product_name", e.target.value)} placeholder="Product name" />
                          )}
                          {item.product_name === "__other__" && (
                            <Input className="mt-1.5" value={item._customName || ""} onChange={e => updateItem(i, "_customName", e.target.value)} placeholder="Enter product name" />
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: "rgba(30,37,53,0.4)" }}>Quantity</label>
                            <Input value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} placeholder="0" type="number" min="0" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: "rgba(30,37,53,0.4)" }}>Unit</label>
                            <select value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)}
                              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                              style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}>
                              {["units", "mL", "syringes", "vials", "boxes"].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: "rgba(30,37,53,0.4)" }}>Notes <span className="font-normal normal-case">(optional)</span></label>
                          <Input value={item.notes} onChange={e => updateItem(i, "notes", e.target.value)} placeholder="Lot preference, urgency, etc." className="text-sm" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={addItem} className="mt-3 flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity" style={{ color: "#FA6F30" }}>
                <Plus className="w-3.5 h-3.5" /> Add another product
              </button>
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Additional Note to Rep (optional)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                placeholder="e.g. preferred ship date, account number, special instructions..."
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535", lineHeight: 1.6 }} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1 gap-2 font-bold" disabled={sending || !items.some(i => i.product_name && i.quantity) || !hasRepEmail}
                style={{ background: "linear-gradient(135deg, #FA6F30, #e05a20)", color: "#fff" }}
                onClick={handleSend}>
                <Send className="w-3.5 h-3.5" />
                {sending ? "Sending..." : !hasRepEmail ? "No rep email on file" : "Send Order Request"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}