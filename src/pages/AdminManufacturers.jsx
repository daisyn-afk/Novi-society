import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Building2, ChevronDown, ChevronUp,
  Star, Globe, Mail, Package, Eye, EyeOff, Search,
} from "lucide-react";
import SupplierFormDialog from "@/components/admin/manufacturers/SupplierFormDialog";
import {
  CATEGORY_LABELS,
} from "@/components/admin/manufacturers/constants";

export default function AdminManufacturers() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [viewTab, setViewTab] = useState("manufacturers");
  const [inventorySearch, setInventorySearch] = useState("");

  const { data: manufacturers = [], isLoading } = useQuery({
    queryKey: ["manufacturers-admin"],
    queryFn: () => base44.entities.Manufacturer.list(),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["manufacturer-applications-admin"],
    queryFn: () => base44.entities.ManufacturerApplication.list("-submitted_at"),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) return base44.entities.Manufacturer.update(editing.id, data);
      return base44.entities.Manufacturer.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manufacturers-admin"] });
      setDialogOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Manufacturer.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manufacturers-admin"] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.Manufacturer.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manufacturers-admin"] }),
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setDialogOpen(true);
  };

  const handleDialogChange = (next) => {
    setDialogOpen(next);
    if (!next) setEditing(null);
  };

  const uploadFile = async (file, uploadKind = "manufacturer_logo") => {
    const result = await base44.integrations.Core.UploadFile({
      file,
      kind: uploadKind,
    });
    return result?.file_url || result?.url || "";
  };

  const pendingApps = applications.filter((a) => a.status === "submitted");

  const { data: allInventory = [] } = useQuery({
    queryKey: ["all-provider-inventory"],
    queryFn: () => base44.entities.ProviderInventory.list("-created_date"),
    enabled: viewTab === "inventory",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manufacturer Marketplace</h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage suppliers shown to providers and review applications
          </p>
        </div>
        <Button onClick={openNew} style={{ background: "#C8E63C", color: "#1a2540" }}>
          <Plus className="w-4 h-4 mr-1" /> Add Manufacturer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Suppliers", value: manufacturers.length, color: "#7B8EC8" },
          { label: "Active", value: manufacturers.filter((m) => m.is_active).length, color: "#C8E63C" },
          { label: "Featured", value: manufacturers.filter((m) => m.is_featured).length, color: "#FA6F30" },
          { label: "Pending Applications", value: pendingApps.length, color: "#DA6A63" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 bg-white border border-slate-100">
            <p style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <Tabs value={viewTab} onValueChange={setViewTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="manufacturers">
            Manufacturers ({manufacturers.length})
          </TabsTrigger>
          <TabsTrigger value="applications">
            Applications
            {pendingApps.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingApps.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="inventory">Provider Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="manufacturers">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : manufacturers.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-white border border-slate-100">
              <Building2 className="w-10 h-10 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400">No manufacturers yet. Add your first one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {manufacturers
                .slice()
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                .map((m) => (
                  <div key={m.id} className="rounded-2xl overflow-hidden bg-white border border-slate-100">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    >
                      <div className="flex items-center gap-3">
                        {m.logo_url ? (
                          <img
                            src={m.logo_url}
                            alt={m.name}
                            className="w-10 h-10 rounded-lg object-contain bg-slate-50 p-1 border border-slate-100"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900">{m.name}</p>
                            <Badge className={m.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                              {m.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {CATEGORY_LABELS[m.category] || m.category}
                            </Badge>
                            {m.is_featured && (
                              <Badge className="bg-amber-100 text-amber-700 text-xs">
                                <Star className="w-2.5 h-2.5 mr-1" />Featured
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {m.products?.length || 0} products · Rep:{" "}
                            {m.account_rep_email || "Not set"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={m.is_active ? "Deactivate" : "Activate"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleActiveMutation.mutate({ id: m.id, is_active: !m.is_active });
                          }}
                        >
                          {m.is_active ? (
                            <Eye className="w-4 h-4 text-green-500" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-slate-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(m);
                          }}
                        >
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this manufacturer?")) deleteMutation.mutate(m.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                        {expandedId === m.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {expandedId === m.id && (
                      <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50 grid sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Products
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {m.products?.length > 0 ? (
                              m.products.map((p, i) => (
                                <Badge key={`${p}-${i}`} variant="outline" className="text-xs">
                                  {p}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400">None listed</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Provider Benefits
                          </p>
                          <ul className="space-y-0.5">
                            {m.benefits?.length > 0 ? (
                              m.benefits.map((b, i) => (
                                <li key={`${b}-${i}`} className="text-xs text-slate-600">
                                  • {b}
                                </li>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400">None listed</p>
                            )}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Extra Required Fields
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {m.required_fields?.length > 0 ? (
                              m.required_fields.map((f, i) => (
                                <Badge key={`${f}-${i}`} className="bg-blue-100 text-blue-700 text-xs">
                                  {f}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400">None (standard fields only)</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Account Rep
                          </p>
                          <p className="text-xs text-slate-700">{m.account_rep_name || "—"}</p>
                          <p className="text-xs text-slate-500">{m.account_rep_email}</p>
                          {m.website_url && (
                            <a
                              href={m.website_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                            >
                              <Globe className="w-3 h-3" />
                              {m.website_url}
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications">
          {applications.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-white border border-slate-100">
              <Mail className="w-10 h-10 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400">No applications submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="rounded-2xl bg-white border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{app.provider_name}</p>
                        <Badge
                          className={
                            {
                              submitted: "bg-blue-100 text-blue-700",
                              under_review: "bg-yellow-100 text-yellow-700",
                              approved: "bg-green-100 text-green-700",
                              rejected: "bg-red-100 text-red-700",
                            }[app.status] || "bg-slate-100 text-slate-500"
                          }
                        >
                          {app.status?.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">
                        Applied to <strong>{app.manufacturer_name}</strong>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {app.license_type} · {app.license_number} · {app.license_state} ·{" "}
                        {app.practice_name && `${app.practice_name} · `}
                        {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          base44.entities.ManufacturerApplication.update(app.id, {
                            status: "approved",
                          }).then(() =>
                            qc.invalidateQueries({ queryKey: ["manufacturer-applications-admin"] })
                          )
                        }
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                  {app.additional_fields && Object.keys(app.additional_fields).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Additional Fields
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(app.additional_fields).map(([k, v]) => (
                          <div key={k} className="text-xs">
                            <span className="font-semibold text-slate-600">{k}:</span>{" "}
                            <span className="text-slate-700">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none"
                  placeholder="Search by provider or product..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                />
              </div>
              <span className="text-xs text-slate-500">
                {allInventory.length} items across all providers
              </span>
            </div>
            {allInventory.length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-white border border-slate-100">
                <Package className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400">No provider inventory logged yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allInventory
                  .filter(
                    (i) =>
                      !inventorySearch ||
                      i.provider_name?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                      i.product_name?.toLowerCase().includes(inventorySearch.toLowerCase())
                  )
                  .map((item) => {
                    const today = new Date();
                    const isExpired =
                      item.expiration_date && new Date(item.expiration_date) < today;
                    const isExpiringSoon =
                      item.expiration_date &&
                      !isExpired &&
                      new Date(item.expiration_date) <=
                        new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl bg-white border p-4 flex items-center gap-4"
                        style={{
                          borderColor: isExpired
                            ? "rgba(218,106,99,0.4)"
                            : isExpiringSoon
                            ? "rgba(250,111,48,0.3)"
                            : "#e5e7eb",
                        }}
                      >
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 text-sm">
                              {item.product_name}
                            </p>
                            {item.manufacturer_name && (
                              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                                {item.manufacturer_name}
                              </span>
                            )}
                            {isExpired && (
                              <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                                Expired
                              </span>
                            )}
                            {isExpiringSoon && (
                              <span className="text-xs font-bold px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full">
                                Expiring Soon
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Provider:{" "}
                            <strong className="text-slate-600">{item.provider_name}</strong>
                            {item.batch_lot ? ` · Lot: ${item.batch_lot}` : ""}
                            {item.expiration_date
                              ? ` · Exp: ${new Date(item.expiration_date).toLocaleDateString()}`
                              : ""}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p
                            className="font-bold text-lg"
                            style={{ color: item.quantity <= 2 ? "#FA6F30" : "#1e2535" }}
                          >
                            {item.quantity}
                          </p>
                          <p className="text-xs text-slate-400">{item.unit}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        initial={editing}
        isSubmitting={saveMutation.isPending}
        onSubmit={(payload) => saveMutation.mutate(payload)}
        onUploadFile={uploadFile}
      />
    </div>
  );
}
