// @ts-nocheck — checkJs + untyped base44 client causes false-positive TS errors in this file
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, BookOpen, Award, FileText, Users,
  Calendar, Star, ShieldCheck, ClipboardList, Settings,
  Menu, X, LogOut, ChevronRight, User, Lock, Stethoscope, Sparkles, Clock, AlertTriangle, ShoppingBag, Mail, Eye, Rocket, TicketPercent
} from "lucide-react";
import { useProviderAccess } from "@/components/useProviderAccess";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NotificationBell from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navByRole = {
  admin: [
    { label: "Dashboard", icon: LayoutDashboard, page: "AdminDashboard" },
    { label: "Users", icon: Users, page: "AdminUsers" },
    { label: "Pre-Order Applications", icon: ClipboardList, page: "AdminPreOrders" },
    { label: "Courses & Enrollments", icon: BookOpen, page: "admincourses" },
    { label: "Providers", icon: Users, page: "AdminProviders" },
    { label: "Licenses & Certifications", icon: FileText, page: "AdminLicenses" },
    { label: "Service Types", icon: Settings, page: "AdminServiceTypes" },
    { label: "Promo Codes", icon: TicketPercent, page: "AdminPromoCodes" },
    { label: "Manufacturer Marketplace", icon: ShoppingBag, page: "AdminManufacturers" },
    { label: "Email Automation", icon: Mail, page: "AdminEmailTemplates" },
    { label: "Growth Studio Editor", icon: Rocket, page: "AdminLaunchPad" },
    { label: "Wizard Configuration", icon: Settings, page: "AdminWizardConfig" },
    { label: "Compliance & Reviews", icon: ShieldCheck, page: "AdminCompliance" },
  ],
  provider: [
    { label: "Dashboard", icon: LayoutDashboard, page: "ProviderDashboard" },
    { label: "Courses & Enrollments", icon: BookOpen, page: "ProviderEnrollments" },
    { label: "My Credentials & Coverage", icon: ShieldCheck, page: "ProviderCredentialsCoverage" },
    { label: "Supplier Marketplace", icon: ShoppingBag, page: "ProviderMarketplace" },
    { label: "Growth Studio", icon: Rocket, page: "ProviderLaunchPad" },
    { label: "My Practice", icon: Stethoscope, page: "ProviderPractice" },
    { label: "Profile", icon: User, page: "ProviderProfile" },
  ],
  medical_director: [
    { label: "Dashboard", icon: LayoutDashboard, page: "MDDashboard" },
    { label: "Provider Supervision", icon: Users, page: "MDProviderRelationships" },
    { label: "Treatment Records", icon: ClipboardList, page: "MDTreatmentRecords" },
    { label: "Compliance Logs", icon: ShieldCheck, page: "MDCompliance" },
    { label: "Certifications", icon: Award, page: "MDCertifications" },
  ],
  patient: [
    { label: "My Journey", icon: Sparkles, page: "PatientJourney" },
    { label: "Find Providers", icon: Users, page: "PatientMarketplace" },
    { label: "My Appointments", icon: Calendar, page: "PatientAppointments" },
    { label: "My Reviews", icon: Star, page: "PatientReviews" },
    { label: "Profile", icon: User, page: "PatientProfile" },
  ],
  staff: [
    { label: "Dashboard", icon: LayoutDashboard, page: "AdminDashboard" },
    { label: "Enrollments", icon: ClipboardList, page: "AdminEnrollments" },
    { label: "Providers", icon: Users, page: "AdminProviders" },
  ],
};

const ROLE_ALIASES = {
  md: "medical_director",
};

const DASHBOARD_BY_ROLE = {
  admin: "AdminDashboard",
  provider: "ProviderDashboard",
  patient: "PatientJourney",
  medical_director: "MDDashboard",
};

const normalizeRole = (role) => ROLE_ALIASES[role] || role;

