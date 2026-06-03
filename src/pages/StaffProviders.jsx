import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApiRequest } from "@/api/adminApiRequest";
import { Input } from "@/components/ui/input";
import { Search, Users as UsersIcon } from "lucide-react";

const PAGE_SIZE = 10;

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function StaffProviders() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, 300);

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-providers", { q: debouncedSearch, page }],
    queryFn: () =>
      adminApiRequest(`/admin/users/providers?q=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=${PAGE_SIZE}`),
    retry: false,
  });

  const providers = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.15 }}>Provider Lookup</h1>
        <p style={{ color: "rgba(30,37,53,0.55)", fontSize: 13, marginTop: 4 }}>Search and view provider accounts</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or email..."
          className="pl-9"
        />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.07)" }}>
        {error ? (
          <div className="text-center py-16 px-6">
            <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#1e2535" }} />
            <p className="text-sm font-semibold mb-1" style={{ color: "#DA6A63" }}>Unable to load providers</p>
            <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>{error?.message || "Request failed"}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 rounded-full animate-spin" style={{ borderColor: "rgba(30,37,53,0.1)", borderTopColor: "#C8E63C" }} />
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-16">
            <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#1e2535" }} />
            <p style={{ color: "rgba(30,37,53,0.4)" }}>No providers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.02)" }}>
                  {["Name", "Email", "Status", "Joined"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: "rgba(30,37,53,0.5)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {providers.map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: "#1e2535" }}>
                      {p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "rgba(30,37,53,0.7)" }}>{p.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!error && !isLoading && total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
            Showing {from}–{to} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: "rgba(30,37,53,0.07)", color: "rgba(30,37,53,0.7)" }}
            >
              Prev
            </button>
            <span className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: "rgba(30,37,53,0.07)", color: "rgba(30,37,53,0.7)" }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
