import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Package, Building2 } from "lucide-react";

const CATEGORY_COLORS = {
  injectables: { bg: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "rgba(250,111,48,0.2)" },
  fillers: { bg: "rgba(123,142,200,0.1)", color: "#7B8EC8", border: "rgba(123,142,200,0.2)" },
  devices: { bg: "rgba(45,107,127,0.1)", color: "#2D6B7F", border: "rgba(45,107,127,0.2)" },
  skincare: { bg: "rgba(200,230,60,0.12)", color: "#5a7a20", border: "rgba(200,230,60,0.25)" },
  consumables: { bg: "rgba(218,106,99,0.1)", color: "#DA6A63", border: "rgba(218,106,99,0.2)" },
  laser: { bg: "rgba(30,200,200,0.1)", color: "#1CA8A8", border: "rgba(30,200,200,0.2)" },
  other: { bg: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.55)", border: "rgba(30,37,53,0.1)" },
};

const EMPTY_ITEM = {
  product_name: "",
  manufacturer_id: "",
  manufacturer_name: "",
  batch_lot: "",
  quantity: "",
  unit: "units",
  expiration_date: "",
  purchase_date: "",
  notes: "",
};

function isValidMediaUrl(url) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function SupplierLogo({ mfr, size = 40 }) {
  const logo = isValidMediaUrl(mfr?.logo_url) ? String(mfr.logo_url).trim() : null;
  const col = CATEGORY_COLORS[mfr?.category] || CATEGORY_COLORS.other;
  const initial = mfr?.name?.trim()?.[0]?.toUpperCase() || "S";

  return (
    <div
      className="flex items-center justify-center flex-shrink-0 overflow-hidden rounded-xl"
      style={{
        width: size,
        height: size,
        background: logo ? "#fff" : col.bg,
        border: `1px solid ${col.border}`,
      }}
    >
      {logo ? (
        <img src={logo} alt="" className="w-full h-full object-contain p-1" />
      ) : (
        <span className="font-bold select-none" style={{ color: col.color, fontSize: size * 0.4 }}>
          {initial}
        </span>
      )}
    </div>
  );
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

/** Only show order/inventory lines tied to this supplier (by manufacturer_id). */
function inventoryForManufacturer(inventory, manufacturerId, manufacturerLabel) {
  if (manufacturerId) {
    return inventory.filter(
      (item) => String(item.manufacturer_id || "") === String(manufacturerId)
    );
  }
  const key = normalizeName(manufacturerLabel);
  if (!key) return [];
  return inventory.filter((item) => normalizeName(item.manufacturer_name) === key);
}

function trackedLabel(count) {
  if (count === 0) return "0 items tracked";
  if (count === 1) return "1 item tracked";
  return `${count} items tracked`;
}

function ManufacturerInventoryCard({ app, mfr, items, onAdd }) {
  const mfrLabel = app.manufacturer_name || mfr?.name || "";

  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: 16,
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(30,37,53,0.08)",
        boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
      }}
    >
      <div className="flex items-center gap-3 p-4">
        {mfr ? (
          <SupplierLogo mfr={mfr} size={40} />
        ) : (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(30,37,53,0.06)", border: "1px solid rgba(30,37,53,0.1)" }}
          >
            <Building2 className="w-5 h-5" style={{ color: "rgba(30,37,53,0.4)" }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className="font-bold truncate"
            style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#1e2535" }}
          >
            {mfrLabel}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
            {trackedLabel(items.length)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(mfr, app)}
          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 transition-opacity hover:opacity-85"
          style={{
            background: "rgba(200,230,60,0.2)",
            color: "#4a6b10",
            border: "1px solid rgba(200,230,60,0.45)",
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {items.length === 0 ? (
        <div
          className="mx-4 mb-4 px-4 py-8 text-center rounded-xl"
          style={{ background: "rgba(30,37,53,0.03)", border: "1px dashed rgba(30,37,53,0.1)" }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.45)" }}>
            No inventory logged yet — orders placed through NOVI will auto-populate here.
          </p>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-3 py-3 rounded-xl"
              style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.06)" }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(123,142,200,0.12)" }}
              >
                <Package className="w-4 h-4" style={{ color: "#7B8EC8" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>
                    {item.product_name}
                  </p>
                  {item.batch_lot && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: "rgba(123,142,200,0.12)",
                        color: "#5a6a9a",
                        border: "1px solid rgba(123,142,200,0.22)",
                      }}
                    >
                      LOT: {item.batch_lot}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold leading-none" style={{ color: "#1e2535" }}>
                  {item.quantity}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                  {item.unit || "units"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InventoryItemDialog({ open, onOpenChange, form, setForm, onSave, isPending, saveError }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}>
            Add Product — {form.manufacturer_name || "Supplier"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
              Product Name <span style={{ color: "#DA6A63" }}>*</span>
            </label>
            <Input
              value={form.product_name}
              onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
              placeholder="e.g. Botox, Juvederm Ultra"
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
                Supplier
              </label>
              <Input
                value={form.manufacturer_name}
                readOnly
                className="h-10"
                style={{ background: "rgba(30,37,53,0.04)" }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
                Batch / Lot #
              </label>
              <Input
                value={form.batch_lot}
                onChange={(e) => setForm((f) => ({ ...f, batch_lot: e.target.value }))}
                placeholder="LOT123456"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
                Quantity <span style={{ color: "#DA6A63" }}>*</span>
              </label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
                Unit
              </label>
              <Input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="units"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
                Purchase Date
              </label>
              <Input
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
                Expiration Date
              </label>
              <Input
                type="date"
                value={form.expiration_date}
                onChange={(e) => setForm((f) => ({ ...f, expiration_date: e.target.value }))}
                className="h-10"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
              Notes
            </label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes"
              className="h-10"
            />
          </div>
          {saveError && (
            <p className="text-xs text-red-600">{saveError}</p>
          )}
          <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>
            Saved under this supplier only. Appears after the order is recorded for {form.manufacturer_name || "this account"}.
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={!form.product_name || !form.quantity || !form.manufacturer_id || isPending}
              style={{ background: "#1e2535", color: "#fff" }}
            >
              {isPending ? "Saving..." : "Add to Inventory"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProviderInventoryTab({
  me,
  myApplications = [],
  manufacturers = [],
}) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [saveError, setSaveError] = useState("");

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["my-inventory"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.ProviderInventory.filter({ provider_id: u.id }, "-created_date");
    },
    enabled: !!me,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const manufacturerId = String(data.manufacturer_id || "").trim();
      if (!manufacturerId) {
        throw new Error("Supplier account is required.");
      }
      const lotNote = data.batch_lot ? `Lot: ${data.batch_lot}` : "";
      const notes = [data.notes, lotNote].filter(Boolean).join(" · ");

      return base44.functions.invoke("sendRepContactEmail", {
        manufacturer_id: manufacturerId,
        type: "order",
        subject: `Inventory — ${data.product_name}`,
        message: notes || `Inventory entry for ${data.manufacturer_name}`,
        order_items: [
          {
            product_name: data.product_name,
            quantity: parseFloat(data.quantity) || 0,
            unit: data.unit || "units",
            notes,
          },
        ],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-inventory"] });
      qc.invalidateQueries({ queryKey: ["my-order-requests"] });
      setSaveError("");
      setDialogOpen(false);
      setForm(EMPTY_ITEM);
    },
    onError: (err) => {
      setSaveError(err?.message || "Could not save inventory for this supplier.");
    },
  });

  const openNew = (mfr, app) => {
    setSaveError("");
    setForm({
      ...EMPTY_ITEM,
      manufacturer_id: mfr?.id || app?.manufacturer_id || "",
      manufacturer_name: app?.manufacturer_name || mfr?.name || "",
    });
    setDialogOpen(true);
  };

  const approvedApps = myApplications
    .filter((a) => !a.status || a.status === "approved")
    .sort((a, b) => (a.manufacturer_name || "").localeCompare(b.manufacturer_name || ""));

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl animate-pulse"
            style={{ background: "rgba(255,255,255,0.5)" }}
          />
        ))}
      </div>
    );
  }

  if (approvedApps.length === 0) {
    return (
      <div
        className="py-14 text-center rounded-2xl"
        style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.08)" }}
      >
        <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
        <p className="font-semibold" style={{ color: "#1e2535" }}>No active accounts</p>
        <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
          Activate a supplier account to track inventory by manufacturer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {approvedApps.map((app) => {
        const mfr = manufacturers.find((m) => m.id === app.manufacturer_id);
        const label = app.manufacturer_name || mfr?.name || "";
        const items = inventoryForManufacturer(inventory, app.manufacturer_id, label);

        return (
          <ManufacturerInventoryCard
            key={app.id}
            app={app}
            mfr={mfr}
            items={items}
            onAdd={openNew}
          />
        );
      })}

      <InventoryItemDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSaveError("");
        }}
        form={form}
        setForm={setForm}
        onSave={() => saveMutation.mutate(form)}
        isPending={saveMutation.isPending}
        saveError={saveError}
      />
    </div>
  );
}
