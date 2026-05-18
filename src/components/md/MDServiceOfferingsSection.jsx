import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApiRequest } from "@/api/adminApiRequest";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

/** Services the MD supervises — drives round-robin auto-assignment eligibility. */
export default function MDServiceOfferingsSection() {
  const qc = useQueryClient();
  const { data: mine, isLoading: mineLoading } = useQuery({
    queryKey: ["md-service-offerings-me"],
    queryFn: () => adminApiRequest("/admin/md-service-offerings/me", { method: "GET" }),
  });
  const { data: serviceTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ["admin-service-types-md-offerings"],
    queryFn: () => adminApiRequest("/admin/service-types?is_active=true", { method: "GET" }),
  });

  const initialIds = useMemo(() => new Set(mine?.service_type_ids || []), [mine?.service_type_ids]);
  const [selected, setSelected] = useState(() => new Set());
  const [dirty, setDirty] = useState(false);

  const effectiveSelected = dirty ? selected : initialIds;
  const allServicesWildcard = effectiveSelected.has("*");

  const saveMutation = useMutation({
    mutationFn: async (ids) =>
      adminApiRequest("/admin/md-service-offerings/me", {
        method: "PUT",
        body: JSON.stringify({ service_type_ids: ids }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["md-service-offerings-me"] });
      setDirty(false);
      setSelected(new Set());
    },
  });

  const loading = mineLoading || typesLoading;

  function toggle(id) {
    setDirty(true);
    setSelected((prev) => {
      const base = dirty ? prev : new Set(initialIds);
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    saveMutation.mutate([...effectiveSelected]);
  }

  const sortedTypes = [...serviceTypes].sort((a, b) =>
    String(a.name || a.id).localeCompare(String(b.name || b.id))
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm py-6 justify-center text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading services…
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDirty(true);
            setSelected(new Set(["*"]));
          }}
        >
          All services
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-slate-600"
          onClick={() => {
            setDirty(true);
            setSelected(new Set());
          }}
        >
          Clear
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 divide-y max-h-64 overflow-y-auto bg-white">
        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50" htmlFor="md-offer-wildcard">
          <Checkbox
            id="md-offer-wildcard"
            checked={allServicesWildcard}
            onCheckedChange={(checked) => {
              setDirty(true);
              setSelected(checked ? new Set(["*"]) : new Set());
            }}
          />
          <span className="text-sm font-medium text-slate-900">All services</span>
        </label>
        {!allServicesWildcard &&
          sortedTypes.map((st) => {
            const id = String(st.id || "");
            return (
              <label
                key={id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                htmlFor={`md-offer-${id}`}
              >
                <Checkbox
                  id={`md-offer-${id}`}
                  checked={effectiveSelected.has(id)}
                  onCheckedChange={() => toggle(id)}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-900">{st.name || id}</span>
                  {st.category && (
                    <span className="text-xs text-slate-500 ml-2 capitalize">{st.category}</span>
                  )}
                </div>
              </label>
            );
          })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="button" onClick={handleSave} disabled={saveMutation.isPending || !dirty}>
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…
            </>
          ) : (
            "Save services"
          )}
        </Button>
        {!dirty && (mine?.service_type_ids || []).length > 0 && (
          <Label className="text-xs font-normal text-slate-500">
            {(mine.service_type_ids || []).includes("*")
              ? "All services selected."
              : `${(mine.service_type_ids || []).length} service(s) saved.`}
          </Label>
        )}
      </div>
      {saveMutation.isError && (
        <p className="text-sm text-red-600">{String(saveMutation.error?.message || "Save failed.")}</p>
      )}
    </div>
  );
}
