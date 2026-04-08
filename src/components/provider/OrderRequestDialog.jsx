import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Send, CheckCircle, Package } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function OrderRequestDialog({ open, onClose, manufacturer, me }) {
  const qc = useQueryClient();
  const [items, setItems] = useState([{ product_name: "", quantity: "", unit: "units", notes: "" }]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const mfrProducts = manufacturer?.products || [];

  const addItem = () => setItems(prev => [...prev, { product_name: "", quantity: "", unit: "units", notes: "" }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSend = async () => {
    const validItems = items.filter(i => i.product_name && i.quantity);
    if (!validItems.length) return;
    setSending(true);
    await base44.functions.invoke("sendRepContactEmail", {
      manufacturer_id: manufacturer.id,
      type: "order",
      subject: `Order Request — NOVI Provider ${me?.full_name || ""}`,
      message: message || "Please see the order details below.",
      order_items: validItems.map(i => ({ ...i, quantity: parseFloat(i.quantity) || 0 })),
    });
    qc.invalidateQueries({ queryKey: ["my-order-requests"] });
    setSending(false);
    setSent(true);
  };

  const handleClose = () => {
    setSent(false);
    setItems([{ product_name: "", quantity: "", unit: "units", notes: "" }]);
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              Sent to {manufacturer?.account_rep_email}. A copy was sent to your email.
            </p>
            <p className="text-xs mb-5" style={{ color: "rgba(30,37,53,0.4)" }}>
              Your order was logged in NOVI and includes your usage stats, certs, and license info.
            </p>
            <Button onClick={handleClose} style={{ background: "#1e2535", color: "#fff" }}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Rep info */}
            {manufacturer?.account_rep_email && (
              <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(250,111,48,0.06)", border: "1px solid rgba(250,111,48,0.2)", color: "rgba(30,37,53,0.6)" }}>
                Sending to: <strong style={{ color: "#FA6F30" }}>{manufacturer.account_rep_name || "Account Rep"}</strong> · {manufacturer.account_rep_email}
              </div>
            )}

            {/* NOVI auto-data notice */}
            <div className="px-3 py-2.5 rounded-xl text-xs flex items-start gap-2" style={{ background: "rgba(200,230,60,0.07)", border: "1px solid rgba(200,230,60,0.2)" }}>
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#5a7a20" }} />
              <p style={{ color: "rgba(30,37,53,0.65)" }}>Your license, certifications, MD oversight, and usage stats for this supplier will be automatically included in the email.</p>
            </div>

            {/* Order items */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "rgba(30,37,53,0.45)" }}>Products to Order</label>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: "rgba(30,37,53,0.03)", border: "1px solid rgba(30,37,53,0.08)" }}>
                    <div className="flex gap-2">
                      <div className="flex-1">
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
                          <Input className="mt-1.5" value={item._customName || ""} onChange={e => { updateItem(i, "_customName", e.target.value); updateItem(i, "product_name", e.target.value); }} placeholder="Enter product name" />
                        )}
                      </div>
                      <Input value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} placeholder="Qty" type="number" className="w-20" />
                      <select value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)}
                        className="px-2 py-2 rounded-lg text-xs outline-none w-20 flex-shrink-0"
                        style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}>
                        {["units", "mL", "syringes", "vials", "boxes"].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      {items.length > 1 && (
                        <button onClick={() => removeItem(i)} className="p-2 rounded-lg hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                    <Input value={item.notes} onChange={e => updateItem(i, "notes", e.target.value)} placeholder="Notes (optional)" className="text-xs" />
                  </div>
                ))}
              </div>
              <button onClick={addItem} className="mt-2 flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity" style={{ color: "#FA6F30" }}>
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
              <Button className="flex-1 gap-2 font-bold" disabled={sending || !items.some(i => i.product_name && i.quantity)}
                style={{ background: "linear-gradient(135deg, #FA6F30, #e05a20)", color: "#fff" }}
                onClick={handleSend}>
                <Send className="w-3.5 h-3.5" />
                {sending ? "Sending..." : !manufacturer?.account_rep_email ? "No rep email on file" : "Send Order Request"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}