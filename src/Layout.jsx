// @ts-nocheck — checkJs + untyped base44 client causes false-positive jTS errors in this file
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, BookOpen, Award, FileText, Users,
  Calendar, Star, ShieldCheck, ClipboardList, Settings, Layers,
  Menu, X, LogOut, User, Stethoscope, Sparkles, Clock, AlertTriangle, ShoppingBag, Mail, Rocket, TicketPercent, MessageSquare
} from "lucide-react";
import { useProviderAccess } from "@/components/useProviderAccess";
import { useProviderDashboardState } from "@/hooks/useProviderDashboardState";
import { mdMessagesApi } from "@/api/mdMessagesApi";
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
import { hasStaffModulePermission, normalizeRole, SHARED_AUTH_PAGES } from "@/lib/routeAccessPolicy";
import ProviderNextStepBar from "@/components/launchpad/ProviderNextStepBar";
import { useLaunchRoadmapStats } from "@/components/launchpad/useLaunchRoadmapStats";
import MasterLoginBanner from "@/components/MasterLoginBanner";

const navByRole = {
  admin: [
    { label: "Dashboard", icon: LayoutDashboard, page: "AdminDashboard" },
    { label: "Users", icon: Users, page: "AdminUsers" },
    { label: "Pre-Order Applications", icon: ClipboardList, page: "AdminPreOrders" },
    { label: "Courses", icon: BookOpen, page: "admincourses" },
    { label: "Enrollments", icon: ClipboardList, page: "AdminEnrollments" },
    { label: "Providers", icon: Users, page: "AdminProviders" },
    { label: "Licenses & Certifications", icon: FileText, page: "AdminLicenses" },
    { label: "Service Types", icon: Settings, page: "AdminServiceTypes" },
    { label: "Promo Codes", icon: TicketPercent, page: "AdminPromoCodes" },
    { label: "Manufacturer Marketplace", icon: ShoppingBag, page: "AdminManufacturers" },
    { label: "Email Automation", icon: Mail, page: "AdminEmailTemplates" },
    { label: "Growth Studio Editor", icon: Rocket, page: "AdminLaunchPad" },
    { label: "Wizard Configuration", icon: Settings, page: "AdminWizardConfig" },
    { label: "Compliance & Reviews", icon: ShieldCheck, page: "AdminCompliance" },
    { label: "Model sign-ups", icon: Users, page: "AdminModelSignups" },
  ],
  provider: [
    { label: "Dashboard", icon: LayoutDashboard, page: "ProviderDashboard" },
    { label: "Courses & Enrollments", icon: BookOpen, page: "ProviderEnrollments" },
    { label: "My Credentials & Coverage", icon: ShieldCheck, page: "ProviderCredentialsCoverage" },
    { label: "Supplier Marketplace", icon: ShoppingBag, page: "ProviderMarketplace" },
    { label: "Growth Studio", icon: Rocket, page: "ProviderLaunchPad" },
    { label: "My Practice", icon: Stethoscope, page: "ProviderPractice" },
    { label: "Messages", icon: MessageSquare, page: "ProviderMessaging" },
    { label: "Profile", icon: User, page: "ProviderProfile" },
  ],
  medical_director: [
    { label: "Dashboard", icon: LayoutDashboard, page: "MDDashboard" },
    { label: "Provider Supervision", icon: Users, page: "MDProviderRelationships" },
    { label: "Treatment Records", icon: ClipboardList, page: "MDTreatmentRecords" },
    { label: "Messages", icon: MessageSquare, page: "MDMessaging" },
    { label: "Compliance Logs", icon: ShieldCheck, page: "MDCompliance" },
    { label: "Certifications", icon: Award, page: "MDCertifications" },
    { label: "MD Profile", icon: User, page: "MDProfile" },
  ],
  patient: [
    { label: "My Journey", icon: Sparkles, page: "PatientJourney" },
    { label: "Find Providers", icon: Users, page: "PatientMarketplace" },
    { label: "My Appointments", icon: Calendar, page: "PatientAppointments" },
    { label: "My Reviews", icon: Star, page: "PatientReviews" },
    { label: "Profile", icon: User, page: "PatientProfile" },
  ],
  staff: [
    { label: "Dashboard",              icon: LayoutDashboard, page: "AdminDashboard"   },
    { label: "Users",                  icon: Users,           page: "AdminUsers"        },
    { label: "Pre-Order Applications", icon: ClipboardList,   page: "AdminPreOrders"    },
    { label: "Courses",                icon: BookOpen,        page: "admincourses"      },
    { label: "Enrollments",            icon: ClipboardList,   page: "AdminEnrollments"  },
    { label: "Providers",              icon: Users,           page: "AdminProviders"    },
    { label: "Licenses & Certifications", icon: FileText,     page: "AdminLicenses"     },
    { label: "Service Types",          icon: Settings,        page: "AdminServiceTypes" },
    { label: "Promo Codes",            icon: TicketPercent,   page: "AdminPromoCodes"   },
    { label: "Manufacturer Marketplace", icon: ShoppingBag,   page: "AdminManufacturers"},
    { label: "Email Automation",       icon: Mail,            page: "AdminEmailTemplates"},
    { label: "Growth Studio Editor",   icon: Rocket,          page: "AdminLaunchPad"    },
    { label: "Wizard Configuration",   icon: Settings,        page: "AdminWizardConfig" },
    { label: "Compliance & Reviews",   icon: ShieldCheck,     page: "AdminCompliance"   },
    { label: "Model sign-ups",         icon: Users,           page: "AdminModelSignups" },
  ],
};

