import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, TicketPercent } from "lucide-react";
import { promoCodesApi } from "@/api/promoCodesApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EMPTY_FORM = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  max_uses: "",
  valid_from: "",
  valid_until: "",
  is_active: true
};

function uiDiscountType(value) {
  return value === "percent" ? "percentage" : value;
}

function dbDiscountType(value) {
  return value === "percentage" ? "percent" : value;
}

function toDatetimeInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminPromoCodes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: promoCodes = [], isLoading } = useQuery({
    queryKey: ["admin-promo-codes"],
    queryFn: promoCodesApi.list
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing?.id) return promoCodesApi.update(editing.id, payload);
      return promoCodesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: promoCodesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-promo-codes"] })
  });

  const activeCount = useMemo(() => promoCodes.filter((p) => p.is_active).length, [promoCodes]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (promo) => {
    setEditing(promo);
    setForm({
      code: promo.code || "",
      description: promo.description || "",
      discount_type: uiDiscountType(promo.discount_type) || "percentage",
      discount_value: promo.discount_value ?? "",
      max_uses: promo.max_uses ?? "",
      valid_from: toDatetimeInputValue(promo.valid_from),
      valid_until: toDatetimeInputValue(promo.valid_until),
      is_active: promo.is_active !== false
    });
    setOpen(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      code: form.code.trim().toUpperCase(),
      discount_type: dbDiscountType(form.discount_type),
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Promo Codes</h2>
          <p className="text-slate-500 text-sm mt-1">Create and manage discount codes for course checkout.</p>
        </div>
        <Button onClick={openCreate} style={{ background: "#C8E63C", color: "#1a2540" }}>
          <Plus className="w-4 h-4 mr-1" /> New Promo Code
        </Button>
      </div>

      <div className="text-sm text-slate-600">
        Total: <strong>{promoCodes.length}</strong> · Active: <strong>{activeCount}</strong>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : promoCodes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TicketPercent className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No promo codes yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promoCodes.map((promo) => (
            <Card key={promo.id}>
              <CardContent className="py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{promo.code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${promo.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {promo.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {uiDiscountType(promo.discount_type) === "percentage" ? `${promo.discount_value}% off` : `$${promo.discount_value} off`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Used: {promo.times_used || 0}{promo.max_uses ? ` / ${promo.max_uses}` : ""} · Valid: {promo.valid_from ? new Date(promo.valid_from).toLocaleString() : "Any time"} - {promo.valid_until ? new Date(promo.valid_until).toLocaleString() : "No expiry"}
                  </p>
                  {promo.description && <p className="text-sm text-slate-600 mt-1">{promo.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(promo)}>
                    <Pencil className="w-4 h-4 text-slate-500" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(promo.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.code}` : "Create Promo Code"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Code *</label>
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="NOVI20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Type *</label>
                <Select value={form.discount_type} onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Discount value *</label>
                <Input type="number" value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} placeholder={form.discount_type === "percentage" ? "20" : "50"} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Max uses</label>
                <Input type="number" value={form.max_uses} onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))} placeholder="Optional" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Internal note" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Valid from</label>
                <Input type="datetime-local" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Valid until</label>
                <Input type="datetime-local" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Active
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending || !form.code || !form.discount_value} style={{ background: "#C8E63C", color: "#1a2540" }}>
                {saveMutation.isPending ? "Saving..." : editing ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
