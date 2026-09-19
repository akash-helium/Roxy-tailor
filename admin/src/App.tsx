import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@app/contexts/AuthContext';
import { GarmentCatalogProvider } from '@app/contexts/GarmentCatalogContext';
import { StaffTypesProvider } from '@app/contexts/StaffTypesContext';
import { ProtectedRoute } from '@app/components/ProtectedRoute';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminCustomersPage } from './pages/AdminCustomersPage';
import { AdminStaffPage } from './pages/AdminStaffPage';
import { AdminClothTypesPage } from './pages/AdminClothTypesPage';
import { AdminTransactionsPage } from './pages/AdminTransactionsPage';

export default function App() {
  return (
    <AuthProvider>
      <GarmentCatalogProvider>
      <StaffTypesProvider>
      <div className="min-h-dvh w-full bg-slate-100 text-slate-900">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AdminLoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/" element={<AdminDashboardPage />} />
                <Route path="customers" element={<AdminCustomersPage />} />
                <Route path="staff" element={<AdminStaffPage />} />
                <Route path="cloth-types" element={<AdminClothTypesPage />} />
                <Route path="transactions" element={<AdminTransactionsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
      </StaffTypesProvider>
      </GarmentCatalogProvider>
    </AuthProvider>
  );
}
