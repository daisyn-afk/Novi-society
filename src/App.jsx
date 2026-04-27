import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryClientInstance, queryClientAdmincourses } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import NoviLanding from './pages/NoviLanding';
import Onboarding from './pages/Onboarding';
import ProviderBasicOnboarding from './pages/ProviderBasicOnboarding';
import PreOrderCheckout from './pages/PreOrderCheckout';
import PreOrderConfirmation from './pages/PreOrderConfirmation';
import AdminPreOrders from './pages/AdminPreOrders';
import AdminManufacturers from './pages/AdminManufacturers';
import ProviderMarketplace from './pages/ProviderMarketplace';
import AdminEmailTemplates from './pages/AdminEmailTemplates';
import AdminClassDaySimulator from './pages/AdminClassDaySimulator';
import MDTreatmentRecords from './pages/MDTreatmentRecords';
import ProviderLaunchPad from './pages/ProviderLaunchPad';
import AdminLaunchPad from './pages/AdminLaunchPad';
import AdminCourseStyling from './pages/AdminCourseStyling';
import AdminWizardConfig from './pages/AdminWizardConfig';
import AdminDashboard from './pages/AdminDashboard';
import AdminCoursesAdminRoute from './pages/AdminCoursesAdminRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Forbidden from './pages/Forbidden';
import SetPassword from './pages/SetPassword';
import { base44 } from "@/api/base44Client";
import { getDashboardPathForRole, normalizeRole, isPageAllowedForRole } from "@/lib/routeAccessPolicy";

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : null;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const RequireRoleRoute = ({ pageKey, children }) => {
  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isPageAllowedForRole(pageKey, user?.role)) {
    return <Forbidden />;
  }

  return children;
};

const AdminEntryRoute = () => {
  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (normalizeRole(user?.role) !== "admin") {
    return <Navigate to={getDashboardPathForRole(user?.role)} replace />;
  }

  return (
    <LayoutWrapper currentPageName="AdminDashboard">
      <AdminDashboard />
    </LayoutWrapper>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, isAuthenticated, authError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const publicPaths = new Set([
    "/",
    "/NoviLanding",
    "/Onboarding",
    "/PreOrderCheckout",
    "/PreOrderConfirmation",
    "/login",
    "/signup",
    "/set-password"
  ]);
  const isPublicRoute = publicPaths.has(location.pathname);

  // Handle Supabase invite/recovery callbacks so users are taken to set-password instead of landing page.
  useEffect(() => {
    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const type = String(params.get("type") || "").toLowerCase();
    const accessToken = params.get("access_token");
    const isPasswordSetupFlow = type === "recovery" || type === "invite";
    if (!isPasswordSetupFlow || !accessToken) return;
    base44.auth.consumeRecoveryHash(hash);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    navigate("/set-password", { replace: true });
  }, [navigate]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required' && !isAuthenticated) {
      if (!isPublicRoute) {
        const nextPath = `${location.pathname}${location.search}${location.hash}`;
        return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
      }
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route
        path="/"
        element={
          MainPage ? (
            <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
          ) : (
            <Navigate to="/NoviLanding" replace />
          )
        }
      />
      <Route path="/NoviLanding" element={
        <LayoutWrapper currentPageName="NoviLanding">
          <NoviLanding />
        </LayoutWrapper>
      } />
      <Route path="/Onboarding" element={
        <LayoutWrapper currentPageName="Onboarding">
          <Onboarding />
        </LayoutWrapper>
      } />
      <Route path="/ProviderBasicOnboarding" element={
        <LayoutWrapper currentPageName="ProviderBasicOnboarding">
          <ProviderBasicOnboarding />
        </LayoutWrapper>
      } />
      <Route path="/PreOrderCheckout" element={<PreOrderCheckout />} />
      <Route path="/PreOrderConfirmation" element={<PreOrderConfirmation />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/forbidden" element={<Forbidden />} />
      <Route path="/AdminPreOrders" element={
        <RequireRoleRoute pageKey="AdminPreOrders">
          <LayoutWrapper currentPageName="AdminPreOrders">
            <AdminPreOrders />
          </LayoutWrapper>
        </RequireRoleRoute>
      } />
      <Route path="/AdminManufacturers" element={
        <RequireRoleRoute pageKey="AdminManufacturers">
          <LayoutWrapper currentPageName="AdminManufacturers">
            <AdminManufacturers />
          </LayoutWrapper>
        </RequireRoleRoute>
      } />
      <Route path="/ProviderMarketplace" element={
        <RequireRoleRoute pageKey="ProviderMarketplace">
          <LayoutWrapper currentPageName="ProviderMarketplace">
            <ProviderMarketplace />
          </LayoutWrapper>
        </RequireRoleRoute>
      } />
      <Route path="/AdminEmailTemplates" element={
        <RequireRoleRoute pageKey="AdminEmailTemplates">
          <LayoutWrapper currentPageName="AdminEmailTemplates">
            <AdminEmailTemplates />
          </LayoutWrapper>
        </RequireRoleRoute>
      } />
      <Route path="/AdminClassDaySimulator" element={
        <RequireRoleRoute pageKey="AdminClassDaySimulator">
          <LayoutWrapper currentPageName="AdminClassDaySimulator">
            <AdminClassDaySimulator />
          </LayoutWrapper>
        </RequireRoleRoute>
      } />
      <Route path="/MDTreatmentRecords" element={
        <RequireRoleRoute pageKey="MDTreatmentRecords">
          <LayoutWrapper currentPageName="MDTreatmentRecords">
            <MDTreatmentRecords />
          </LayoutWrapper>
        </RequireRoleRoute>
      } />
      <Route path="/ProviderLaunchPad" element={
        <RequireRoleRoute pageKey="ProviderLaunchPad">
          <LayoutWrapper currentPageName="ProviderLaunchPad">
            <ProviderLaunchPad />
          </LayoutWrapper>
        </RequireRoleRoute>
      } />
      <Route path="/AdminLaunchPad" element={
        <RequireRoleRoute pageKey="AdminLaunchPad">
          <LayoutWrapper currentPageName="AdminLaunchPad">
            <AdminLaunchPad />
          </LayoutWrapper>
        </RequireRoleRoute>
      } />
      <Route path="/AdminCourseStyling" element={<RequireRoleRoute pageKey="AdminCourseStyling"><LayoutWrapper currentPageName="AdminCourseStyling"><AdminCourseStyling /></LayoutWrapper></RequireRoleRoute>} />
      <Route path="/AdminWizardConfig" element={<RequireRoleRoute pageKey="AdminWizardConfig"><LayoutWrapper currentPageName="AdminWizardConfig"><AdminWizardConfig /></LayoutWrapper></RequireRoleRoute>} />
      <Route
        path="/admin"
        element={
          <AdminEntryRoute />
        }
      />
      <Route
        path="/admincourses"
        element={
          <RequireRoleRoute pageKey="admincourses">
            <LayoutWrapper currentPageName="admincourses">
              <QueryClientProvider client={queryClientAdmincourses}>
                <AdminCoursesAdminRoute />
              </QueryClientProvider>
            </LayoutWrapper>
          </RequireRoleRoute>
        }
      />
      <Route path="/admin/courses" element={<RequireRoleRoute pageKey="admincourses"><Navigate to="/admincourses" replace /></RequireRoleRoute>} />
      <Route path="/admin/users" element={<RequireRoleRoute pageKey="AdminProviders"><Navigate to="/AdminProviders" replace /></RequireRoleRoute>} />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <RequireRoleRoute pageKey={path}>
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            </RequireRoleRoute>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App