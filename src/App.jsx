import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance, queryClientAdmincourses } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
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

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : null;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();
  const publicPaths = new Set([
    "/",
    "/NoviLanding",
    "/PreOrderCheckout",
    "/PreOrderConfirmation",
    "/login",
    "/signup"
  ]);
  const isPublicRoute = publicPaths.has(location.pathname);

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
    } else if (authError.type === 'auth_required') {
      if (!isPublicRoute) {
        navigateToLogin();
        return null;
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
      <Route path="/providerbasiconboarding" element={<Navigate to="/ProviderBasicOnboarding" replace />} />
      <Route path="/PreOrderCheckout" element={<PreOrderCheckout />} />
      <Route path="/PreOrderConfirmation" element={<PreOrderConfirmation />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/AdminPreOrders" element={
        <LayoutWrapper currentPageName="AdminPreOrders">
          <AdminPreOrders />
        </LayoutWrapper>
      } />
      <Route path="/AdminManufacturers" element={
        <LayoutWrapper currentPageName="AdminManufacturers">
          <AdminManufacturers />
        </LayoutWrapper>
      } />
      <Route path="/ProviderMarketplace" element={
        <LayoutWrapper currentPageName="ProviderMarketplace">
          <ProviderMarketplace />
        </LayoutWrapper>
      } />
      <Route path="/AdminEmailTemplates" element={
        <LayoutWrapper currentPageName="AdminEmailTemplates">
          <AdminEmailTemplates />
        </LayoutWrapper>
      } />
      <Route path="/AdminClassDaySimulator" element={
        <LayoutWrapper currentPageName="AdminClassDaySimulator">
          <AdminClassDaySimulator />
        </LayoutWrapper>
      } />
      <Route path="/MDTreatmentRecords" element={
        <LayoutWrapper currentPageName="MDTreatmentRecords">
          <MDTreatmentRecords />
        </LayoutWrapper>
      } />
      <Route path="/ProviderLaunchPad" element={
        <LayoutWrapper currentPageName="ProviderLaunchPad">
          <ProviderLaunchPad />
        </LayoutWrapper>
      } />
      <Route path="/AdminLaunchPad" element={
        <LayoutWrapper currentPageName="AdminLaunchPad">
          <AdminLaunchPad />
        </LayoutWrapper>
      } />
      <Route path="/AdminCourseStyling" element={<LayoutWrapper currentPageName="AdminCourseStyling"><AdminCourseStyling /></LayoutWrapper>} />
      <Route path="/AdminWizardConfig" element={<LayoutWrapper currentPageName="AdminWizardConfig"><AdminWizardConfig /></LayoutWrapper>} />
      <Route
        path="/admin"
        element={
          <LayoutWrapper currentPageName="AdminDashboard">
            <AdminDashboard />
          </LayoutWrapper>
        }
      />
      <Route
        path="/admincourses"
        element={
          <LayoutWrapper currentPageName="admincourses">
            <QueryClientProvider client={queryClientAdmincourses}>
              <AdminCoursesAdminRoute />
            </QueryClientProvider>
          </LayoutWrapper>
        }
      />
      <Route path="/admin/courses" element={<Navigate to="/admincourses" replace />} />
      <Route path="/admin/users" element={<Navigate to="/AdminProviders" replace />} />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
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