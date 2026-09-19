import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GarmentCatalogProvider } from './contexts/GarmentCatalogContext';
import { StaffTypesProvider } from './contexts/StaffTypesContext';
import { HardwareScannerProvider } from './contexts/HardwareScannerContext';
import { CloudBootstrap } from './components/CloudBootstrap';
import { ToastHost } from './components/ui';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { MobileLayout } from './layouts/MobileLayout';
import { DesktopLayout } from './layouts/DesktopLayout';
import { isDesktopApp, isElectron } from './lib/platform';
import { LoginPage } from './pages/LoginPage';
import { ScannerPage } from './pages/ScannerPage';
import { OrdersPage } from './pages/OrdersPage';
import { StaffPage } from './pages/StaffPage';
import './index.css';

function AppLayout() {
  const Layout = isDesktopApp() ? DesktopLayout : MobileLayout;
  return (
    <HardwareScannerProvider>
      <Layout />
    </HardwareScannerProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ScannerPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/staff" element={<StaffPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const Router = isElectron() ? HashRouter : BrowserRouter;

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <GarmentCatalogProvider>
          <StaffTypesProvider>
            <CloudBootstrap />
            <div className="app-root min-h-dvh w-full bg-[#f4f6fb] text-slate-900">
              <Router>
                <AppRoutes />
              </Router>
            </div>
            <ToastHost />
          </StaffTypesProvider>
        </GarmentCatalogProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
