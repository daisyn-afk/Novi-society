/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminCertifications from './pages/AdminCertifications';
import AdminClassSessions from './pages/AdminClassSessions';
import AdminCompliance from './pages/AdminCompliance';
import AdminCourses from './pages/AdminCourses';
import AdminDashboard from './pages/AdminDashboard';
import AdminEnrollments from './pages/AdminEnrollments';
import AdminLicenses from './pages/AdminLicenses';
import AdminProviders from './pages/AdminProviders';
import AdminReviews from './pages/AdminReviews';
import AdminServiceTypes from './pages/AdminServiceTypes';
import CourseCatalog from './pages/CourseCatalog';
import CourseCheckout from './pages/CourseCheckout';
import LandingPage from './pages/LandingPage';
import MDCertifications from './pages/MDCertifications';
import MDCompliance from './pages/MDCompliance';
import MDDashboard from './pages/MDDashboard';
import MDProviderRelationships from './pages/MDProviderRelationships';
import MDProviders from './pages/MDProviders';
import NoviLanding from './pages/NoviLanding';
import Onboarding from './pages/Onboarding';
import PatientAppointments from './pages/PatientAppointments';
import PatientJourney from './pages/PatientJourney';
import PatientMarketplace from './pages/PatientMarketplace';
import PatientOnboarding from './pages/PatientOnboarding';
import PatientProfile from './pages/PatientProfile';
import PatientReviews from './pages/PatientReviews';
import ProviderApplication from './pages/ProviderApplication';
import ProviderAppointments from './pages/ProviderAppointments';
import ProviderCertifications from './pages/ProviderCertifications';
import ProviderCodeRedemption from './pages/ProviderCodeRedemption';
import ProviderCredentialsCoverage from './pages/ProviderCredentialsCoverage';
import ProviderDashboard from './pages/ProviderDashboard';
import ProviderEnrollments from './pages/ProviderEnrollments';
import ProviderGettingStarted from './pages/ProviderGettingStarted';
import ProviderLicenses from './pages/ProviderLicenses';
import ProviderMDCoverage from './pages/ProviderMDCoverage';
import ProviderMDRelationships from './pages/ProviderMDRelationships';
import ProviderPractice from './pages/ProviderPractice';
import ProviderProfile from './pages/ProviderProfile';
import ProviderReviews from './pages/ProviderReviews';
import ProviderScopeRules from './pages/ProviderScopeRules';
import ProviderSubscription from './pages/ProviderSubscription';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminCertifications": AdminCertifications,
    "AdminClassSessions": AdminClassSessions,
    "AdminCompliance": AdminCompliance,
    "AdminCourses": AdminCourses,
    "AdminDashboard": AdminDashboard,
    "AdminEnrollments": AdminEnrollments,
    "AdminLicenses": AdminLicenses,
    "AdminProviders": AdminProviders,
    "AdminReviews": AdminReviews,
    "AdminServiceTypes": AdminServiceTypes,
    "CourseCatalog": CourseCatalog,
    "CourseCheckout": CourseCheckout,
    "LandingPage": LandingPage,
    "MDCertifications": MDCertifications,
    "MDCompliance": MDCompliance,
    "MDDashboard": MDDashboard,
    "MDProviderRelationships": MDProviderRelationships,
    "MDProviders": MDProviders,
    "NoviLanding": NoviLanding,
    "Onboarding": Onboarding,
    "PatientAppointments": PatientAppointments,
    "PatientJourney": PatientJourney,
    "PatientMarketplace": PatientMarketplace,
    "PatientOnboarding": PatientOnboarding,
    "PatientProfile": PatientProfile,
    "PatientReviews": PatientReviews,
    "ProviderApplication": ProviderApplication,
    "ProviderAppointments": ProviderAppointments,
    "ProviderCertifications": ProviderCertifications,
    "ProviderCodeRedemption": ProviderCodeRedemption,
    "ProviderCredentialsCoverage": ProviderCredentialsCoverage,
    "ProviderDashboard": ProviderDashboard,
    "ProviderEnrollments": ProviderEnrollments,
    "ProviderGettingStarted": ProviderGettingStarted,
    "ProviderLicenses": ProviderLicenses,
    "ProviderMDCoverage": ProviderMDCoverage,
    "ProviderMDRelationships": ProviderMDRelationships,
    "ProviderPractice": ProviderPractice,
    "ProviderProfile": ProviderProfile,
    "ProviderReviews": ProviderReviews,
    "ProviderScopeRules": ProviderScopeRules,
    "ProviderSubscription": ProviderSubscription,
}

export const pagesConfig = {
    mainPage: "NoviLanding",
    Pages: PAGES,
    Layout: __Layout,
};