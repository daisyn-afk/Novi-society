import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users as UsersIcon
} from "lucide-react";
import { adminUsersApi } from "@/api/adminUsersApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { STAFF_MODULE_CATALOG } from "@/lib/routeAccessPolicy";

const ROLE_OPTIONS = [
  { value: "provider", label: "Provider" },
  { value: "patient", label: "Patient" },
  { value: "medical_director", label: "Medical Director" },
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" }
];

const ROLE_FILTER_OPTIONS = [{ value: "all", label: "All roles" }, ...ROLE_OPTIONS];
const ACTIVE_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" }
];

function buildEmptyPermissions() {
  return Object.fromEntries(STAFF_MODULE_CATALOG.map((m) => [m.key, false]));
}

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  role: "provider",
  is_active: true,
  permissions: buildEmptyPermissions()
};

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

function roleLabel(value) {
  return ROLE_OPTIONS.find((r) => r.value === value)?.label || value || "—";
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const debouncedSearch = useDebounced(search, 300);

  const queryKey = [
    "admin-users",
    {
      page,
      pageSize: PAGE_SIZE,
      q: debouncedSearch,
      role: roleFilter,
      isActive: activeFilter
    }
  ];

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () =>
      adminUsersApi.list({
        page,
        pageSize: PAGE_SIZE,
        q: debouncedSearch,
        role: roleFilter === "all" ? "" : roleFilter,
        isActive: activeFilter === "all" ? "" : activeFilter
      }),
    placeholderData: keepPreviousData
  });

  const users = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing?.id) {
        const body = {
          email: payload.email,
          first_name: payload.first_name,
          last_name: payload.last_name,
          role: payload.role,
          is_active: payload.is_active,
          permissions: payload.role === "staff" ? payload.permissions : null
        };
        if (payload.password) body.password = payload.password;
        return adminUsersApi.update(editing.id, body);
      }
      return adminUsersApi.create(payload);
    },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["admin-users"] });
        setDialogOpen(false);
        setEditing(null);
        setForm({ ...EMPTY_FORM, permissions: buildEmptyPermissions() });
        setFormError("");
      },
    onError: (err) => setFormError(err?.message || "Unable to save user.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminUsersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteTarget(null);
    }
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, permissions: buildEmptyPermissions() });
    setFormError("");
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    const existingPerms = user.permissions && typeof user.permissions === "object"
      ? user.permissions
      : {};
    const permissions = Object.fromEntries(
      STAFF_MODULE_CATALOG.map((m) => [m.key, existingPerms[m.key] === true])
    );
    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      password: "",
      role: user.role || "",
      is_active: user.is_active !== false,
      permissions
    });
    setFormError("");
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSave = () => {
    setFormError("");
    const email = form.email.trim();
    if (!email) {
      setFormError("Email is required.");
      return;
    }
    if (!editing) {
      if (!form.password || form.password.length < 8) {
        setFormError("Password is required and must be at least 8 characters.");
        return;
      }
    } else if (form.password && form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    saveMutation.mutate({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email,
      password: form.password,
      role: form.role,
      is_active: form.is_active,
      permissions: form.permissions
    });
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Users</h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage users stored in Supabase (auth + profile).
          </p>
        </div>
        <Button onClick={openCreate} style={{ background: "#C8E63C", color: "#1a2540" }}>
          <Plus className="w-4 h-4 mr-1" /> New User
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name or email"
                className="pl-9"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setRoleFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_FILTER_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={activeFilter}
              onValueChange={(v) => {
                setActiveFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_FILTER_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-red-600">
                      {error?.message || "Failed to load users."}
                    </TableCell>
                  </TableRow>
                ) : isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={6}>
                        <div className="h-5 bg-slate-100 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <UsersIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-500 text-sm">No users found.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium text-slate-900">
                        {user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "—"}
                      </TableCell>
                      <TableCell className="text-slate-700">{user.email}</TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {roleLabel(user.role)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            user.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(user)}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-slate-500">
              {total === 0
                ? "No results"
                : `Showing ${from}–${to} of ${total}${isFetching ? " (updating…)" : ""}`}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <span className="text-xs text-slate-600 px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setForm({ ...EMPTY_FORM, permissions: buildEmptyPermissions() });
            setFormError("");
            setShowPassword(false);
          }
        }}
      >
        <DialogContent
          className="max-w-xl max-h-[90vh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.email}` : "Create User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  First name
                </label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Last name
                </label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Email *</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                {editing ? "New password (leave blank to keep current)" : "Password *"}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editing ? "••••••••" : "Minimum 8 characters"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Role *</label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-700 h-10">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                  />
                  Active
                </label>
              </div>
            </div>

            {form.role === "staff" && (
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-0.5">Module Access</p>
                  <p className="text-xs text-slate-400">
                    Select the modules this staff user can access. Dashboard is always included.
                  </p>
                </div>
                <div className="space-y-3">
                  {Array.from(
                    new Set(STAFF_MODULE_CATALOG.map((m) => m.group))
                  ).map((group) => (
                    <div key={group}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        {group}
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {STAFF_MODULE_CATALOG.filter((m) => m.group === group).map((module) => (
                          <label
                            key={module.key}
                            className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={form.permissions?.[module.key] === true}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  permissions: {
                                    ...f.permissions,
                                    [module.key]: e.target.checked
                                  }
                                }))
                              }
                              className="rounded"
                            />
                            <span>{module.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formError ? (
              <p className="text-sm text-red-600">{formError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              style={{ background: "#C8E63C", color: "#1a2540" }}
            >
              {saveMutation.isPending ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent
          className="max-w-md"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            This will permanently remove{" "}
            <strong>{deleteTarget?.email}</strong> from Supabase Auth and the users table.
          </p>
          {deleteMutation.error ? (
            <p className="text-sm text-red-600">
              {deleteMutation.error?.message || "Delete failed."}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