const BARE_PAGES = ["Onboarding", "ProviderBasicOnboarding", "ProviderGettingStarted", "LandingPage", "ProviderApplication", "NoviLanding"];
const PUBLIC_PAGES = ["NoviLanding", "LandingPage"];
const PROVIDER_FREE_PAGES = ["ProviderDashboard", "CourseCatalog", "ProviderProfile", "ProviderGettingStarted"];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roleOverride, setRoleOverride] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { status: providerAccessStatus } = useProviderAccess();

  const { data: user, isSuccess } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  useEffect(() => {
    if (!isSuccess || !user) return;
    if (!user.role && currentPageName !== "Onboarding") {
      navigate(createPageUrl("Onboarding"));
    }
  }, [isSuccess, user, currentPageName]);

  const role = normalizeRole(roleOverride || user?.role || "provider");
  /** URL-based admin shell: /admin and /admincourses must show admin nav even if user.role is still provider */
  const forceAdminNav =
    location.pathname === "/admin" ||
    location.pathname === "/admincourses" ||
    location.pathname.startsWith("/admin/");
  const navRole = forceAdminNav ? "admin" : role;
  const navItems = navByRole[navRole] || navByRole.provider;

  const { data: providerEnrollments = [] } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Enrollment.filter({ provider_id: me.id });
    },
    enabled: role === "provider",
  });

  const { data: providerCerts = [] } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: me.id });
    },
    enabled: role === "provider",
  });

  const isProviderUnlocked = true;

  const handleLogout = async () => {
    try {
      queryClient.clear();
    } catch (e) {
      // no-op
    }
    const redirectTarget = `${window.location.origin}/login`;
    base44.auth.logout(redirectTarget);
  };

  if (BARE_PAGES.includes(currentPageName)) {
    return <div>{children}</div>;
  }

  const isActive = (page) => currentPageName === page;

  const roleLabel = {
    admin: "Admin",
    provider: "Provider",
    medical_director: "Medical Director",
    patient: "Patient",
    staff: "Staff",
  }[forceAdminNav ? "admin" : role] || (forceAdminNav ? "Admin" : role);

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', sans-serif", background: "linear-gradient(150deg, #ede9fb 0%, #f5f2ff 40%, #eaf5c8 75%, #C8E63C 100%)", backgroundAttachment: "fixed" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');

        * { box-sizing: border-box; }
        body { font-family: 'DM Sans', sans-serif; }
        h1,h2,h3,h4,h5,h6 { font-family: 'DM Serif Display', serif; }

        .novi-sidebar {
          background: #f5f3ef;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          border-right: 1px solid rgba(123,142,200,0.12);
        }
        .novi-sidebar-accent {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: none;
        }

        .novi-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(123,142,200,0.88);
          transition: all 0.15s ease;
          text-decoration: none;
          letter-spacing: 0;
          position: relative;
          font-family: 'DM Sans', sans-serif;
        }
        .novi-nav-item:hover {
          color: rgba(123,142,200,0.9);
          background: rgba(123,142,200,0.08);
        }
        .novi-nav-item.active {
          color: rgba(30,37,53,0.95);
          background: rgba(200,230,60,0.15);
          font-weight: 600;
        }
        .novi-nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: #C8E63C;
          border-radius: 0 3px 3px 0;
        }
        .novi-nav-item.locked {
          color: rgba(123,142,200,0.25);
        }

        .novi-topbar {
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.12);
        }

        .novi-main {
          background: transparent;
        }

        .novi-role-pill {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 100px;
          background: rgba(200,230,60,0.12);
          color: #3d5615;
          border: 1px solid rgba(200,230,60,0.3);
          display: inline-block;
          font-family: 'DM Sans', sans-serif;
        }

        .role-btn {
          font-size: 12px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 100px;
          transition: all 0.15s;
          cursor: pointer;
          border: 1px solid transparent;
          font-family: 'DM Sans', sans-serif;
        }
        .role-btn-active {
          background: rgba(200,230,60,0.12);
          color: #5a7a20;
          border-color: rgba(200,230,60,0.3);
          font-weight: 700;
        }
        .role-btn-inactive {
          color: rgba(123,142,200,0.7);
          background: transparent;
        }
        .role-btn-inactive:hover {
          background: rgba(123,142,200,0.08);
          color: rgba(123,142,200,0.8);
        }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`novi-sidebar fixed top-0 left-0 h-full w-56 z-30 flex flex-col transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:sticky lg:z-auto`}
        style={{ top: 0, height: "100vh", flexShrink: 0 }}
      >
        <div className="novi-sidebar-accent" />

        {/* Logo area */}
        <div className="relative z-10 flex items-center justify-between px-5" style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5">
            {/* Logomark */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: "#5a6f9f", fontStyle: "italic", fontWeight: 400, lineHeight: 1 }}>novi</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(123,142,200,0.55)", paddingBottom: 1 }}>Society</span>
            </div>
          </div>
          <button className="lg:hidden" style={{ color: "rgba(123,142,200,0.3)" }} onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role pill */}
        <div className="relative z-10 px-5 pt-4 pb-2">
          <span className="novi-role-pill">{roleLabel}</span>
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex-1 px-3 py-1 overflow-y-auto space-y-0.5">
          {navItems.map(({ label, icon: Icon, page }) => {
            const isLocked = !isProviderUnlocked && !PROVIDER_FREE_PAGES.includes(page);
            const active = isActive(page);
            return (
              <Link
                key={page}
                to={createPageUrl(page)}
                onClick={() => setSidebarOpen(false)}
                className={`novi-nav-item${active ? " active" : ""}${isLocked ? " locked" : ""}`}
              >
                <Icon className="w-[15px] h-[15px] flex-shrink-0" style={{ opacity: active ? 0.9 : 0.6 }} />
                <span className="flex-1">{label}</span>
                {isLocked && <Lock className="w-3 h-3 opacity-30 flex-shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Role Switcher */}
        <div className="relative z-10 px-3 pb-3 pt-3" style={{ borderTop: "1px solid rgba(123,142,200,0.1)" }}>
          <p className="text-xs px-1 mb-2 uppercase tracking-widest font-semibold" style={{ color: "rgba(123,142,200,0.65)", fontSize: "9px" }}>
            Switch Role
          </p>
          <div className="grid grid-cols-2 gap-1">
            {[
              { value: "admin", label: "Admin" },
              { value: "provider", label: "Provider" },
              { value: "patient", label: "Patient" },
              { value: "medical_director", label: "MD" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={async () => {
                  const normalizedRole = normalizeRole(value);
                  setRoleOverride(normalizedRole);
                  const dashboardPage = DASHBOARD_BY_ROLE[normalizedRole] || "ProviderDashboard";
                  const dashboardUrl = createPageUrl(dashboardPage);

                  navigate(dashboardUrl, { replace: true });

                  try {
                    await base44.auth.updateMe({ role: value });
                  } catch (error) {
                    console.error("Failed to persist role change:", error);
                  } finally {
                    await queryClient.invalidateQueries({ queryKey: ["me"] });
                  }
                }}
                className={`role-btn ${role === value ? "role-btn-active" : "role-btn-inactive"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* User footer */}
        <div className="relative z-10 p-4" style={{ borderTop: "1px solid rgba(123,142,200,0.1)" }}>
          <div className="flex items-center gap-2.5">
            <Avatar className="w-7 h-7 flex-shrink-0">
              <AvatarImage src={user?.avatar_url} />
                      <AvatarFallback style={{ background: "linear-gradient(135deg, #7B8EC8, #4a6db8)", color: "white", fontSize: 11, fontWeight: 700 }}>
                {user?.full_name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "rgba(30,37,53,0.9)" }}>{user?.full_name || "User"}</p>
              <p className="truncate" style={{ fontSize: 10, color: "rgba(123,142,200,0.65)" }}>{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 transition-colors"
              title="Log out"
              style={{ color: "rgba(123,142,200,0.85)" }}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span style={{ fontSize: 11, fontWeight: 600 }}>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 novi-main lg:ml-0" style={{ background: "transparent", width: "100%" }}>
        {/* Topbar */}
        <header className="novi-topbar px-5 lg:px-7 flex items-center justify-between sticky top-0 z-10" style={{ height: 56, background: "rgba(245,243,239,0.08)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(245,243,239,0.12)" }}>
          <button className="lg:hidden p-1.5 rounded-lg" style={{ background: "transparent", color: "rgba(123,142,200,0.4)" }} onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:flex items-center gap-2">
            <span style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 15, color: "#1e2535", fontWeight: 400 }}>
              {currentPageName?.replace(/([A-Z])/g, ' $1').trim()}
            </span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ outlineColor: "rgba(200,230,60,0.6)" }}
                  aria-label="Open user menu"
                >
                  <Avatar className="w-7 h-7 cursor-pointer">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback style={{ background: "linear-gradient(135deg, #7B8EC8, #4a6db8)", color: "white", fontSize: 10, fontWeight: 700 }}>
                      {user?.full_name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold truncate">{user?.full_name || "User"}</span>
                    <span className="text-xs font-normal text-muted-foreground truncate">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 lg:p-7 overflow-auto" style={{ background: "transparent", minHeight: 0 }}>
          {/* Contextual status banners for providers */}
          {role === "provider" && providerAccessStatus === "pending" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5" style={{ background: "rgba(250,111,48,0.15)", border: "1px solid rgba(250,111,48,0.4)" }}>
              <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#FA6F30" }} />
              <p className="text-sm font-semibold text-white flex-1">
                Your license is under review — courses & full portal unlock once approved.
              </p>
              <span className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(250,111,48,0.25)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.4)" }}>
                Pending
              </span>
            </div>
          )}
          {role === "provider" && providerAccessStatus === "courses_only" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5" style={{ background: "rgba(123,142,200,0.15)", border: "1px solid rgba(123,142,200,0.4)" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#7B8EC8" }} />
              <p className="text-sm font-semibold text-white flex-1">
                License verified! Enroll in a NOVI course or upload an external cert to unlock MD coverage.
              </p>
            </div>
          )}
          {role === "provider" && providerAccessStatus === "md_eligible" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.4)" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#C8E63C" }} />
              <p className="text-sm font-semibold text-white flex-1">
                Certification approved! Sign up for an MD Board subscription to unlock full practice features.
              </p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}