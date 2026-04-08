import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, Users } from "lucide-react";

const menuItems = [
  { key: "users", label: "Users", icon: Users, to: "/admin/users" },
  { key: "courses", label: "Courses", icon: BookOpen, to: "/admin/courses" }
];

function AdminSection({ title }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">
        This is the {title.toLowerCase()} section. You can wire your tables/forms here.
      </p>
    </div>
  );
}

export function AdminUsersSection() {
  return <AdminSection title="Users" />;
}

export function AdminCoursesSection() {
  return <AdminSection title="Courses" />;
}

export default function AdminPortal() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="w-64 shrink-0 rounded-xl border border-slate-200 bg-white p-4">
          <h1 className="mb-4 text-lg font-semibold text-slate-900">Admin</h1>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

