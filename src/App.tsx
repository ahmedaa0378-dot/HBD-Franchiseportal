import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import DeliverySettingsPage from './pages/admin/DeliverySettingsPage';
import PaymentSettingsPage from './pages/admin/PaymentSettingsPage';
import BundlesPage from './pages/admin/BundlesPage';
import AbandonedCartsPage from './pages/admin/AbandonedCartsPage';


// Franchise Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import CatalogPage from './pages/CatalogPage';
import CartPage from './pages/CartPage';
import OrdersPage from './pages/OrdersPage';

// Admin Pages
import AdminLoginPage from './pages/admin/AdminLoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import FranchisesPage from './pages/admin/FranchisesPage';
import ProductsPage from './pages/admin/ProductsPage';
import AdminOrdersPage from './pages/admin/OrdersPage';
import InventoryPage from './pages/admin/InventoryPage';

import Logo from './components/Logo';

// Loading Component
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-brand-cream">
    <div className="text-center">
      <div className="flex justify-center">
        <Logo size="lg" />
      </div>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
);

// Protected Route for Franchise
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, franchise, loading } = useApp();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!franchise) return <LoadingScreen />;
  if (franchise.status === 'pending') return <PendingApprovalPage />;
  if (franchise.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-brand-cream">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-semibold text-brand-black mb-2">Registration Rejected</h2>
          <p className="text-gray-600 mb-4">Your franchise registration was not approved.</p>
          {franchise.rejection_reason && (
            <p className="text-sm text-gray-500 bg-gray-100 p-3 rounded-lg mb-4">
              Reason: {franchise.rejection_reason}
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Public Route (redirect to catalog if logged in as franchise)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, franchise, loading } = useApp();

  if (loading) return <LoadingScreen />;
  if (user && franchise && franchise.status === 'approved') {
    return <Navigate to="/catalog" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ============ FRANCHISE ROUTES ============ */}
        <Route path="/login" element={
          <PublicRoute><LoginPage /></PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute><RegisterPage /></PublicRoute>
        } />
        <Route path="/catalog" element={
          <ProtectedRoute><CatalogPage /></ProtectedRoute>
        } />
        <Route path="/cart" element={
          <ProtectedRoute><CartPage /></ProtectedRoute>
        } />
        <Route path="/orders" element={
          <ProtectedRoute><OrdersPage /></ProtectedRoute>
        } />

        {/* ============ ADMIN ROUTES ============ */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<DashboardPage />} />
        <Route path="/admin/franchises" element={<FranchisesPage />} />
        <Route path="/admin/products" element={<ProductsPage />} />
        <Route path="/admin/orders" element={<AdminOrdersPage />} />
        <Route path="/admin/inventory" element={<InventoryPage />} />
        <Route path="/admin/delivery-settings" element={<DeliverySettingsPage />} />
        <Route path="/admin/payment-settings" element={<PaymentSettingsPage />} />
        <Route path="/admin/bundles" element={<BundlesPage />} />

        {/* ============ DEFAULT REDIRECTS ============ */}
        <Route path="/" element={<Navigate to="/catalog" replace />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/catalog" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;