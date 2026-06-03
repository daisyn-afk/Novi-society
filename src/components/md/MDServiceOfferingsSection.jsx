import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApiRequest } from "@/api/adminApiRequest";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Services the MD supervises — drives round-robin auto-assignment eligibility. */
export default function MDServiceOfferingsSection() {
  const qc = useQueryClient();
  const { data: mine, isLoading: mineLoading } = useQuery({
    queryKey: ["md-service-offerings-me"],
    queryFn: () => adminApiRequest("/admin/md-service-offerings/me", { method: "GET" }),
    staleTime: 30_000,
  });
  const { data: serviceTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ["admin-service-types-md-offerings"],
    queryFn: () => adminApiRequest("/admin/service-types?is_active=true", { method: "GET" }),
    staleTime: 60_000,
  });

  const savedIds = useMemo(
    () => new Set((mine?.service_type_ids || []).map((id) => String(id))),
    [mine?.service_type_ids]
  );

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (mineLoading || hydrated) return;
    setSelectedIds(new Set(savedIds));
    setHydrated(true);
  }, [mineLoading, hydrated, savedIds]);

  useEffect(() => {
    if (!hydrated || mineLoading) return;
    setSelectedIds((prev) => (setsEqual(prev, savedIds) ? prev : new Set(savedIds)));
  }, [savedIds, hydrated, mineLoading]);

  const dirty = hydrated && !setsEqual(selectedIds, savedIds);
  const allServicesWildcard = selectedIds.has("*");

  const saveMutation = useMutation({
    mutationFn: async (ids) =>
      adminApiRequest("/admin/md-service-offerings/me", {
        method: "PUT",
        body: JSON.stringify({ service_type_ids: ids }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["md-service-offerings-me"], data);
      const next = new Set((data?.service_type_ids || []).map((id) => String(id)));
      setSelectedIds(next);
    },
  });

  const loading = mineLoading || typesLoading || !hydrated;

  function setSelection(next) {
    setSelectedIds(next instanceof Set ? next : new Set(next));
  }

  function toggle(id) {
    const key = String(id || "");
    if (!key) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSave() {
    saveMutation.mutate([...selectedIds].filter(Boolean));
  }

  const sortedTypes = useMemo(
    () =>
      [...serviceTypes].sort((a, b) =>
        String(a.name || a.id).localeCompare(String(b.name || b.id))
      ),
    [serviceTypes]
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
          onClick={() => setSelection(["*"])}
        >
          All services
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-slate-600"
          onClick={() => setSelection([])}
        >
          Clear
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 divide-y max-h-64 overflow-y-auto bg-white">
        <div
          role="button"
          tabIndex={0}
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 select-none"
          onClick={() => setSelection(allServicesWildcard ? [] : ["*"])}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelection(allServicesWildcard ? [] : ["*"]);
            }
          }}
        >
          <Checkbox checked={allServicesWildcard} className="pointer-events-none" />
          <span className="text-sm font-medium text-slate-900">All services</span>
        </div>
        {!allServicesWildcard &&
          sortedTypes.map((st) => {
            const id = String(st.id || "");
            const checked = selectedIds.has(id);
            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 select-none"
                onClick={() => toggle(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(id);
                  }
                }}
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-900">{st.name || id}</span>
                  {st.category && (
                    <span className="text-xs text-slate-500 ml-2 capitalize">{st.category}</span>
                  )}
                </div>
              </div>
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
        {!dirty && savedIds.size > 0 && (
          <Label className="text-xs font-normal text-slate-500">
            {savedIds.has("*")
              ? "All services selected."
              : `${savedIds.size} service(s) saved.`}
          </Label>
        )}
      </div>
      {saveMutation.isError && (
        <p className="text-sm text-red-600">{String(saveMutation.error?.message || "Save failed.")}</p>
      )}
    </div>
  );
}