const BARE_PAGES = ["Onboarding", "ProviderGettingStarted", "LandingPage", "ProviderApplication", "NoviLanding", "ModelSignup", "ModelBookingLookup", "PrivacyPolicy", "TermsAndConditions", "RefundPolicy", "SMSTerms", "ContactUs"];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status: providerAccessStatus } = useProviderAccess();
  const providerDashboardState = useProviderDashboardState();

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

  const role = normalizeRole(user?.role);

  // Patient onboarding gate: a freshly-registered patient must complete the
  // 6-step PatientOnboarding flow before they can access any other patient
  // page. Shared auth pages (legal, landing) remain open so they can still
  // read policies or log out. The gate is frontend-only — it's UX flow
  // enforcement, not security; sensitive data is already protected by auth.
  const isPatient = role === "patient";
  const patientGateExemptPages = currentPageName === "PatientOnboarding"
    || currentPageName === "Onboarding"
    || SHARED_AUTH_PAGES.has(currentPageName);

  const { data: patientOnboardingState, isLoading: isPatientGateLoading } = useQuery({
    queryKey: ["patient-onboarding-gate", user?.id],
    queryFn: async () => {
      const journeys = await base44.entities.PatientJourney.filter({ patient_id: user.id });
      const journey = journeys?.[0] || null;
      return {
        hasJourney: Boolean(journey),
        completed: Boolean(journey?.onboarding_completed),
      };
    },
    enabled: isSuccess && isPatient && !!user?.id,
    staleTime: 60_000,
    retry: 1,
  });

  const patientNeedsOnboarding =
    isPatient
    && !patientGateExemptPages
    && patientOnboardingState
    && !patientOnboardingState.completed;

  useEffect(() => {
    if (patientNeedsOnboarding) {
      navigate(createPageUrl("PatientOnboarding"));
    }
  }, [patientNeedsOnboarding]);

  const navRole = role;
  const navItems = navRole === "staff"
    ? navByRole.staff.filter(({ page }) =>
        page === "AdminDashboard" || hasStaffModulePermission(page, user?.permissions)
      )
    : (navByRole[navRole] || []);

  const isProviderUserReady = role === "provider" && Boolean(user?.id || user?.email);

  // Sidebar unread message badge — shared query key ["msg-threads"] with messaging pages.
  // Polling at 5s keeps the badge live without hammering the API.
  const isMessagingRole = role === "provider" || role === "medical_director";
  const showProviderNextStepBar = isProviderUserReady;
  const { stats: launchRoadmapStats, isLoading: launchRoadmapLoading } = useLaunchRoadmapStats({
    enabled: showProviderNextStepBar,
  });
  const { data: sidebarUnreadCount = 0 } = useQuery({
    queryKey: ["msg-threads"],
    queryFn: () => mdMessagesApi.getThreads(),
    enabled: isSuccess && !!user && isMessagingRole,
    refetchInterval: 5000,
    staleTime: 4000,
    refetchOnWindowFocus: true,
    select: (threads) =>
      (Array.isArray(threads) ? threads : []).reduce(
        (sum, t) => sum + (Number(t.unread_count) || 0),
        0
      ),
  });


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

  // While we're determining whether a patient has completed onboarding,
  // suppress rendering of the protected page to avoid a flash before the
  // redirect lands. The exempt pages (PatientOnboarding, legal, landing)
  // render normally — they're allowed regardless of gate state.
  if (isPatient && !patientGateExemptPages && (isPatientGateLoading || patientNeedsOnboarding)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(150deg, #ede9fb 0%, #f5f2ff 40%, #eaf5c8 75%, #C8E63C 100%)" }}>
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = (page) => currentPageName === page;

  const roleLabel = {
    admin: "Admin",
    provider: "Provider",
    medical_director: "Medical Director",
    patient: "Patient",
    staff: "Staff",
  }[role] || role;

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', sans-serif",background: "linear-gradient(150deg, #f8f5ed 0%, #f5f3ef 50%, #f2eedf 100%)", backgroundAttachment: "fixed" }}>
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
          {role === "provider" &&
            !providerDashboardState.isLoading &&
            !providerDashboardState.hasCompletedBasic && (
            <div className="mt-2">
              <span
                className="text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full inline-block"
                style={{ background: "rgba(250,111,48,0.15)", color: "#b45309", border: "1px solid rgba(250,111,48,0.35)" }}
              >
                Onboarding pending
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex-1 px-3 py-1 overflow-y-auto space-y-0.5">
          {navItems.map(({ label, icon: Icon, page }) => {
            const active = isActive(page);
            const isMessagesPage = page === "MDMessaging" || page === "ProviderMessaging";
            const showUnreadBadge = isMessagesPage && sidebarUnreadCount > 0;
            return (
              <Link
                key={page}
                to={createPageUrl(page)}
                onClick={() => setSidebarOpen(false)}
                className={`novi-nav-item${active ? " active" : ""}`}
              >
                <Icon className="w-[15px] h-[15px] flex-shrink-0" style={{ opacity: active ? 0.9 : 0.6 }} />
                <span className="flex-1">{label}</span>
                {showUnreadBadge && (
                  <span
                    className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: "rgba(218,106,99,0.9)" }}
                  >
                    {sidebarUnreadCount > 99 ? "99+" : sidebarUnreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

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
        <MasterLoginBanner />
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
          {showProviderNextStepBar && !launchRoadmapLoading && (
            <ProviderNextStepBar stats={launchRoadmapStats} />
          )}
          {/* Contextual status banners for providers */}
          {role === "provider" && providerAccessStatus === "pending" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5" style={{ background: "rgba(250,111,48,0.15)", border: "1px solid rgba(250,111,48,0.4)" }}>
              <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#FA6F30" }} />
              <p className="text-sm font-semibold flex-1" style={{ color: "#7A2E11" }}>
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
              <p className="text-sm font-semibold flex-1" style={{ color: "#24395D" }}>
                License verified! Enroll in a NOVI course or upload an external cert to unlock MD coverage.
              </p>
            </div>
          )}
          {role === "provider" && providerAccessStatus === "md_eligible" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.4)" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#C8E63C" }} />
              <p className="text-sm font-semibold flex-1" style={{ color: "#3D5600" }}>
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