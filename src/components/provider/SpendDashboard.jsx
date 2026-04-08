import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { TrendingUp, DollarSign, Package, AlertTriangle, ShieldCheck, CheckCircle, ShoppingCart, Truck } from "lucide-react";

const ORDER_STATUS_CONFIG = {
  sent: { label: "Sent", color: "#7B8EC8", bg: "rgba(123,142,200,0.12)" },
  confirmed: { label: "Confirmed", color: "#FA6F30", bg: "rgba(250,111,48,0.12)" },
  processing: { label: "Processing", color: "#D4900A", bg: "rgba(255,180,50,0.12)" },
  shipped: { label: "Shipped", color: "#2D6B7F", bg: "rgba(45,107,127,0.12)" },
  delivered: { label: "Delivered", color: "#4a6b10", bg: "rgba(200,230,60,0.18)" },
  cancelled: { label: "Cancelled", color: "#DA6A63", bg: "rgba(218,106,99,0.12)" },
};

function SectionCard({ title, icon: Icon, iconColor = "#7B8EC8", badge, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(30,37,53,0.08)", boxShadow: "0 1px 8px rgba(30,37,53,0.04)" }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
          <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{title}</p>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

export default function SpendDashboard({ manufacturers = [] }) {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: orderRequests = [], isLoading } = useQuery({
    queryKey: ["my-order-requests"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.OrderRequest.filter({ provider_id: u.id }, "-sent_at");
    },
    enabled: !!me,
  });

  const { data: treatmentRecords = [] } = useQuery({
    queryKey: ["my-treatment-records-spend"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.TreatmentRecord.filter({ provider_id: u.id });
    },
    enabled: !!me,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["my-inventory-spend"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.ProviderInventory.filter({ provider_id: u.id });
    },
    enabled: !!me,
  });

  // Spend by supplier
  const spendBySupplier = Object.values(orderRequests.reduce((acc, o) => {
    const key = o.manufacturer_name;
    if (!acc[key]) acc[key] = { name: key, orders: 0, actual: 0, estimated: 0 };
    acc[key].orders += 1;
    acc[key].actual += o.actual_total || 0;
    acc[key].estimated += o.estimated_total || 0;
    return acc;
  }, {})).sort((a, b) => (b.actual || b.estimated) - (a.actual || a.estimated));

  const totalSpend = spendBySupplier.reduce((s, x) => s + (x.actual || x.estimated), 0);
  const deliveredOrders = orderRequests.filter(o => o.status === "delivered").length;

  // Treatment usage
  const treatmentList = Object.values(treatmentRecords.reduce((acc, r) => {
    const svc = r.service || "Unknown Service";
    if (!acc[svc]) acc[svc] = { service: svc, count: 0, units: 0, products: new Set() };
    acc[svc].count += 1;
    acc[svc].units += r.units_used || 0;
    r.products_used?.forEach(p => p.product_name && acc[svc].products.add(p.product_name));
    return acc;
  }, {}))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(t => ({ ...t, products: [...t.products] }));

  // Lot compliance
  const inventoryLots = new Set(inventory.map(i => i.batch_lot).filter(Boolean));
  const unmatchedLots = [...new Map(
    treatmentRecords.flatMap(r =>
      (r.products_used || [])
        .filter(p => p.batch_lot && !inventoryLots.has(p.batch_lot))
        .map(p => [p.batch_lot, { lot: p.batch_lot, product: p.product_name, date: r.treatment_date }])
    )
  ).values()];

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.4)" }} />)}</div>;
  }

  const isEmpty = orderRequests.length === 0 && treatmentRecords.length === 0;

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Orders", value: orderRequests.length, icon: ShoppingCart, color: "#7B8EC8", bg: "rgba(123,142,200,0.08)" },
          { label: "Delivered", value: deliveredOrders, icon: Truck, color: "#4a6b10", bg: "rgba(200,230,60,0.1)" },
          { label: "Total Spend", value: totalSpend > 0 ? `$${totalSpend.toLocaleString()}` : "—", icon: DollarSign, color: "#FA6F30", bg: "rgba(250,111,48,0.08)" },
          { label: "Suppliers", value: spendBySupplier.length, icon: Package, color: "#2D6B7F", bg: "rgba(45,107,127,0.08)" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl px-4 py-3.5 flex items-center gap-3" style={{ background: bg, border: `1px solid ${color}22` }}>
            <Icon className="w-5 h-5 flex-shrink-0" style={{ color }} />
            <div>
              <p className="text-lg font-bold leading-tight" style={{ color }}>{value}</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {isEmpty && (
        <div className="py-16 text-center rounded-2xl" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(30,37,53,0.07)" }}>
          <TrendingUp className="w-9 h-9 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
          <p className="font-semibold" style={{ color: "#1e2535" }}>No data yet</p>
          <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.45)" }}>Place your first order request and log treatments to see analytics here.</p>
        </div>
      )}

      {/* Spend by Supplier */}
      {spendBySupplier.length > 0 && (
        <SectionCard title="Spend by Supplier" icon={DollarSign} iconColor="#FA6F30">
          <div className="divide-y" style={{ borderColor: "rgba(30,37,53,0.05)" }}>
            {spendBySupplier.map((s, i) => {
              const pct = totalSpend > 0 ? Math.round(((s.actual || s.estimated) / totalSpend) * 100) : 0;
              return (
                <div key={i} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{s.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(30,37,53,0.07)", maxWidth: 160 }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #FA6F30, #C8E63C)" }} />
                      </div>
                      <span className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>{pct}%</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: "#1e2535" }}>
                      {s.actual > 0 ? `$${s.actual.toLocaleString()}` : s.estimated > 0 ? `~$${s.estimated.toLocaleString()}` : "—"}
                    </p>
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>{s.orders} order{s.orders !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Product Usage by Service */}
      {treatmentList.length > 0 && (
        <SectionCard title="Product Usage by Service" icon={TrendingUp} iconColor="#7B8EC8">
          <div className="divide-y" style={{ borderColor: "rgba(30,37,53,0.05)" }}>
            {treatmentList.map((t, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{t.service}</p>
                  {t.products.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.products.slice(0, 3).map((p, j) => (
                        <span key={j} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8" }}>{p}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{t.count} tx</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>{t.units} units</p>
                  {t.count > 0 && t.units > 0 && (
                    <p className="text-xs font-semibold" style={{ color: "#7B8EC8" }}>{(t.units / t.count).toFixed(1)} avg</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Lot Compliance */}
      <SectionCard
        title="Lot Compliance"
        icon={ShieldCheck}
        iconColor={unmatchedLots.length > 0 ? "#DA6A63" : "#4a6b10"}
        badge={
          unmatchedLots.length === 0
            ? <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10" }}><CheckCircle className="w-3 h-3" /> All Clear</span>
            : <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(218,106,99,0.1)", color: "#DA6A63" }}><AlertTriangle className="w-3 h-3" /> {unmatchedLots.length} Unmatched</span>
        }
      >
        {unmatchedLots.length === 0 ? (
          <div className="px-5 py-4">
            <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>
              {inventoryLots.size > 0
                ? `All ${inventoryLots.size} lot numbers match your inventory records.`
                : "Add inventory with lot numbers to enable compliance tracking."}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(30,37,53,0.05)" }}>
            {unmatchedLots.map((u, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#DA6A63" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{u.product}</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Lot #{u.lot} · {u.date ? format(new Date(u.date), "MMM d, yyyy") : ""}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(218,106,99,0.1)", color: "#DA6A63" }}>Not in inventory</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Order History */}
      {orderRequests.length > 0 && (
        <SectionCard title="Order History" icon={Package} iconColor="#2D6B7F">
          <div className="divide-y" style={{ borderColor: "rgba(30,37,53,0.05)" }}>
            {orderRequests.slice(0, 10).map((order) => {
              const statusCfg = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.sent;
              const itemSummary = order.order_items?.map(x => `${x.quantity} ${x.unit} ${x.product_name}`).join(", ") || "—";
              return (
                <div key={order.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{order.manufacturer_name}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(30,37,53,0.45)" }}>{itemSummary}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>{order.sent_at ? format(new Date(order.sent_at), "MMM d") : "—"}</p>
                    {order.actual_total > 0 && <p className="text-xs font-bold" style={{ color: "#1e2535" }}>${order.actual_total.toLocaleString()}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}