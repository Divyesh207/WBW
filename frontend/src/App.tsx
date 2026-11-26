import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { LoadingScreen } from "./components/LoadingScreen";
import { ToastProvider } from "./components/Toast";
import { ButtonLink } from "./components/ui";
import { BrandLogo } from "./components/brand/BrandLogo";
import { AuthProvider } from "./hooks/useAuth";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";

// The dashboard (and its chart library) is downloaded only when someone opens it.
const AppLayout = lazy(() => import("./layouts/AppLayout").then((m) => ({ default: m.AppLayout })));
const AssessmentDetail = lazy(() => import("./pages/AssessmentDetail"));
const Assessments = lazy(() => import("./pages/Assessments"));
const Compare = lazy(() => import("./pages/Compare"));
const MaterialExplorer = lazy(() => import("./pages/MaterialExplorer"));
const NewAssessment = lazy(() => import("./pages/NewAssessment"));
const Overview = lazy(() => import("./pages/Overview"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportView = lazy(() => import("./pages/ReportView"));
const Settings = lazy(() => import("./pages/Settings"));
// Supplier Marketplace
const Browse = lazy(() => import("./pages/market/Browse"));
const ListingDetail = lazy(() => import("./pages/market/ListingDetail"));
const CompareListings = lazy(() => import("./pages/market/CompareListings"));
const Requests = lazy(() => import("./pages/market/Requests"));
const Orders = lazy(() => import("./pages/market/Orders"));
const OrderDetail = lazy(() => import("./pages/market/OrderDetail"));
const MarketDashboard = lazy(() => import("./pages/market/Dashboards").then((m) => ({ default: m.MarketDashboard })));
const SupplierDashboard = lazy(() => import("./pages/market/Dashboards").then((m) => ({ default: m.SupplierDashboard })));
const SupplierListings = lazy(() => import("./pages/market/SupplierListings"));
const SupplierProfileEdit = lazy(() => import("./pages/market/SupplierProfile"));
const SupplierPublic = lazy(() => import("./pages/market/SupplierProfile").then((m) => ({ default: m.SupplierPublic })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 }); // braces matter: newer browsers return a Promise from scrollTo
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-paper px-6 text-center">
      <BrandLogo layout="stacked" size={72} />
      <h1 className="mt-2 text-xl font-semibold text-brand-dark">Page not found</h1>
      <p className="mt-2 text-sm text-brand-muted">The page you are looking for does not exist.</p>
      <ButtonLink to="/" className="mt-6">
        Back to home
      </ButtonLink>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
      <ToastProvider>
        <ScrollToTop />
        <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Overview />} />
            <Route path="new" element={<NewAssessment />} />
            <Route path="assessments" element={<Assessments />} />
            <Route path="assessments/:id" element={<AssessmentDetail />} />
            <Route path="materials" element={<MaterialExplorer />} />
            <Route path="compare" element={<Compare />} />
            <Route path="reports" element={<Reports />} />
            <Route path="reports/:id" element={<ReportView />} />
            <Route path="settings" element={<Settings />} />
            <Route path="market" element={<MarketDashboard />} />
            <Route path="market/browse" element={<Browse />} />
            <Route path="market/compare" element={<CompareListings />} />
            <Route path="market/listings/:id" element={<ListingDetail />} />
            <Route path="market/suppliers/:id" element={<SupplierPublic />} />
            <Route path="market/requests" element={<Requests role="manufacturer" />} />
            <Route path="market/orders" element={<Orders role="manufacturer" />} />
            <Route path="market/orders/:id" element={<OrderDetail role="manufacturer" />} />
            <Route path="supplier" element={<SupplierDashboard />} />
            <Route path="supplier/listings" element={<SupplierListings />} />
            <Route path="supplier/requests" element={<Requests role="supplier" />} />
            <Route path="supplier/orders" element={<Orders role="supplier" />} />
            <Route path="supplier/orders/:id" element={<OrderDetail role="supplier" />} />
            <Route path="supplier/profile" element={<SupplierProfileEdit />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
